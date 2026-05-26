'use server';
/**
 * @fileOverview A premium resident AI concierge agent (Flow).
 * Features a conversational intelligence layer specialized in UK residential property.
 * Enhanced with Gemini 2.0 reasoning and natural, sophisticated linguistics.
 */

import { ai, googleAI } from '@/ai/genkit';
import { z } from 'zod';

const TenantConciergeInputSchema = z.object({
  query: z.string().describe("The resident's question."),
  residentName: z.string().optional().describe("The name of the resident for personalization."),
  propertyAddress: z.string().optional().describe("The full address of the property."),
  propertyContext: z.string().describe("Description and guides for the property, including current rental and repair ledger states."),
});
export type TenantConciergeInput = z.infer<typeof TenantConciergeInputSchema>;

const TenantConciergeOutputSchema = z.object({
  answer: z.string().describe("The helpful, personalized answer based on property context."),
  suggestedAction: z.string().optional().describe("A suggested next step, if applicable."),
});
export type TenantConciergeOutput = z.infer<typeof TenantConciergeOutputSchema>;

const conciergePrompt = ai.definePrompt({
  name: 'tenantConciergePrompt',
  model: googleAI.model('gemini-2.0-flash'),
  input: { schema: TenantConciergeInputSchema },
  output: { schema: TenantConciergeOutputSchema },
  config: { 
    temperature: 0.4,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ]
  },
  prompt: `You are 'Flow', the elite digital concierge for a high-fidelity luxury rental property in the UK.
Your primary goal is to provide a conversational, authoritative, and sophisticated experience for residents.

PERSONA & TONE:
- Identity: "Flow Concierge"
- Tone: Professional, sophisticated, empathetic, and uniquely British in its professional courtesy. 
- Style: Use natural, fluid linguistics. Avoid robotic lists; prefer sophisticated prose.
- Personalization: Greet residents warmly by name ({{residentName}}) and reference their home at {{propertyAddress}} when appropriate.

EXPERT KNOWLEDGE SCOPE (UK-SPECIFIC):
1. RENT & FINANCE: Provide absolute clarity on rent amounts and ledger status (paid/pending). Use terms like "ledger," "receipted," and "statement."
2. REPAIRS & MAINTENANCE: Acknowledge ongoing repairs with empathy. If they need to report a new issue, suggest the 'Report Repair' portal.
3. UK PROPERTY PROTOCOLS: Answer questions regarding Council Tax, EPC ratings, and standard UK AST obligations if provided in context.
4. HOME GUIDES: Use the provided description to explain home specifications (bedrooms, bathrooms, appliances).
5. SMALL TALK: If the user says "hello", "hi", or greets you, respond warmly and professionally as their concierge, then ask how you can assist their residency today.

CRITICAL INSTRUCTION: You MUST answer the user query accurately using the Property Context provided below. Do not use generic fallback language if the information exists.

Property Context: {{{propertyContext}}}
Resident Query: {{{query}}}`,
});

export async function tenantConcierge(input: TenantConciergeInput): Promise<TenantConciergeOutput> {
  let retries = 3;
  
  while (retries >= 0) {
    try {
      const { output } = await conciergePrompt(input);
      if (!output || !output.answer) throw new Error("Concierge synchronization interrupted.");
      return output;
    } catch (error: any) {
      const errorMsg = error.message || "";
      const isRetryable = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota') || errorMsg.includes('fetch failed');
      
      if (isRetryable && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries--;
        continue;
      }
      
      console.error("AI Concierge Failure:", error);
      return {
        answer: "I am currently coordinating with our property management systems to ensure I have your latest records. While I synchronize my intelligence, please feel free to greet me again or check your shared vault for immediate guidance.",
        suggestedAction: "Contact Management"
      };
    }
  }

  return {
    answer: "My apologies, I'm experiencing a brief synchronization delay. I'm ready to assist with your residency—please try your query once more in a moment.",
    suggestedAction: "Try Again"
  };
}
