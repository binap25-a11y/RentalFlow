import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * 🤖 Hardened Genkit Engine
 * Configured for high-fidelity property management intelligence.
 * Using stable plugin registration to prevent model routing mismatches.
 */
export const ai = genkit({
  plugins: [googleAI()],
});
