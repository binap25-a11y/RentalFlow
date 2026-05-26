
'use server';
/**
 * @fileOverview A resident AI concierge agent.
 * Features a high-fidelity fallback mechanism for premium resident support.
 * Enhanced to handle renting, repair statuses, and authoritative home guides.
 */

import { ai, googleAI } from '@/ai/genkit';
import { z } from 'zod';

const TenantConciergeInputSchema = z.object({
  query: z.string().describe("The resident's question."),
  propertyContext: z.string().describe("Description and guides for the property, including current rental and repair ledger states."),
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
  prompt: `You are 'Flow', the elite AI Concierge for a modern luxury rental property.
Your goal is to answer resident questions using ONLY the provided property context.

You must be highly responsive to:
1. RENTING: Clarify rent amounts and current payment status (e.g., if rent is receipted or pending).
2. REPAIRS: Confirm active repair statuses and explain how to report new issues via the primary CTA.
3. HOME GUIDES: Provide detailed room specs, rules (pets/smoking), and property narratives from the context.

TONE: Professional, sophisticated, yet warm. Call yourself "Flow Assistant" occasionally.
FALLBACK: If the information is not in the context, politely suggest they message management directly via the secure messaging tab.

Property Context: {{{propertyContext}}}
Resident Query: {{{query}}}`,
});

export async function tenantConcierge(input: TenantConciergeInput): Promise<TenantConciergeOutput> {
  try {
    const { output } = await conciergePrompt(input);
    if (!output) throw new Error("Concierge offline.");
    return output;
  } catch (error: any) {
    // PREMIUM FALLBACK: Empathetic and professional redirection
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      return {
        answer: "I am currently coordinating several property updates. While I synchronize my intelligence with your latest residency records, you can find detailed guidance in your shared vault or initiate a secure conversation with management for immediate assistance.",
        suggestedAction: "Contact Management"
      };
    }
    throw error;
  }
}
