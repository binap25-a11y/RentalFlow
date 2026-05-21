
'use server';
/**
 * @fileOverview A resident AI concierge agent.
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
  prompt: `You are 'Flow', the AI Concierge for a modern rental property.
Your goal is to answer resident questions using ONLY the provided property context.
If the information is not in the context, politely suggest they contact their landlord or log a maintenance request.

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
        answer: "I'm currently assisting many residents. For immediate property questions, please check your shared documents or message management.",
        suggestedAction: "Contact Management"
      };
    }
    throw error;
  }
}
