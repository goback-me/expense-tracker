import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

function buildPrompt(todayISO: string) {
  return `You are a bank/wallet SMS parsing assistant. The person will paste the raw text of a single SMS or push notification about one transaction — e.g. from a bank, JazzCash, Easypaisa, PayPal, or similar.

Decide the direction of money:
- "expense" if the message says debited, sent, paid, withdrawn, purchase, or similar.
- "income" if the message says credited, received, deposited, or similar.

Decide the type:
- "purchase" if it describes a card/purchase transaction at a specific merchant.
- "transfer" for anything else (bank transfer, wallet transfer, ATM withdrawal, deposit, salary credit).

Today's date is ${todayISO} — use it to fill in the year/date if the message only gives a partial date (e.g. "12 Aug") or no date at all (assume today).

Respond ONLY with valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "receipt_type": "purchase" | "transfer",
  "direction": "expense" | "income",
  "store_name": string,
  "date": string (YYYY-MM-DD),
  "total_amount": number,
  "category": one of ["Groceries", "Dining", "Transport", "Shopping", "Tech", "Transfer", "Other"],
  "items": [],
  "payment_method": string or null,
  "counterparty": string or null,
  "reference_no": string or null
}

Field rules:
- If receipt_type is "purchase": "store_name" is the merchant name from the message.
- If receipt_type is "transfer": set "category" to "Transfer". "store_name" is a short label like "JazzCash to Ali Raza" or "HBL Bank from Ahmed". "payment_method" is the bank/wallet name. "counterparty" is the other party's name if mentioned. "reference_no" is any transaction/reference ID mentioned.
- "items" is always an empty array — this is a text message, not an itemized receipt.
- If the amount or a required field genuinely isn't present in the text, make the most reasonable guess rather than leaving it empty, except payment_method/counterparty/reference_no which can be null if not mentioned.
- If the pasted text doesn't look like a transaction message at all, still do your best to extract whatever amount and context is present.`;
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

    const { text } = await request.json();

    if (!text || typeof text !== "string" || !text.trim()) {
      return NextResponse.json(
        { error: "Paste the message text first." },
        { status: 400 }
      );
    }

    if (text.length > 2000) {
      return NextResponse.json(
        { error: "That's too long for a single message — trim it down to just the transaction text." },
        { status: 400 }
      );
    }

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    });

    const todayISO = new Date().toISOString().slice(0, 10);

    let result;
    try {
      result = await model.generateContent([buildPrompt(todayISO), text]);
    } catch (apiErr: any) {
      console.error("Gemini API error:", apiErr);
      const status = apiErr?.status || apiErr?.response?.status;
      if (status === 429) {
        return NextResponse.json(
          { error: "You've hit the free limit for right now. Wait a minute and try again, or add this manually." },
          { status: 429 }
        );
      }
      return NextResponse.json(
        { error: "Couldn't reach the parsing service. Check your connection and try again." },
        { status: 502 }
      );
    }

    const raw = result.response.text().trim();
    const cleaned = raw.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Couldn't make sense of that message. Try pasting just the transaction line, or add it manually." },
        { status: 502 }
      );
    }

    const normalized = {
      receipt_type: parsed.receipt_type === "purchase" ? "purchase" : "transfer",
      direction: parsed.direction === "income" ? "income" : "expense",
      store_name:
        typeof parsed.store_name === "string" && parsed.store_name.trim()
          ? parsed.store_name.trim()
          : "Transaction",
      date:
        typeof parsed.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(parsed.date)
          ? parsed.date
          : todayISO,
      total_amount:
        typeof parsed.total_amount === "number" && !isNaN(parsed.total_amount)
          ? parsed.total_amount
          : 0,
      category: typeof parsed.category === "string" ? parsed.category : "Other",
      items: [] as { name: string; price: number }[],
      payment_method:
        typeof parsed.payment_method === "string" ? parsed.payment_method : null,
      counterparty:
        typeof parsed.counterparty === "string" ? parsed.counterparty : null,
      reference_no:
        typeof parsed.reference_no === "string" ? parsed.reference_no : null,
    };

    if (normalized.receipt_type === "purchase") {
      normalized.direction = "expense";
    }

    return NextResponse.json(normalized);
  } catch (err) {
    console.error("SMS parse error:", err);
    return NextResponse.json(
      { error: "Something went wrong on our end. Please try again." },
      { status: 500 }
    );
  }
}