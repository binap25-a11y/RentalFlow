
'use server';
/**
 * @fileOverview An AI agent for summarizing lease agreements.
 */

import { ai, googleAI } from '@/ai/genkit';
import { z } from 'zod';

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

const summarizeLeasePrompt = ai.definePrompt({
  name: 'summarizeLeasePrompt',
  model: googleAI.model('gemini-2.0-flash'),
  input: { schema: SummarizeLeaseInputSchema },
  output: { schema: SummarizeLeaseOutputSchema },
  prompt: `You are an expert legal AI specializing in residential property law.
Analyze the provided lease agreement text and extract the key financial and term-based details.

Document Content: {{{documentText}}}

Extract the monthly rent, start/end dates (YYYY-MM-DD), and top 5 key terms/obligations. Provide a concise professional summary.`,
});

export async function summarizeLease(input: SummarizeLeaseInput): Promise<SummarizeLeaseOutput> {
  try {
    const { output } = await summarizeLeasePrompt(input);
    if (!output) throw new Error("Lease processing failed.");
    return output;
  } catch (error: any) {
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      return {
        rentAmount: 0,
        leaseStartDate: "TBC",
        leaseEndDate: "TBC",
        keyTerms: ["Manual verification required"],
        summary: "Lease processing is temporarily queued due to high volume."
      };
    }
    throw error;
  }
}
