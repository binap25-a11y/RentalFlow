import { ai } from "@/ai/genkit";
import { googleAI } from "@genkit-ai/google-genai";

/**
 * 🤖 AI Connectivity Diagnostic Engine
 * Verifies model accessibility and credential status.
 * Performs a live handshake with Gemini 1.5 Flash for maximum availability.
 */

export async function GET() {
  const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || 'AIzaSyAtSuJUp7grUeDfLmuFZeax3_MFUzaVxeM';

  try {
    if (!apiKey || apiKey.length < 10) {
      throw new Error("API Key is missing or invalid.");
    }

    // Attempt a real content generation to verify connectivity
    const result = await ai.generate({
      model: googleAI.model("gemini-1.5-flash"),
      prompt: "Confirm connectivity with 'Identity Verified'. Respond only with those two words.",
    });

    return Response.json({
      success: true,
      handshake: result.text,
      status: "Operational",
      engine: "gemini-1.5-flash",
      key_preview: `${apiKey.substring(0, 8)}...`
    });

  } catch (error: any) {
    console.error("Diagnostic Failure:", error);
    return Response.json({
      success: false,
      error: String(error),
      details: error.message || "Unknown Failure",
      hint: "Ensure GEMINI_API_KEY is correctly set. Check quota status if hitting 429 RESOURCE_EXHAUSTED."
    }, { status: 500 });
  }
}