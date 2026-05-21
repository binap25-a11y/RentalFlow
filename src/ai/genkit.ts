import { genkit } from 'genkit';
import { googleAI, gemini15Flash } from '@genkit-ai/google-genai';

/**
 * 🤖 Centralized Genkit Engine
 * Configured for high-fidelity property management intelligence.
 * Hardened for stable model initialization and classification.
 * Uses gemini15Flash reference to ensure API compatibility.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: gemini15Flash,
});
