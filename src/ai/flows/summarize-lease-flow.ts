
'use server';
/**
 * @fileOverview An AI agent for summarizing lease agreements.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const SummarizeLeaseInputSchema = z.object({
  documentText: z.string().describe("The raw text content of the lease agreement."),
});
export type SummarizeLeaseInput = z.infer<typeof SummarizeLeaseInputSchema>;

const SummarizeLeaseOutputSchema = z.object({
  rentAmount: z.number().describe("The monthly rent amount identified."),
  leaseStartDate: z.string().describe("The identified start date of the lease."),
  leaseEndDate: z.string().describe("The identified end date of the lease."),
  keyTerms: z.array(z.string()).describe("A list of key obligations or terms extracted."),
  summary: z.string().describe("A professional overview of the lease."),
});
export type SummarizeLeaseOutput = z.infer<typeof SummarizeLeaseOutputSchema>;

export async function summarizeLease(input: SummarizeLeaseInput): Promise<SummarizeLeaseOutput> {
  return summarizeLeaseFlow(input);
}

const summarizeLeasePrompt = ai.definePrompt({
  name: 'summarizeLeasePrompt',
  input: { schema: SummarizeLeaseInputSchema },
  output: { schema: SummarizeLeaseOutputSchema },
  prompt: `You are an expert legal AI specializing in UK residential property law.
Analyze the provided lease agreement text and extract the key financial and term-based details.

Document Content: {{{documentText}}}

Extract the monthly rent, start/end dates, and top 5 key terms/obligations. Provide a concise professional summary.`,
});

const summarizeLeaseFlow = ai.defineFlow(
  {
    name: 'summarizeLeaseFlow',
    inputSchema: SummarizeLeaseInputSchema,
    outputSchema: SummarizeLeaseOutputSchema,
  },
  async (input) => {
    const { output } = await summarizeLeasePrompt(input);
    return output!;
  }
);
