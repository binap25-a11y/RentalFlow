import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/google-genai';

/**
 * 🤖 Centralized Genkit Engine
 * Configured for high-fidelity property management intelligence.
 * Uses the official plugin model reference for maximum stability.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash,
});
