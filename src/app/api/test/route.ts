
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * @fileOverview AI Connectivity Diagnostic Engine.
 * Verifies the GEMINI_API_KEY configuration and model accessibility.
 */

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

  try {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    const result = await model.generateContent("Hello. Confirm connectivity with 'Connection Active'.");

    return Response.json({
      success: true,
      text: result.response.text(),
      engine: "gemini-2.0-flash",
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    console.error("Diagnostic Error:", error);

    return Response.json({
      success: false,
      error: String(error),
      details: error.message || "Unknown Failure"
    }, { status: 500 });
  }
}
