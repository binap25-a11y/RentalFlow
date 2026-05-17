'use server';
/**
 * @fileOverview An AI agent for triaging tenant maintenance requests with retry logic.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MaintenanceRequestTriageInputSchema = z.object({
  maintenanceRequest: z.string().describe("The tenant's description of the maintenance issue."),
});
export type MaintenanceRequestTriageInput = z.infer<typeof MaintenanceRequestTriageInputSchema>;

const MaintenanceRequestTriageOutputSchema = z.object({
  priority: z.enum(['critical', 'urgent', 'routine', 'low']).describe('The suggested priority level for the maintenance request.'),
  category: z.enum(['plumbing', 'electrical', 'HVAC', 'appliance', 'structural', 'pest control', 'cosmetic', 'other']).describe('The suggested category for the maintenance issue.'),
  reasoning: z.string().describe('A brief explanation for the suggested priority and category.'),
});
export type MaintenanceRequestTriageOutput = z.infer<typeof MaintenanceRequestTriageOutputSchema>;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function triageMaintenanceRequest(input: MaintenanceRequestTriageInput): Promise<MaintenanceRequestTriageOutput> {
  return maintenanceRequestTriageFlow(input);
}

const triageMaintenanceRequestPrompt = ai.definePrompt({
  name: 'triageMaintenanceRequestPrompt',
  input: { schema: MaintenanceRequestTriageInputSchema },
  output: { schema: MaintenanceRequestTriageOutputSchema },
  prompt: `You are an AI assistant for a landlord, specialized in triaging tenant maintenance requests.
Your task is to analyze the provided maintenance request from a tenant and suggest an appropriate priority level and category for the issue.

Priority levels can be: 'critical' (immediate danger, major damage), 'urgent' (requires prompt attention, significant inconvenience), 'routine' (standard repair, minor inconvenience), 'low' (cosmetic, non-essential).

Categories can be: 'plumbing', 'electrical', 'HVAC', 'appliance', 'structural', 'pest control', 'cosmetic', 'other'.

Provide a brief reasoning for your suggested priority and category.

Maintenance Request: {{{maintenanceRequest}}}`,
});

const maintenanceRequestTriageFlow = ai.defineFlow(
  {
    name: 'maintenanceRequestTriageFlow',
    inputSchema: MaintenanceRequestTriageInputSchema,
    outputSchema: MaintenanceRequestTriageOutputSchema,
  },
  async (input) => {
    let retries = 3;
    let lastError: any = null;

    while (retries > 0) {
      try {
        const { output } = await triageMaintenanceRequestPrompt(input);
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
