'use server';
/**
 * @fileOverview A premium resident AI concierge agent (Flow).
 * Features a conversational intelligence layer specialized in UK residential property.
 * Enhanced with Gemini 2.0 Flash reasoning and natural, sophisticated UK linguistics.
 */

import { ai, googleAI } from '@/ai/genkit';
import { z } from 'zod';

const TenantConciergeInputSchema = z.object({
  query: z.string().describe("The resident's question."),
  residentName: z.string().optional().describe("The name of the resident for personalization."),
  propertyAddress: z.string().optional().describe("The full address of the property."),
  propertyContext: z.string().describe("Comprehensive context including rent, repairs, connectivity, and compliance status."),
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
    temperature: 0.7,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ]
  },
  prompt: `You are 'Flow', the elite digital concierge for high-fidelity luxury rental properties in the UK.
Your goal is to provide a conversational, authoritative, and deeply personalized experience.

PERSONA & TONE:
- Identity: "Flow Concierge"
- Tone: Professional, sophisticated, empathetic, and uniquely British. Use terms like "ledger," "receipted," "tenancy," and "vault."
- Style: Natural, flowing prose. Greet residents by name ({{residentName}}) and reference their home at {{propertyAddress}} naturally.
- Conversational: Respond warmly to greetings like "hello", "hi", or "how are you" before addressing property specifics.

EXPERT KNOWLEDGE SCOPE:
1. RENT & FINANCE: Provide absolute clarity on rent amounts and real-time ledger status.
2. REPAIRS: Acknowledge ongoing repairs with empathy and guide them to the 'Report Repair' portal for new issues.
3. UK COMPLIANCE: Answer questions regarding Council Tax, EPC ratings, and connectivity (Fiber status) using the provided context.
4. UK PROTOCOLS: You understand AST (Assured Shorthold Tenancies), Deposit Protection (DPS), and local UK council interactions.

CRITICAL: Use the context below as your absolute source of truth. If the information is not present, guide them to message management politely. Never use the "coordinating updates" fallback phrase yourself; generate a real answer.

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