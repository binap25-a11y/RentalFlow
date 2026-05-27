import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * 🤖 Standard Genkit Engine
 * Configured for high-fidelity property management intelligence.
 * Hardened to use provided Gemini API Key with zero-latency failover.
 */
export const ai = genkit({
  plugins: [
    googleAI({ 
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY || 'AIzaSyAtSuJUp7grUeDfLmuFZeax3_MFUzaVxeM'
    })
  ],
});

export { googleAI };