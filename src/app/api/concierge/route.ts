import { NextRequest } from 'next/server';
import { ai } from '@/ai/genkit';
import { conciergePrompt } from '@/ai/flows/tenant-concierge-flow';

/**
 * @fileOverview High-Fidelity Streaming Concierge Endpoint.
 * Enables zero-latency AI responses by streaming Gemini 2.0 Flash chunks directly to the client.
 */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, residentName, propertyAddress, propertyContext } = body;

    const { stream } = ai.generateStream(conciergePrompt({
      query,
      residentName,
      propertyAddress,
      propertyContext
    }));

    const responseStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          const text = chunk.text;
          if (text) {
            controller.enqueue(new TextEncoder().encode(text));
          }
        }
        controller.close();
      },
    });

    return new Response(responseStream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error: any) {
    console.error('Concierge Stream Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
