
'use server';
/**
 * @fileOverview A property operations agent powered by Groq (Llama 3.3).
 * 
 * - triageMaintenanceRequest - Analyzes a request and suggests priority/category.
 */

import OpenAI from "openai";
import { z } from 'genkit';

const client = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

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

/**
 * 🤖 Groq-Powered Triage Engine
 * Leverages Llama 3.3-70B for high-fidelity property operations analysis.
 */
export async function triageMaintenanceRequest(input: MaintenanceRequestTriageInput): Promise<MaintenanceRequestTriageOutput> {
  try {
    if (!input.maintenanceRequest || input.maintenanceRequest.trim().length < 5) {
      return {
        priority: 'routine',
        category: 'other',
        reasoning: "Insufficient detail for automated intelligence triage."
      };
    }

    const completion = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: `You are an expert Property Operations Manager. 
          Triage the resident maintenance request and return valid JSON.
          
          SCHEMA:
          - priority: 'critical' (immediate danger), 'urgent' (damage risk), 'routine' (standard), 'low' (cosmetic).
          - category: plumbing, electrical, HVAC, appliance, structural, pest control, cosmetic, other.
          - reasoning: brief professional justification.`,
        },
        {
          role: "user",
          content: input.maintenanceRequest,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const result = JSON.parse(completion.choices[0].message.content || "{}");
    
    // Validate output matches required schema for the UI
    return {
      priority: result.priority || 'routine',
      category: result.category || 'other',
      reasoning: result.reasoning || "Triage complete via Asset Intelligence Engine.",
    };
  } catch (error: any) {
    console.error("Groq AI Triage failure:", error.message);
    return {
      priority: 'routine',
      category: 'other',
      reasoning: "Asset Intelligence Engine temporarily unavailable. Defaulting to routine status."
    };
  }
}
