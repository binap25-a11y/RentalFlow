
import { NextRequest } from 'next/server';
import { ai } from '@/ai/genkit';
import { conciergePrompt } from '@/ai/flows/tenant-concierge-flow';

/**
 * @fileOverview Hardened Streaming Concierge Endpoint.
 * Enables zero-latency AI responses by streaming Gemini chunks directly to the client.
 * Refined to handle quota limits and credential verification gracefully.
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
      // GENKIT 1.x ORCHESTRATION: Stream initialization is synchronous
      // Ensure GOOGLE_GENAI_API_KEY is available in the environment
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
            console.error('API Stream Iteration Failure:', streamError);
            const errorMsg = streamError.message || "";
            
            // Handle high-volume or quota scenarios gracefully within the stream
            if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
              controller.enqueue(encoder.encode("\n\n[SYSTEM NOTIFICATION]: The high-fidelity property intelligence engine is currently handling a high volume of requests. Please try your query again in a moment—your residency ledger remains secure."));
            } else if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('403')) {
              controller.enqueue(encoder.encode("\n\n[SYSTEM ALERT]: Credential verification pending. Please verify your Google API Key configuration in the management console."));
            } else {
              controller.enqueue(encoder.encode("\n\n[SYSTEM ERROR]: Communication interrupted. Please try again or contact management if the issue persists."));
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
      console.error('Stream Initialization Error:', initError);
      const errorMsg = initError.message || "";
      
      if (errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
        return new Response(JSON.stringify({ 
          error: 'Intelligence engine is temporarily busy. Please retry in a few moments.' 
        }), { status: 429, headers: { 'Content-Type': 'application/json' } });
      }
      
      return new Response(JSON.stringify({ 
        error: 'Intelligence engine initialization failed.',
        details: errorMsg
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

  } catch (error: any) {
    console.error('Concierge API Runtime Error:', error);
    return new Response(JSON.stringify({ 
      error: 'Intelligence Engine Offline',
      details: error.message || 'An unexpected server error occurred.'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
