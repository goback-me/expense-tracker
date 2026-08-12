import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@/lib/supabase/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const EXTRACTION_PROMPT = `You are a receipt-scanning assistant. Look at this receipt image and extract the data.

Respond ONLY with valid JSON, no markdown fences, no preamble, in exactly this shape:
{
  "store_name": string,
  "date": string (YYYY-MM-DD),
  "total_amount": number,
  "category": one of ["Groceries", "Dining", "Transport", "Shopping", "Tech", "Other"],
  "items": [{ "name": string, "price": number }]
}

If a field can't be read, make a reasonable best guess. Never leave a field empty.`;

export async function POST(request: NextRequest) {
  try {
    // Require an authenticated user before spending API quota
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const image = formData.get("image") as File | null;

    if (!image) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await image.arrayBuffer());
    const base64 = buffer.toString("base64");

    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    });

    const result = await model.generateContent([
      EXTRACTION_PROMPT,
      {
        inlineData: {
          mimeType: image.type || "image/jpeg",
          data: base64,
        },
      },
    ]);

    const text = result.response.text().trim();
    const cleaned = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: "Could not parse receipt data" },
        { status: 502 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("OCR error:", err);
    return NextResponse.json(
      { error: "Failed to process receipt" },
      { status: 500 }
    );
  }
}