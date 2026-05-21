'use server';
/**
 * @fileOverview An AI agent for triaging tenant maintenance requests.
 * Uses strict classification guidelines to ensure high-fidelity database integrity.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { gemini15Flash } from '@genkit-ai/google-genai';

const MaintenanceRequestTriageInputSchema = z.object({
  maintenanceRequest: z.string().describe("The tenant's description of the maintenance issue."),
});
export type MaintenanceRequestTriageInput = z.infer<typeof MaintenanceRequestTriageInputSchema>;

const MaintenanceRequestTriageOutputSchema = z.object({
  priority: z.enum(['critical', 'urgent', 'routine', 'low']).describe('The suggested priority level.'),
  category: z.enum(['plumbing', 'electrical', 'HVAC', 'appliance', 'structural', 'pest control', 'cosmetic', 'other']).describe('The suggested category.'),
  reasoning: z.string().describe('A brief explanation for the triage result.'),
});
export type MaintenanceRequestTriageOutput = z.infer<typeof MaintenanceRequestTriageOutputSchema>;

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function triageMaintenanceRequest(input: MaintenanceRequestTriageInput): Promise<MaintenanceRequestTriageOutput> {
  return maintenanceRequestTriageFlow(input);
}

const triageMaintenanceRequestPrompt = ai.definePrompt({
  name: 'triageMaintenanceRequestPrompt',
  model: gemini15Flash,
  input: { schema: MaintenanceRequestTriageInputSchema },
  output: { schema: MaintenanceRequestTriageOutputSchema },
  config: { 
    temperature: 0,
    topP: 0.1,
  },
  prompt: `You are an expert Property Operations Manager.
Triage the following resident maintenance request for professional resolution:

REQUEST: "{{{maintenanceRequest}}}"

CLASSIFICATION GUIDELINES:
- PRIORITY:
  * 'critical': Immediate danger, flood, fire risk, or total loss of heating/water.
  * 'urgent': Significant inconvenience or potential for asset damage (e.g. minor leaks, broken fridge).
  * 'routine': Standard repairs that do not impact safety.
  * 'low': Cosmetic issues.

- CATEGORIES: plumbing, electrical, HVAC, appliance, structural, pest control, cosmetic, other.

Output must be valid JSON matching the schema precisely.`,
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

    if (!input.maintenanceRequest || input.maintenanceRequest.trim().length < 5) {
      return {
        priority: 'routine',
        category: 'other',
        reasoning: "Insufficient detail for automated intelligence triage."
      };
    }

    while (retries > 0) {
      try {
        const { output } = await triageMaintenanceRequestPrompt(input);
        if (!output) throw new Error("Intelligence engine returned empty classification.");
        return output;
      } catch (error: any) {
        lastError = error;
        // Check for rate limit or transient service errors
        if (error.status === 429 || error.status === 500 || error.message?.includes('404')) {
          retries--;
          if (retries > 0) {
            await sleep(1500);
            continue;
          }
        }
        throw error;
      }
    }
    throw lastError || new Error("Asset Intelligence Engine failed to respond.");
  }
);
