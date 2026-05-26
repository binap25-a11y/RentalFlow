'use server';
/**
 * @fileOverview A resident AI concierge agent.
 * Features a high-fidelity fallback mechanism for premium resident support.
 * Enhanced to handle renting and repair inquiries with authoritative context.
 */

import { ai, googleAI } from '@/ai/genkit';
import { z } from 'zod';

const TenantConciergeInputSchema = z.object({
  query: z.string().describe("The resident's question."),
  propertyContext: z.string().describe("Description and guides for the property."),
});
export type TenantConciergeInput = z.infer<typeof TenantConciergeInputSchema>;

const TenantConciergeOutputSchema = z.object({
  answer: z.string().describe("The helpful answer based on property context."),
  suggestedAction: z.string().optional().describe("A suggested next step, if applicable."),
});
export type TenantConciergeOutput = z.infer<typeof TenantConciergeOutputSchema>;

const conciergePrompt = ai.definePrompt({
  name: 'tenantConciergePrompt',
  model: googleAI.model('gemini-2.0-flash'),
  input: { schema: TenantConciergeInputSchema },
  output: { schema: TenantConciergeOutputSchema },
  prompt: `You are 'Flow', the elite AI Concierge for a modern rental property.
Your goal is to answer resident questions using ONLY the provided property context.

You must be highly responsive to questions regarding:
1. RENTING: Rent amounts, payment status, and lease obligations mentioned in the context.
2. REPAIRS: How to report issues and the importance of maintenance upkeep.
3. GUIDES: Specific details about bedrooms, bathrooms, and property narratives.

If the information is not in the context, politely suggest they message management directly via the secure messaging tab.

Property Context: {{{propertyContext}}}
Resident Query: {{{query}}}`,
});

export async function tenantConcierge(input: TenantConciergeInput): Promise<TenantConciergeOutput> {
  try {
    const { output } = await conciergePrompt(input);
    if (!output) throw new Error("Concierge offline.");
    return output;
  } catch (error: any) {
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      return {
        answer: "Our intelligence systems are currently experiencing high volume while assisting other residents. For immediate guidance on property protocols, please consult your shared vault documents or initiate a secure conversation with management via the messages tab.",
        suggestedAction: "Contact Management"
      };
    }
    throw error;
  }
}
