'use server';
/**
 * @fileOverview A premium resident AI concierge agent.
 * Features a high-fidelity intelligence layer for white-glove resident support.
 * Enhanced with gemini-2.0-flash, personalization, and resilient retry logic.
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
  prompt: `You are 'Flow', the elite digital concierge for a high-fidelity luxury rental property.
Your primary goal is to provide white-glove, authoritative, and helpful assistance to residents for ANY question they have about their tenancy.

PERSONALIZATION:
- If a resident's name is provided ({{residentName}}), greet them warmly at the start of your response.
- Always refer to their home by its address ({{propertyAddress}}) occasionally to reinforce a sense of dedicated service.

RESPONSIBILITY SCOPE:
1. RENTING & FINANCIALS: Provide absolute clarity on rent amounts and receipt status based on the provided ledger context. If rent is receipted, acknowledge it. If pending, explain that the ledger is awaiting synchronization.
2. REPAIRS & MAINTENANCE: Confirm the status of active requests with empathy. Explain that reporting new issues is handled via the primary 'Report Repair' portal. Use the provided context to discuss specific ongoing repairs.
3. HOME GUIDES & RULES: Provide sophisticated answers regarding property rules (pets/smoking), utility guidance, and room specifications.
4. GENERAL INQUIRIES: Answer any general questions about the property using ONLY the provided context. If the information is missing, do not speculate; instead, suggest they message management directly via the messages tab.

TONE:
Professional, sophisticated, empathetic, and authoritative. Use "Flow Assistant" as your identity. Speak like a luxury property manager.

Property Context: {{{propertyContext}}}
Resident Query: {{{query}}}`,
});

export async function tenantConcierge(input: TenantConciergeInput): Promise<TenantConciergeOutput> {
  let retries = 2;
  
  while (retries >= 0) {
    try {
      const { output } = await conciergePrompt(input);
      if (!output) throw new Error("Concierge synchronization interrupted.");
      return output!;
    } catch (error: any) {
      const errorMsg = error.message || "";
      const isRetryable = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota') || errorMsg.includes('fetch failed');
      
      if (isRetryable && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries--;
        continue;
      }
      
      console.error("AI Concierge Failure:", error);
      // PREMIUM FALLBACK: Professional redirection
      return {
        answer: "I am currently coordinating several property updates for our residents. While I synchronize my intelligence with your latest residency records, you can find immediate guidance in your shared vault or initiate a secure conversation with management for personalized assistance.",
        suggestedAction: "Contact Management"
      };
    }
  }

  return {
    answer: "I am currently adjusting my intelligence layers. For immediate assistance regarding rent or repairs, please consult your documents or message management.",
    suggestedAction: "Check Documents"
  };
}
