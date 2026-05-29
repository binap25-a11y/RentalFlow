import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

/**
 * 🤖 Standard Genkit Engine
 * Configured for high-fidelity property management intelligence.
 * Updated to use Gemini 2.5 Flash for production stability.
 */
export const ai = genkit({
  plugins: [
    googleAI({ 
      apiKey: process.env.GOOGLE_GENAI_API_KEY || process.env.GEMINI_API_KEY
    })
  ],
  model: googleAI.model('gemini-2.5-flash'),
});

export { googleAI };
