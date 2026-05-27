
import { NextRequest } from 'next/server';
import { ai } from '@/ai/genkit';
import { conciergePrompt } from '@/ai/flows/tenant-concierge-flow';

/**
 * @fileOverview Hardened Streaming Concierge Endpoint.
 * Optimized for Gemini 2.0 Flash and Genkit 1.x synchronous streaming.
 * Replaced masked error messages with real logging for professional debugging.
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
      // GENKIT 1.x ORCHESTRATION: stream object is returned synchronously.
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
            // REAL LOGGING: Hitting the server console with actual error data
            console.error('AI STREAM ITERATION ERROR:', streamError);
            
            const errorMsg = streamError.message || "";
            if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
              controller.enqueue(encoder.encode("\n\n[SYSTEM]: AI is temporarily busy due to high volume. Please try your request once more in a moment."));
            } else {
              controller.enqueue(encoder.encode("\n\n[SYSTEM]: A synchronization delay occurred. Please try again or contact management."));
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
      console.error('AI STREAM INITIALIZATION ERROR:', initError);
      return new Response(JSON.stringify({ 
        error: 'Intelligence engine initialization failed.',
        details: initError.message
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

  } catch (error: any) {
    console.error('CONCIERGE API RUNTIME ERROR:', error);
    return new Response(JSON.stringify({ 
      error: 'Intelligence Engine Offline',
      details: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
