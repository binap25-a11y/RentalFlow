
'use server';
/**
 * @fileOverview A property operations agent for triaging maintenance requests.
 *
 * - triageMaintenanceRequest - Analyzes a request and suggests priority/category.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { googleAI } from '@genkit-ai/google-genai';

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

const triagePrompt = ai.definePrompt({
  name: 'maintenanceRequestTriagePrompt',
  model: googleAI.model('gemini-2.0-flash'),
  input: { schema: MaintenanceRequestTriageInputSchema },
  output: { schema: MaintenanceRequestTriageOutputSchema },
  config: { temperature: 0 },
  prompt: `You are an expert Property Operations Manager. 
Triage the resident maintenance request and suggest the appropriate priority and category.

SCHEMA:
- priority: 'critical' (immediate danger), 'urgent' (damage risk), 'routine' (standard), 'low' (cosmetic).
- category: plumbing, electrical, HVAC, appliance, structural, pest control, cosmetic, other.
- reasoning: brief professional justification for the triage result.

Resident description: {{{maintenanceRequest}}}`,
});

export async function triageMaintenanceRequest(input: MaintenanceRequestTriageInput): Promise<MaintenanceRequestTriageOutput> {
  try {
    const { output } = await triagePrompt(input);
    if (!output) {
      throw new Error("Asset Intelligence Engine failed to generate triage classification.");
    }
    return output;
  } catch (error: any) {
    console.error("Maintenance Triage Flow Error:", error);
    throw new Error(`Triage engine offline: ${error.message}`);
  }
}
