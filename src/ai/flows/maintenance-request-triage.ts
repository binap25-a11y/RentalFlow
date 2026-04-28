'use server';
/**
 * @fileOverview An AI agent for triaging tenant maintenance requests.
 *
 * - triageMaintenanceRequest - A function that handles the maintenance request triage process.
 * - MaintenanceRequestTriageInput - The input type for the triageMaintenanceRequest function.
 * - MaintenanceRequestTriageOutput - The return type for the triageMaintenanceRequest function.
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
    const { output } = await triageMaintenanceRequestPrompt(input);
    return output!;
  }
);
