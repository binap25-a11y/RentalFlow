import { ai } from '@/ai/genkit';
import { conciergePrompt } from '@/ai/flows/tenant-concierge-flow';

/**
 * 🤖 Hardened Streaming Concierge Endpoint
 * Optimized for Genkit 1.x zero-latency streaming and real professional logging.
 * Exposes actual root causes (like quota limits) to server logs while maintaining elite UX.
 */

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { query, residentName, propertyAddress, propertyContext } = body;

    if (!query) {
      return new Response(JSON.stringify({ error: 'Resident query is required' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const encoder = new TextEncoder();

    // GENKIT 1.x ORCHESTRATION: Correct streaming syntax
    try {
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
            // REAL LOGGING: Identify the actual root cause (Quota vs Credential)
            console.error('REAL AI STREAM ERROR:', streamError);
            
            const errorMsg = streamError.message || "";
            if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
              controller.enqueue(encoder.encode("\n\n[SYSTEM]: AI is temporarily busy. Please try again."));
            } else {
              controller.enqueue(encoder.encode("\n\n[SYSTEM]: Connection interrupted. Please try again."));
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
      return new Response(JSON.stringify({ error: initError.message }), { 
        status: 500, 
        headers: { 'Content-Type': 'application/json' } 
      });
    }

  } catch (error: any) {
    console.error('CONCIERGE API RUNTIME ERROR:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
