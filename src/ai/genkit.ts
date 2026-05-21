import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * 🤖 Centralized Genkit Engine
 * Configured for high-fidelity property management intelligence.
 * Uses explicit string identifiers to ensure stability across API versions.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});
