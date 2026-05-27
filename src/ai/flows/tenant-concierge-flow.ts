'use server';
/**
 * @fileOverview A premium resident AI concierge agent (Flow).
 * Features a real-time streaming intelligence layer specialized in UK residential property.
 * Enhanced with Gemini 2.0 Flash reasoning for maximum stability and UK linguistics.
 */

import { ai, googleAI } from '@/ai/genkit';
import { z } from 'zod';

const TenantConciergeInputSchema = z.object({
  query: z.string().describe("The resident's question."),
  residentName: z.string().optional().describe("The name of the resident for personalization."),
  propertyAddress: z.string().optional().describe("The full address of the property."),
  propertyContext: z.string().describe("Comprehensive context including rent, real-time repairs (Operational Ledger), connectivity, and compliance status."),
});
export type TenantConciergeInput = z.infer<typeof TenantConciergeInputSchema>;

const TenantConciergeOutputSchema = z.object({
  answer: z.string().describe("The helpful, personalized answer based on property context."),
  suggestedAction: z.string().optional().describe("A suggested next step, if applicable."),
});
export type TenantConciergeOutput = z.infer<typeof TenantConciergeOutputSchema>;

export const conciergePrompt = ai.definePrompt({
  name: 'tenantConciergePrompt',
  model: googleAI.model('gemini-2.0-flash'),
  input: { schema: TenantConciergeInputSchema },
  config: { 
    temperature: 0.7,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ]
  },
  prompt: `You are 'Flow', the elite digital concierge for high-fidelity luxury rental properties in the UK.
Your goal is to provide a conversational, authoritative, and deeply personalized experience.

CONVERSATIONAL PROTOCOLS:
- If the user says "hello", "hi", or other greetings, respond warmly and professionally, greeting them by name ({{residentName}}) if provided.
- Maintain a sophisticated, helpful tone at all times.
- Be concise but thorough.

PERSONA & TONE:
- Identity: "Flow Concierge"
- Tone: Professional, sophisticated, empathetic, and uniquely British. Use terms like "ledger," "tenancy," and "vault."
- Style: Natural, flowing prose. Reference their home at {{propertyAddress}} naturally.

EXPERT KNOWLEDGE SCOPE:
1. RENT & FINANCE: Provide absolute clarity on rent amounts and real-time ledger status from the context.
2. REPAIRS & OPERATIONAL LEDGER: You possess full awareness of notified repairs. If the resident asks about a status, look for it in the Operational Ledger provided in the context. Acknowledge dates, priority, and progress with empathy.
3. UK COMPLIANCE: Answer questions regarding Council Tax, EPC ratings, and connectivity (Fiber status) using the provided context.
4. UK PROTOCOLS: You understand AST (Assured Shorthold Tenancies), Deposit Protection (DPS), and local UK council interactions.

CRITICAL: Use the property context below as your absolute source of truth. If information about a repair (like a 'door repair') is present in the Operational Ledger, tell them its status. If not, guide them to report a new issue.

Property Context: {{{propertyContext}}}
Resident Query: {{{query}}}`,
});

/**
 * 🚀 Standard Wrapper (Non-Streaming)
 */
export async function tenantConcierge(input: TenantConciergeInput): Promise<TenantConciergeOutput> {
  try {
    const { text } = await ai.generate(conciergePrompt(input));
    return { answer: text || "I am currently coordinating several property updates. Please try again in a moment." };
  } catch (error) {
    console.error("AI Concierge Failure:", error);
    return {
      answer: "My apologies, I'm experiencing a brief synchronization delay. I'm ready to assist with your residency—please try your query once more in a moment.",
      suggestedAction: "Try Again"
    };
  }
}
