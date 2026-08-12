import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createMessageWithRetry } from "@/lib/claude-retry";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const MAX_TRANSACTIONS = 300;
const MAX_SIZE_MB = 25;

// How many statement pages get sent to Claude in a single API call. Sending
// several images per request instead of one call per page keeps the total
// number of API calls (and therefore cost + rate-limit exposure) low for
// long, multi-page statements.
const BATCH_SIZE = 8;

// Small pause between batches as extra headroom under per-minute limits.
const BATCH_DELAY_MS = 1000;

function buildPrompt(pageCount: number) {
  const pageNote =
    pageCount > 1
      ? `You will receive ${pageCount} images — these are multiple pages from the same bank/wallet statement, in order. Extract transactions from ALL of them combined into a single list.`
      : `Look at this statement page — it may be a photo of a printed statement or a screenshot of a banking app's transaction history.`;

  return `You are a bank/wallet statement parsing assistant. ${pageNote} It lists MULTIPLE transactions.

For each transaction row, decide the direction:
- "expense" for any debit, withdrawal, payment, or purchase.
- "income" for any credit, deposit, or received transfer.

Respond ONLY with valid JSON, no markdown fences, no preamble: a JSON array (not an object) with one entry per transaction, in exactly this shape:
[
  {
    "date": "YYYY-MM-DD",
    "description": string,
    "amount": number,
    "direction": "expense" | "income",
    "reference_no": string or null
  }
]

Rules:
- Extract every transaction row you can see across all provided page(s).
- "description" should be the merchant/counterparty/memo text from that row — keep it short and human-readable.
- If the statement doesn't show the year, infer it from context (e.g. a header date) or use the current year.
- Never invent a transaction that isn't actually shown. If you can't find any transactions, return an empty array [].
- Amounts should be positive numbers regardless of direction — the "direction" field carries the sign.
- If the same page appears twice or transactions repeat across pages by mistake, still list them as they appear — do not attempt to deduplicate here.`;
}

class OcrApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

async function extractTransactionsFromBatch(files: File[]) {
  for (const file of files) {
    if (!ALLOWED_MEDIA_TYPES.includes(file.type)) {
      throw new OcrApiError("Please upload an image of your statement.", 415);
    }
  }

  const imageBlocks = await Promise.all(
    files.map(async (file) => {
      const buffer = Buffer.from(await file.arrayBuffer());
      return {
        type: "image" as const,
        source: {
          type: "base64" as const,
          media_type: file.type as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          data: buffer.toString("base64"),
        },
      };
    })
  );

  let result;
  try {
    result = await createMessageWithRetry(anthropic, {
      model: process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [...imageBlocks, { type: "text", text: buildPrompt(files.length) }],
        },
      ],
    });
  } catch (apiErr: any) {
    console.error("Claude API error:", apiErr);
    const status = apiErr?.status;
    if (status === 429) {
      throw new OcrApiError(
        "You've hit the request limit for right now. Wait a minute and try again.",
        429
      );
    }
    if (status === 400 || status === 415) {
      throw new OcrApiError(
        "That file couldn't be processed. Try a clearer image or a different export.",
        415
      );
    }
    throw new OcrApiError(
      "Couldn't reach the parsing service. Check your connection and try again.",
      502
    );
  }

  const textBlock = result.content.find((block: any) => block.type === "text");
  const raw = (textBlock?.text || "").trim();
  const cleaned = raw.replace(/```json|```/g, "").trim();

  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new OcrApiError(
      "Couldn't read that statement clearly. Try a clearer scan, or a different file.",
      502
    );
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const todayISO = new Date().toISOString().slice(0, 10);

  return parsed
    .filter((t) => t && typeof t.description === "string" && typeof t.amount === "number")
    .map((t) => ({
      date:
        typeof t.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t.date)
          ? t.date
          : todayISO,
      description: String(t.description).trim().slice(0, 200) || "Transaction",
      amount: Math.abs(Number(t.amount)) || 0,
      direction: t.direction === "income" ? "income" : "expense",
      reference_no: typeof t.reference_no === "string" ? t.reference_no : null,
    }));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Your session expired. Please log in again." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    // Every file arriving here is already a rasterized JPEG page image —
    // any PDF gets rendered to images client-side first (see lib/pdf.ts) —
    // so this always deals in plain images, never raw PDF bytes.
    const files = formData.getAll("file").filter((f): f is File => f instanceof File);

    if (files.length === 0) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }

    for (const file of files) {
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        return NextResponse.json(
          { error: `One of the files is too large (max ${MAX_SIZE_MB}MB per page).` },
          { status: 400 }
        );
      }
    }

    const batches = chunk(files, BATCH_SIZE);
    const allTransactions: Awaited<ReturnType<typeof extractTransactionsFromBatch>> = [];
    let lastError: OcrApiError | null = null;

    for (let i = 0; i < batches.length; i++) {
      try {
        const batchTransactions = await extractTransactionsFromBatch(batches[i]);
        allTransactions.push(...batchTransactions);
        if (allTransactions.length >= MAX_TRANSACTIONS) break;
      } catch (err) {
        if (err instanceof OcrApiError) {
          lastError = err;
        } else {
          throw err;
        }
      }

      // Pause between batches (not after the last one) as extra rate-limit
      // headroom.
      if (i < batches.length - 1) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    if (allTransactions.length === 0) {
      if (lastError) {
        return NextResponse.json({ error: lastError.message }, { status: lastError.status });
      }
      return NextResponse.json(
        { error: "No transactions could be found in that file. Try a clearer image, or add entries manually." },
        { status: 502 }
      );
    }

    return NextResponse.json({ transactions: allTransactions.slice(0, MAX_TRANSACTIONS) });
  } catch (err) {
    console.error("Statement parse error:", err);
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again." },
      { status: 500 }
    );
  }
}