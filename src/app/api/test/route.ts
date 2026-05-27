
import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * 🤖 AI Connectivity Diagnostic Engine
 * Verifies the GEMINI_API_KEY configuration and model accessibility.
 */

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;

  try {
    if (!apiKey || apiKey.includes('XXXX') || apiKey.length < 10) {
      throw new Error("API Key is missing or using a placeholder.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
    });

    const result = await model.generateContent("Confirm connectivity with 'Identity Verified'.");

    return Response.json({
      success: true,
      text: result.response.text(),
      engine: "gemini-2.0-flash",
      status: "Operational",
      key_preview: `${apiKey.substring(0, 7)}...`
    });

  } catch (error: any) {
    console.error("Diagnostic Failure:", error);

    return Response.json({
      success: false,
      error: String(error),
      details: error.message || "Unknown Failure",
      hint: "Verify GOOGLE_GENAI_API_KEY is correctly set in .env"
    }, { status: 500 });
  }
}
