import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const MAX_TRANSACTIONS = 50;
const MAX_SIZE_MB = 25;

function buildPrompt() {
  return `You are a bank/wallet statement parsing assistant. Look at this statement page — it may be a photo of a printed statement or a screenshot of a banking app's transaction history — and it lists MULTIPLE transactions.

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
- Extract every transaction row you can see on this page.
- "description" should be the merchant/counterparty/memo text from that row — keep it short and human-readable.
- If the statement doesn't show the year, infer it from context (e.g. a header date) or use the current year.
- Never invent a transaction that isn't actually shown. If you can't find any transactions on this page, return an empty array [].
- Amounts should be positive numbers regardless of direction — the "direction" field carries the sign.`;
}

class OcrApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function extractTransactionsFromImage(file: File) {
  const isPdf = file.type === "application/pdf";
  const isImage = file.type.startsWith("image/");

  if (!isPdf && !isImage) {
    throw new OcrApiError("Please upload an image or a PDF of your statement.", 415);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
  });

  let result;
  try {
    result = await model.generateContent([
      buildPrompt(),
      { inlineData: { mimeType: file.type, data: base64 } },
    ]);
  } catch (apiErr: any) {
    console.error("Gemini API error:", apiErr);
    const status = apiErr?.status || apiErr?.response?.status;
    if (status === 429) {
      throw new OcrApiError(
        "You've hit the free limit for right now. Wait a minute and try again.",
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

  const raw = result.response.text().trim();
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
    // Supports one file (a single image/PDF) or multiple (pages rasterized
    // client-side from a password-protected PDF — see lib/pdf.ts).
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

    const allTransactions: Awaited<ReturnType<typeof extractTransactionsFromImage>> = [];
    let lastError: OcrApiError | null = null;

    // Process sequentially rather than in parallel — Gemini's free tier has
    // a per-minute request cap, so a multi-page statement firing all pages
    // at once would just trip rate limiting.
    for (const file of files) {
      try {
        const pageTransactions = await extractTransactionsFromImage(file);
        allTransactions.push(...pageTransactions);
        if (allTransactions.length >= MAX_TRANSACTIONS) break;
      } catch (err) {
        if (err instanceof OcrApiError) {
          lastError = err;
        } else {
          throw err;
        }
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