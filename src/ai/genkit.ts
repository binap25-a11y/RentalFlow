import {genkit} from 'genkit';
import {googleAI} from '@genkit-ai/google-genai';

/**
 * 🤖 Centralized Genkit Engine
 * Configured for high-fidelity property management intelligence.
 * Using gemini-1.5-flash for optimal speed/accuracy balance.
 */
export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-1.5-flash',
});
