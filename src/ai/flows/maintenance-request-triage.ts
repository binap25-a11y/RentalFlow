'use server';
/**
 * @fileOverview An AI agent for triaging tenant maintenance requests with retry logic.
 * Ensures strict adherence to classification schemas for database integrity.
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
  prompt: `You are an expert Property Operations Manager.
Your task is to triage a resident maintenance request and categorize it for professional resolution.

GUIDELINES:
- PRIORITY:
  * 'critical': Immediate danger, major structural damage, or complete loss of essential services (gas, water, heat in winter).
  * 'urgent': Significant inconvenience or potential for damage if not addressed soon (e.g., minor leaks, appliance failure).
  * 'routine': Standard repairs that do not impact safety or habitability.
  * 'low': Cosmetic issues or non-essential maintenance.

- CATEGORIES: plumbing, electrical, HVAC, appliance, structural, pest control, cosmetic, other.

REQUEST: "{{{maintenanceRequest}}}"

Respond strictly with valid JSON that follows the schema. Do not include markdown formatting or conversational filler.`,
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

    if (!input.maintenanceRequest || input.maintenanceRequest.length < 5) {
      return {
        priority: 'routine',
        category: 'other',
        reasoning: "Insufficient detail provided for automated triage. Defaulting to routine review."
      };
    }

    while (retries > 0) {
      try {
        const { output } = await triageMaintenanceRequestPrompt(input);
        if (!output) throw new Error("AI engine returned null output");
        return output;
      } catch (error: any) {
        lastError = error;
        // Handle rate limits or temporary model instability
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
    throw lastError || new Error("Asset Intelligence Engine failed to respond.");
  }
);
