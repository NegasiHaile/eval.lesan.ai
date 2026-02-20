export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const API_URL = process.env.LESAN_API_URL;
  const API_KEY = process.env.LESAN_API_KEY;

  if (!API_URL || !API_KEY) {
    return NextResponse.json(
      { message: "API_URL or KEY or both are not provided!" },
      { status: 500 }
    );
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const { text, source_language, tgt_lang } = body;

  if (!text || !source_language || !tgt_lang) {
    return NextResponse.json(
      {
        message: "Missing required fields: text, source_language, or tgt_lang",
      },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        key: API_KEY,
        text,
        source_language,
        tgt_lang,
      }),
    });

    const data = await response.json();
    return NextResponse.json({ ...data });
  } catch (error) {
    console.error("LESAN API error:", error);
    return NextResponse.json(
      { message: "Error connecting to Lesan API", error },
      { status: 500 }
    );
  }
}
