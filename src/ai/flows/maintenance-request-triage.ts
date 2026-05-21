'use server';
/**
 * @fileOverview A resilient property operations agent for triaging maintenance requests.
 * Includes deterministic fallback logic to handle API quota limits (429 errors).
 */

import { ai, googleAI } from '@/ai/genkit';
import { z } from 'zod';

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

/**
 * 🛡️ Deterministic Fallback Logic
 * Scanning for high-risk keywords when the AI engine is rate-limited.
 */
function getFallbackTriage(desc: string): MaintenanceRequestTriageOutput {
  const text = desc.toLowerCase();
  
  if (text.includes('fire') || text.includes('smoke') || text.includes('smell gas') || text.includes('spark')) {
    return { priority: 'critical', category: 'electrical', reasoning: 'Safety-critical indicators detected (Deterministic Fallback).' };
  }
  if (text.includes('flood') || text.includes('leak') || text.includes('burst')) {
    return { priority: 'urgent', category: 'plumbing', reasoning: 'Active water damage indicators detected (Deterministic Fallback).' };
  }
  if (text.includes('cold') || text.includes('boiler') || text.includes('heating')) {
    return { priority: 'routine', category: 'HVAC', reasoning: 'Climate control issue detected (Deterministic Fallback).' };
  }
  
  return { priority: 'routine', category: 'other', reasoning: 'Standard maintenance task classified via fail-safe logic.' };
}

export async function triageMaintenanceRequest(input: MaintenanceRequestTriageInput): Promise<MaintenanceRequestTriageOutput> {
  try {
    const { output } = await triagePrompt(input);
    if (!output) throw new Error("Empty AI response");
    return output;
  } catch (error: any) {
    const isQuotaError = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
    
    if (isQuotaError) {
      console.warn("AI Engine rate-limited. Activating deterministic fallback.");
      return getFallbackTriage(input.maintenanceRequest);
    }
    
    console.error("Maintenance Triage Flow Error:", error);
    throw new Error(`Triage engine offline: ${error.message}`);
  }
}
