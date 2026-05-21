import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * 🤖 Hardened Genkit Engine
 * Configured for high-fidelity property management intelligence.
 * Uses explicit model references for maximum API stability across standard and beta versions.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});
