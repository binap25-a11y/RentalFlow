import { ai } from "@/ai/genkit";
import { googleAI } from "@genkit-ai/google-genai";

/**
 * 🤖 AI Connectivity Diagnostic Engine
 * Verifies model accessibility and credential status.
 * Performs a live handshake to confirm Gemini API health.
 */

export async function GET() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;

  try {
    if (!apiKey || apiKey.includes('XXXX') || apiKey.length < 10) {
      throw new Error("API Key is missing or using a placeholder. Ensure GOOGLE_GENAI_API_KEY is set in .env");
    }

    // Attempt a real content generation to verify connectivity
    // Using gemini-1.5-flash for maximum availability during testing
    const result = await ai.generate({
      model: googleAI.model("gemini-1.5-flash"),
      prompt: "Confirm connectivity with 'Identity Verified'. Respond only with those two words.",
    });

    const responseText = result.text;

    return Response.json({
      success: true,
      handshake: responseText,
      status: "Operational",
      engine: "gemini-1.5-flash",
      key_source: process.env.GOOGLE_GENAI_API_KEY ? "GOOGLE_GENAI_API_KEY" : "GEMINI_API_KEY",
      key_preview: `${apiKey.substring(0, 8)}...`
    });

  } catch (error: any) {
    console.error("Diagnostic Failure:", error);

    return Response.json({
      success: false,
      error: String(error),
      details: error.message || "Unknown Failure",
      hint: "Check your .env file and Google AI Studio project status. Ensure your API Key has not exceeded its quota (429 RESOURCE_EXHAUSTED)."
    }, { status: 500 });
  }
}