import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/google-genai';

/**
 * 🤖 Centralized Genkit Engine
 * Configured for high-fidelity property management intelligence.
 * Uses explicit model references for maximum cross-bundle stability.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash,
});
