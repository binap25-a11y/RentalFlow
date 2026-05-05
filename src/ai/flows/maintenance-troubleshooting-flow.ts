'use server';
/**
 * @fileOverview An AI agent for troubleshooting issues with retry logic for 429 errors.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function maintenanceTroubleshoot(input: MaintenanceTroubleshootInput): Promise<MaintenanceTroubleshootOutput> {
  return maintenanceTroubleshootFlow(input);
}

const troubleshootPrompt = ai.definePrompt({
  name: 'maintenanceTroubleshootPrompt',
  input: { schema: MaintenanceTroubleshootInputSchema },
  output: { schema: MaintenanceTroubleshootOutputSchema },
  prompt: `You are 'Flow Support', an expert home maintenance assistant.
A resident has reported this issue: "{{{issueDescription}}}"

Your goal is to suggest 3-4 simple, safe troubleshooting steps they can take right now that might fix the problem without a professional call-out.
Examples: Resetting a trip switch, checking boiler pressure, bleeding a radiator, or checking if a plug is loose.

ALWAYS include a clear safety warning if electricity, gas, or heavy water leaks are involved.
If the issue is obviously serious (e.g., major flood, no heat in winter, electrical smoke), set canSelfFix to false and provide immediate safety instructions.`,
});

const maintenanceTroubleshootFlow = ai.defineFlow(
  {
    name: 'maintenanceTroubleshootFlow',
    inputSchema: MaintenanceTroubleshootInputSchema,
    outputSchema: MaintenanceTroubleshootOutputSchema,
  },
  async (input) => {
    let retries = 3;
    let lastError: any = null;

    while (retries > 0) {
      try {
        const { output } = await troubleshootPrompt(input);
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
