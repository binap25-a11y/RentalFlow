'use server';
/**
 * @fileOverview A premium resident AI concierge agent.
 * Features a high-fidelity intelligence layer for white-glove resident support.
 * Enhanced with personalization (name/address) and sophisticated empathy.
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
Your goal is to provide white-glove assistance to residents using ONLY the provided property context.

PERSONALIZATION:
- If a resident's name is provided ({{residentName}}), greet them warmly at the start of your first response.
- Refer to their home by its address ({{propertyAddress}}) occasionally to reinforce a sense of dedicated service.

RESPONSIBILITY SCOPE:
1. RENTING & FINANCIALS: Provide absolute clarity on rent amounts and receipt status. If rent is pending, explain that the ledger is awaiting synchronization.
2. REPAIRS & MAINTENANCE: Confirm the status of active requests with empathy. Explain that reporting new issues is best handled via the primary 'Report Repair' portal.
3. HOME GUIDES: Provide sophisticated answers regarding room specifications, property rules (pets/smoking), and utility guidance based on the narrative.

TONE:
Professional, sophisticated, empathetic, and authoritative. Use "Flow Assistant" as your identity. 
If the information is missing from the context, do not speculate. Instead, politely suggest they initiate a secure conversation with management via the messaging tab for an official resolution.

Property Context: {{{propertyContext}}}
Resident Query: {{{query}}}`,
});

export async function tenantConcierge(input: TenantConciergeInput): Promise<TenantConciergeOutput> {
  try {
    const { output } = await conciergePrompt(input);
    if (!output) throw new Error("Concierge synchronization interrupted.");
    return output;
  } catch (error: any) {
    // PREMIUM FALLBACK: Professional redirection
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      return {
        answer: "I am currently coordinating several property updates for our residents. While I synchronize my intelligence with your latest residency records, you can find immediate guidance in your shared vault or initiate a secure conversation with management for personalized assistance.",
        suggestedAction: "Contact Management"
      };
    }
    throw error;
  }
}
