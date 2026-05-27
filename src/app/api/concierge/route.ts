import { ai } from '@/ai/genkit';
import { conciergePrompt } from '@/ai/flows/tenant-concierge-flow';

/**
 * 🤖 Hardened Gemini Streaming Chatbot
 * Optimized for Genkit 1.x zero-latency streaming.
 * DEFINITIVE FIX: Passes evaluated prompt request to ensure model is supplied.
 */

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || 'AIzaSyAtSuJUp7grUeDfLmuFZeax3_MFUzaVxeM';
    
    if (!apiKey) {
      console.error("AI CONFIG ERROR: Gemini API Key is missing.");
      return new Response(JSON.stringify({ error: 'System intelligence is currently offline.' }), { 
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
      // GENKIT 1.x STREAMING: Definitive iteration pattern using evaluated prompt
      const { stream } = ai.generateStream(conciergePrompt({
        query,
        residentName,
        propertyAddress,
        propertyContext
      }));

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
            console.error('REAL AI STREAM ERROR:', streamError);
            const errorMsg = streamError.message || "Service Interrupted";
            controller.enqueue(encoder.encode(`\n\n[GEMINI ERROR]: ${errorMsg}`));
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