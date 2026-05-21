
'use server';
/**
 * @fileOverview A resilient property operations agent for triaging maintenance requests.
 * Includes deterministic fallback logic and exponential backoff to handle API quota limits.
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
 * 🛡️ Hardened Deterministic Fallback Logic
 * Scanning for high-risk keywords when the AI engine is rate-limited or offline.
 */
function getFallbackTriage(desc: string): MaintenanceRequestTriageOutput {
  const text = (desc || "").toLowerCase();
  
  if (text.includes('fire') || text.includes('smoke') || text.includes('smell gas') || text.includes('spark') || text.includes('burning')) {
    return { priority: 'critical', category: 'electrical', reasoning: 'Safety-critical indicators (fire/gas/sparks) detected. Immediate response required (Deterministic Fallback).' };
  }
  if (text.includes('flood') || text.includes('leak') || text.includes('burst') || text.includes('pouring') || text.includes('gush')) {
    return { priority: 'urgent', category: 'plumbing', reasoning: 'Active water damage indicators detected. Urgent intervention required (Deterministic Fallback).' };
  }
  if (text.includes('cold') || text.includes('boiler') || text.includes('heating') || text.includes('no hot water')) {
    return { priority: 'routine', category: 'HVAC', reasoning: 'Climate control or hot water issue detected. Scheduled technician visit required (Deterministic Fallback).' };
  }
  if (text.includes('lock') || text.includes('door') || text.includes('security') || text.includes('broken window')) {
    return { priority: 'urgent', category: 'structural', reasoning: 'Property security indicators detected (Deterministic Fallback).' };
  }
  if (text.includes('fridge') || text.includes('oven') || text.includes('cooker') || text.includes('washing machine')) {
    return { priority: 'routine', category: 'appliance', reasoning: 'Essential appliance failure detected (Deterministic Fallback).' };
  }
  
  return { priority: 'routine', category: 'other', reasoning: 'Standard maintenance task classified via fail-safe logic ledger.' };
}

export async function triageMaintenanceRequest(input: MaintenanceRequestTriageInput): Promise<MaintenanceRequestTriageOutput> {
  let retries = 2;
  
  if (!input.maintenanceRequest || input.maintenanceRequest.trim().length < 5) {
    return getFallbackTriage(input.maintenanceRequest);
  }

  while (retries >= 0) {
    try {
      const { output } = await triagePrompt(input);
      if (!output) throw new Error("Intelligence engine returned empty classification.");
      return output;
    } catch (error: any) {
      const errorMsg = error.message || "";
      const isQuotaError = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || errorMsg.includes('quota');
      
      if (isQuotaError && retries > 0) {
        console.warn(`AI Engine rate-limited. Retrying... (${retries} left)`);
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries--;
        continue;
      }
      
      if (isQuotaError || errorMsg.includes('500')) {
        console.warn("AI Engine offline or limited. Activating deterministic fallback.");
        return getFallbackTriage(input.maintenanceRequest);
      }
      
      console.error("Maintenance Triage Flow Error:", error);
      // Even for general errors, fallback is better than a crash in a property operations context
      return getFallbackTriage(input.maintenanceRequest);
    }
  }
  
  return getFallbackTriage(input.maintenanceRequest);
}
