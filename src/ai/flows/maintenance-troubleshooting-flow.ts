
'use server';
/**
 * @fileOverview An AI agent for troubleshooting issues before reporting.
 */

import { ai, googleAI } from '@/ai/genkit';
import { z } from 'zod';

const MaintenanceTroubleshootInputSchema = z.object({
  issueDescription: z.string().describe("The resident's description of the maintenance problem."),
});
export type MaintenanceTroubleshootInput = z.infer<typeof MaintenanceTroubleshootInputSchema>;

const MaintenanceTroubleshootOutputSchema = z.object({
  canSelfFix: z.boolean().describe('Whether the issue might be solvable by the resident.'),
  troubleshootingSteps: z.array(z.string()).describe('A list of simple steps to try before reporting.'),
  safetyWarning: z.string().optional().describe('Crucial safety warnings if they attempt a fix.'),
  encouragement: z.string().describe('A helpful message explaining why these steps save time.'),
});
export type MaintenanceTroubleshootOutput = z.infer<typeof MaintenanceTroubleshootOutputSchema>;

const troubleshootPrompt = ai.definePrompt({
  name: 'maintenanceTroubleshootPrompt',
  model: googleAI.model('gemini-2.0-flash'),
  input: { schema: MaintenanceTroubleshootInputSchema },
  output: { schema: MaintenanceTroubleshootOutputSchema },
  prompt: `You are 'Flow Support', an expert home maintenance assistant.
A resident has reported this issue: "{{{issueDescription}}}"

Suggest 3-4 simple, safe troubleshooting steps. 
ALWAYS include a clear safety warning if electricity, gas, or heavy water leaks are involved.
If the issue is obviously serious, set canSelfFix to false and provide immediate safety instructions.`,
});

export async function maintenanceTroubleshoot(input: MaintenanceTroubleshootInput): Promise<MaintenanceTroubleshootOutput> {
  try {
    const { output } = await troubleshootPrompt(input);
    if (!output) throw new Error("Troubleshooting engine offline.");
    return output;
  } catch (error: any) {
    if (error.message?.includes('429') || error.message?.includes('quota')) {
      return {
        canSelfFix: false,
        troubleshootingSteps: ["Check if neighbors have similar issues", "Look for isolated shut-off valves"],
        safetyWarning: "AI Assistant is busy. If there is gas or electricity danger, contact management immediately.",
        encouragement: "Please proceed with caution while our secondary support systems engage."
      };
    }
    throw error;
  }
}
