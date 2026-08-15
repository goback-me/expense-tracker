import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { createMessageWithRetry } from "@/lib/claude-retry";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const EXTRACTION_PROMPT = `You are a receipt-scanning assistant. Look at this receipt image and extract the data.

First, decide what kind of receipt this is:
- "purchase" — a store/restaurant/service receipt with a merchant and (usually) line items.
- "transfer" — a bank transfer, wallet transfer (e.g. JazzCash, Easypaisa, bKash, PayPal, Venmo, Zelle, Cash App, Wise, any bank app screenshot), or ATM/deposit slip. These have a payment method/provider, a sender and/or recipient, and often a transaction/reference number — but no store and no itemized list.

Then decide the direction of money:
- "income" — money coming IN to the account holder. Signal words: "received", "credited", "deposit", "refund", "cashback", "reversed", "salary", "payment received". A screenshot showing money arriving is income even if it's formatted like a receipt/confirmation screen.
- "expense" — money going OUT from the account holder. Signal words: "sent", "paid", "debited", "purchase", "withdrawn", "deducted". This is the default ONLY when there is no clear income signal.
- This field is REQUIRED — always include your best judgment, never omit it.

Respond ONLY with valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "receipt_type": "purchase" | "transfer",
  "direction": "expense" | "income",
  "store_name": string,
  "date": string (YYYY-MM-DD),
  "total_amount": number,
  "category": one of ["Groceries", "Dining", "Transport", "Shopping", "Tech", "Transfer", "Other"],
  "items": [{ "name": string, "price": number }],
  "payment_method": string or null,
  "counterparty": string or null,
  "reference_no": string or null
}

Field rules:
- A "purchase" is always "expense" — a store receipt is never income.
- If receipt_type is "purchase": "store_name" is the merchant name. "items" lists what was bought (empty array if not itemized). Leave "payment_method", "counterparty", and "reference_no" as null.
- If receipt_type is "transfer": set "category" to "Transfer". Set "store_name" to a short human-readable label combining the method and who it went to/from, e.g. "JazzCash to Ali Raza" (expense) or "JazzCash from Ali Raza" (income). "payment_method" is just the provider/bank name (e.g. "JazzCash", "Easypaisa", "HBL Bank", "PayPal"). "counterparty" is the other party's name if visible (sender or recipient, whichever isn't the account holder). "reference_no" is the transaction ID / reference number if printed. Leave "items" as an empty array.
- If a field can't be read, make a reasonable best guess rather than leaving it empty — except payment_method/counterparty/reference_no on a "purchase" receipt, and items on a "transfer" receipt, which should stay null/empty respectively.`;

export async function POST(request: NextRequest) {
  try {
    // Require an authenticated user before spending API quota
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: "Your session expired. Please log in again." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const image = formData.get("image") as File | null;

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");
    const mediaType = (image.type || "image/jpeg") as
      | "image/jpeg"
      | "image/png"
      | "image/webp"
      | "image/gif";

    let result;
    try {
      result = await createMessageWithRetry(anthropic, {
        model: process.env.CLAUDE_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 2048,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: { type: "base64", media_type: mediaType, data: base64 },
              },
              { type: "text", text: EXTRACTION_PROMPT },
            ],
          },
        ],
      });
    } catch (apiErr: any) {
      console.error("Claude API error:", apiErr);

      const status = apiErr?.status;
      if (status === 429) {
        return NextResponse.json(
          { error: "You've hit the scan limit for right now. Wait a minute and try again, or add this one manually." },
          { status: 429 }
        );
      }
      if (status === 400 || status === 415) {
        return NextResponse.json(
          { error: "That image couldn't be processed. Try a different photo." },
          { status: 415 }
        );
      }
      return NextResponse.json(
        { error: "Couldn't reach the scanning service. Check your connection and try again." },
        { status: 502 }
      );
    }

    const textBlock = result.content.find((block: any) => block.type === "text");
    const text = (textBlock?.text || "").trim();
    const cleaned = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Couldn't read that clearly. Try a clearer, well-lit photo, or add it manually instead." },
        { status: 502 }
      );
    }

    // Defensive normalization — never let a slightly malformed model
    // response break the confirm screen downstream.
    const normalized = {
      receipt_type: parsed.receipt_type === "transfer" ? "transfer" : "purchase",
      direction: parsed.direction === "income" ? "income" : "expense",
      store_name: typeof parsed.store_name === "string" && parsed.store_name.trim()
        ? parsed.store_name.trim()
        : "Unknown",
      date:
        typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
          ? parsed.date
          : new Date().toISOString().slice(0, 10),
      total_amount:
        typeof parsed.total_amount === "number" && !isNaN(parsed.total_amount)
          ? parsed.total_amount
          : 0,
      category: typeof parsed.category === "string" ? parsed.category : "Other",
      items: Array.isArray(parsed.items)
        ? parsed.items
            .filter((it: any) => it && typeof it.name === "string")
            .map((it: any) => ({
              name: it.name,
              price: typeof it.price === "number" ? it.price : 0,
            }))
        : [],
      payment_method:
        typeof parsed.payment_method === "string" ? parsed.payment_method : null,
      counterparty:
        typeof parsed.counterparty === "string" ? parsed.counterparty : null,
      reference_no:
        typeof parsed.reference_no === "string" ? parsed.reference_no : null,
    };

    // A purchase receipt is never income — enforce this regardless of what
    // the model returned, since store receipts are always a spend.
    if (normalized.receipt_type === "purchase") {
      normalized.direction = "expense";
    }

    return NextResponse.json(normalized);
  } catch (err) {
    console.error("OCR error:", err);
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again." },
      { status: 500 }
    );
  }
}