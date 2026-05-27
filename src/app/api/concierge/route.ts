
import { NextRequest } from 'next/server';
import { ai } from '@/ai/genkit';
import { conciergePrompt } from '@/ai/flows/tenant-concierge-flow';

/**
 * 🤖 Hardened Streaming Concierge Endpoint
 * Optimized for Genkit 1.x synchronous stream initialization and resilient error handling.
 */

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
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

    try {
      // GENKIT 1.x ORCHESTRATION: generateStream returns the stream object synchronously.
      const { stream } = ai.generateStream(
        conciergePrompt({
          query,
          residentName,
          propertyAddress,
          propertyContext
        })
      );

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
            console.error('AI STREAM ITERATION ERROR:', streamError);
            
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
