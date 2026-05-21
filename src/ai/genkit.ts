import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/google-genai';

/**
 * 🤖 Hardened Genkit Engine
 * Configured for high-fidelity property management intelligence.
 * Uses typed model references for maximum API stability across standard and beta versions.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash,
});
