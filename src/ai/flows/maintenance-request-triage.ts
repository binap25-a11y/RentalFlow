'use server';
/**
 * @fileOverview A resilient property operations agent for triaging maintenance requests.
 * Includes deterministic fallback logic and actionable suggestions.
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
  suggestions: z.array(z.string()).describe('2-3 specific, professional next steps for the landlord to resolve this issue.'),
});
export type MaintenanceRequestTriageOutput = z.infer<typeof MaintenanceRequestTriageOutputSchema>;

const triagePrompt = ai.definePrompt({
  name: 'maintenanceRequestTriagePrompt',
  model: googleAI.model('gemini-2.0-flash'),
  input: { schema: MaintenanceRequestTriageInputSchema },
  output: { schema: MaintenanceRequestTriageOutputSchema },
  config: { temperature: 0 },
  prompt: `You are an expert Property Operations Manager. 
Triage the resident maintenance request and suggest the appropriate priority, category, and specific professional suggestions for resolution.

SCHEMA:
- priority: 'critical' (immediate danger), 'urgent' (damage risk), 'routine' (standard), 'low' (cosmetic).
- category: plumbing, electrical, HVAC, appliance, structural, pest control, cosmetic, other.
- reasoning: brief professional justification for the triage result.
- suggestions: 2-3 professional actions (e.g., "Instruct an NICEIC electrician", "Verify isolation valve location").

Resident description: {{{maintenanceRequest}}}`,
});

/**
 * 🛡️ Hardened Operational Fallback Logic
 * Used when API limits are reached to maintain property safety records.
 */
function getFallbackTriage(desc: string): MaintenanceRequestTriageOutput {
  const text = (desc || "").toLowerCase();
  
  if (text.includes('fire') || text.includes('smoke') || text.includes('smell gas') || text.includes('spark') || text.includes('burning')) {
    return { 
      priority: 'critical', 
      category: 'electrical', 
      reasoning: 'Critical safety indicators (fire/gas/sparks) identified. Primary emergency response required.',
      suggestions: ["Instruct the resident to evacuate immediately", "Contact emergency services (999)", "Instruct emergency contractor for immediate attendance"]
    };
  }
  if (text.includes('flood') || text.includes('leak') || text.includes('burst') || text.includes('pouring') || text.includes('gush')) {
    return { 
      priority: 'urgent', 
      category: 'plumbing', 
      reasoning: 'Active water damage indicators identified. Immediate containment necessary.',
      suggestions: ["Instruct resident to locate and close main stopcock", "Instruct emergency plumber for same-day repair", "Assess for impact on internal structural integrity"]
    };
  }
  if (text.includes('lock') || text.includes('door') || text.includes('security') || text.includes('broken window')) {
    return { 
      priority: 'urgent', 
      category: 'structural', 
      reasoning: 'Property security indicators identified. Immediate secure and restore protocols initiated.',
      suggestions: ["Instruct emergency locksmith to secure property entry points", "Obtain police incident number for insurance records", "Assess for forensic evidence before cleaning or restoration"]
    };
  }
  
  return { 
    priority: 'routine', 
    category: 'other', 
    reasoning: 'Standard maintenance task identified via operational safety records.',
    suggestions: ["Schedule inspection during standard working hours", "Obtain quotes from authorized trade partners", "Update resident on expected resolution timeline"]
  };
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
        await new Promise(resolve => setTimeout(resolve, 2000));
        retries--;
        continue;
      }
      
      if (isQuotaError || errorMsg.includes('500')) {
        return getFallbackTriage(input.maintenanceRequest);
      }
      
      return getFallbackTriage(input.maintenanceRequest);
    }
  }
  
  return getFallbackTriage(input.maintenanceRequest);
}
