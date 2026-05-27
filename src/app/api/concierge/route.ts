import { NextRequest } from 'next/server';
import { ai } from '@/ai/genkit';
import { conciergePrompt } from '@/ai/flows/tenant-concierge-flow';

/**
 * @fileOverview High-Fidelity Streaming Concierge Endpoint.
 * Enables zero-latency AI responses by streaming Gemini chunks directly to the client.
 * Hardened for Genkit 1.x streaming protocols and runtime stability.
 */

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, residentName, propertyAddress, propertyContext } = body;

    // Correct Genkit 1.x streaming orchestration
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
              controller.enqueue(new TextEncoder().encode(text));
            }
          }
          controller.close();
        } catch (streamError) {
          console.error('API Stream Iteration Failure:', streamError);
          controller.error(streamError);
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
  } catch (error: any) {
    console.error('Concierge API Runtime Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Intelligence Engine Offline',
      details: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
