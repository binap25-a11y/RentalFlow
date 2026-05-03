
'use server';
/**
 * @fileOverview A resident AI concierge agent for answering property queries.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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

export async function tenantConcierge(input: TenantConciergeInput): Promise<TenantConciergeOutput> {
  return tenantConciergeFlow(input);
}

const tenantConciergePrompt = ai.definePrompt({
  name: 'tenantConciergePrompt',
  input: { schema: TenantConciergeInputSchema },
  output: { schema: TenantConciergeOutputSchema },
  prompt: `You are 'Flow', the AI Concierge for a modern rental property.
Your goal is to answer resident questions using ONLY the provided property context.
If the information is not in the context, politely suggest they contact their landlord or log a maintenance request.

Property Context: {{{propertyContext}}}
Resident Query: {{{query}}}`,
});

const tenantConciergeFlow = ai.defineFlow(
  {
    name: 'tenantConciergeFlow',
    inputSchema: TenantConciergeInputSchema,
    outputSchema: TenantConciergeOutputSchema,
  },
  async (input) => {
    const { output } = await tenantConciergePrompt(input);
    return output!;
  }
);
