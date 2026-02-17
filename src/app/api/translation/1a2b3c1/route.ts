// app/api/translate/route.js

import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextRequest, NextResponse } from "next/server";

// Store your API key securely in .env.local
const API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: NextRequest) {
  // Check if the API key is configured
  if (!API_KEY) {
    console.error("GEMINI_API_KEY is not set in environment variables.");
    return NextResponse.json(
      { error: "Server configuration error: Gemini API key is not set." },
      { status: 500 }
    );
  }

  const genAI = new GoogleGenerativeAI(API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  try {
    // Parse the request body, expecting 'text' (a single string) and 'tgt_lang'
    const { text, tgt_lang } = await req.json();

    // Validate incoming data: 'text' must be a non-empty string, 'tgt_lang' must be a non-empty string
    if (
      typeof text !== "string" ||
      text.trim() === "" ||
      typeof tgt_lang !== "string" ||
      tgt_lang.trim() === ""
    ) {
      console.error("Validation error: Invalid input for text or tgt_lang.", {
        text,
        tgt_lang,
      });
      return NextResponse.json(
        {
          error:
            "Invalid request: `text` must be a non-empty string, and `tgt_lang` must be a non-empty string.",
        },
        { status: 400 }
      );
    }

    const prompt =
      `Translate the following text into ${tgt_lang}. ` +
      `Return **only** a valid JSON array (list) containing *just* the translated text. ` +
      `Do not add any explanations, bullet points, or additional formatting. ` +
      `Input:\n${JSON.stringify([text])}`; // Wrap the single text in an array for consistent JSON output expectation

    // Call the Gemini API
    const result = await model.generateContent(prompt);
    let translatedResponseContent = result.response.text();

    // Clean the response: Gemini might sometimes wrap the JSON in markdown code blocks.
    // This regular expression replaces leading "```json\n" and trailing "\n```" characters.
    translatedResponseContent = translatedResponseContent
      .replace(/^```json\n|\n```$/g, "")
      .trim();

    let translatedArray;
    try {
      // Attempt to parse the cleaned response as JSON
      translatedArray = JSON.parse(translatedResponseContent);
    } catch (parseError) {
      console.error("JSON parsing error from Gemini response:", parseError);
      throw new Error(
        "Failed to parse Gemini API response as JSON. Response: " +
          translatedResponseContent
      );
    }

    // Validate the parsed response: Expect an array with exactly one string element
    if (
      !Array.isArray(translatedArray) ||
      translatedArray.length !== 1 ||
      typeof translatedArray[0] !== "string" // Ensure the translated item inside the array is a string
    ) {
      console.error(
        "Gemini API returned an unexpected format or number of translations:",
        translatedArray
      );
      throw new Error(
        "Gemini API returned an unexpected format or incorrect number of translations. Expected a single-element array."
      );
    }

    // Extract the single translated string from the array
    const translatedText = translatedArray[0];

    // Return the successful single translation
    return NextResponse.json(
      { tgt_text: translatedText }, // Return just the single translated string
      { status: 200 }
    );
  } catch (error) {
    console.error("Gemini translation API processing error:", error);
    // Return a generic error message to the client, but log details for debugging
    return NextResponse.json(
      {
        error: "Translation failed due to an internal server error.",
        details: error,
      },
      { status: 500 }
    );
  }
}
