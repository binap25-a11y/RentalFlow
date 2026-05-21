import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * 🤖 Hardened Genkit Engine
 * Configured for high-fidelity property management intelligence.
 * Uses explicit plugin registration to ensure stable model routing.
 */
export const ai = genkit({
  plugins: [googleAI()],
});
