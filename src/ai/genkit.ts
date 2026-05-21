import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * 🤖 Hardened Genkit Engine
 * Configured for high-fidelity property management intelligence.
 * Standardized for stable model routing and cross-flow compatibility.
 */
export const ai = genkit({
  plugins: [googleAI()],
});
