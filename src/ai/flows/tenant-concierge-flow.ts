'use server';
/**
 * @fileOverview A resident AI concierge agent with retry logic for 429 errors.
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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

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
    let retries = 3;
    let lastError: any = null;

    while (retries > 0) {
      try {
        const { output } = await tenantConciergePrompt(input);
        if (!output) throw new Error("No output generated");
        return output;
      } catch (error: any) {
        lastError = error;
        if (error.status === 429 || error.message?.includes('429')) {
          retries--;
          if (retries > 0) {
            await sleep(2000);
            continue;
          }
        }
        throw error;
      }
    }
    throw lastError || new Error("Max retries exceeded");
  }
);
