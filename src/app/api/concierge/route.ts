import { ai } from '@/ai/genkit';
import { conciergePrompt } from '@/ai/flows/tenant-concierge-flow';

/**
 * 🤖 Hardened Gemini Streaming Chatbot
 * Optimized for Genkit 1.x zero-latency streaming.
 * Features professional logging to identify the true cause of AI interruptions.
 */

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY;
    
    // STEP 1: Verify Credential Loading
    console.log("GEMINI KEY STATUS:", !!apiKey);
    
    if (!apiKey) {
      console.error("AI CONFIG ERROR: Gemini API Key is missing from environment.");
      return new Response(JSON.stringify({ error: 'System intelligence is currently offline. Please configure API credentials.' }), { 
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await req.json().catch(() => ({}));
    const { query, residentName, propertyAddress, propertyContext } = body;

    if (!query) {
      return new Response(JSON.stringify({ error: 'Query is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const encoder = new TextEncoder();

    try {
      // GENKIT 1.x STREAMING: Definitive iteration pattern for defined prompts
      const { stream } = ai.generateStream({
        prompt: conciergePrompt,
        input: {
          query,
          residentName,
          propertyAddress,
          propertyContext
        }
      });

      const responseStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of stream) {
              const text = chunk.text;
              if (text) {
                controller.enqueue(encoder.encode(text));
              }
            }
            controller.close();
          } catch (streamError: any) {
            // EXPOSING THE TRUTH: Identify actual cause in server logs
            console.error('REAL AI STREAM ERROR:', streamError);
            
            const errorMsg = streamError.message || "";
            if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
              controller.enqueue(encoder.encode("\n\n[GEMINI ALERT]: AI is temporarily busy due to high demand. Please try again in 60 seconds."));
            } else {
              controller.enqueue(encoder.encode(`\n\n[GEMINI ERROR]: Service interrupted. Root Cause: ${errorMsg}`));
            }
            controller.close();
          }
        },
      });

      return new Response(responseStream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'X-Content-Type-Options': 'nosniff',
        },
      });

    } catch (initError: any) {
      console.error('AI STREAM INIT ERROR:', initError);
      return new Response(JSON.stringify({ error: `Initialization Failure: ${initError.message}` }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

  } catch (error: any) {
    console.error('CONCIERGE API RUNTIME ERROR:', error);
    return new Response(JSON.stringify({ error: 'Internal intelligence relay failure.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
