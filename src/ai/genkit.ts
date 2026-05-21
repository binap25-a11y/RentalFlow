
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * 🤖 Standard Genkit Engine
 * Configured for high-fidelity property management intelligence using Gemini 2.0 Flash.
 */
export const ai = genkit({
  plugins: [googleAI()],
});
