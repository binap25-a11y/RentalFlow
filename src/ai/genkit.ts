import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * 🤖 Standard Genkit Engine
 * Configured for high-fidelity property management intelligence using Gemini 2.0 Flash.
 * Explicitly handles GEMINI_API_KEY vs GOOGLE_GENAI_API_KEY environment orchestration.
 */
export const ai = genkit({
  plugins: [
    googleAI({ 
      apiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY 
    })
  ],
});

export { googleAI };
