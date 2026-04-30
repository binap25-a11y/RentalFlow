
'use server';
/**
 * @fileOverview An AI agent for generating professional property inspection reports.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const GenerateInspectionReportInputSchema = z.object({
  propertyAddress: z.string(),
  findings: z.string().describe("The landlord's raw notes from the inspection."),
});
export type GenerateInspectionReportInput = z.infer<typeof GenerateInspectionReportInputSchema>;

const GenerateInspectionReportOutputSchema = z.object({
  summary: z.string().describe('A professional summary of the property condition.'),
  priorityItems: z.array(z.string()).describe('A list of items requiring immediate attention.'),
  healthScore: z.number().min(0).max(100).describe('An overall property health score out of 100.'),
});
export type GenerateInspectionReportOutput = z.infer<typeof GenerateInspectionReportOutputSchema>;

export async function generateInspectionReport(input: GenerateInspectionReportInput): Promise<GenerateInspectionReportOutput> {
  return generateInspectionReportFlow(input);
}

const generateInspectionReportPrompt = ai.definePrompt({
  name: 'generateInspectionReportPrompt',
  input: { schema: GenerateInspectionReportInputSchema },
  output: { schema: GenerateInspectionReportOutputSchema },
  prompt: `You are an expert property surveyor.
Based on the following raw notes from a property inspection at {{{propertyAddress}}}, generate a professional, polished inspection report.

Landlord Findings: {{{findings}}}

Output a professional summary, a list of priority maintenance items, and an overall health score (0-100).`,
});

const generateInspectionReportFlow = ai.defineFlow(
  {
    name: 'generateInspectionReportFlow',
    inputSchema: GenerateInspectionReportInputSchema,
    outputSchema: GenerateInspectionReportOutputSchema,
  },
  async (input) => {
    const { output } = await generateInspectionReportPrompt(input);
    return output!;
  }
);
