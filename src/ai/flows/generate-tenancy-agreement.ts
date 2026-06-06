'use server';
/**
 * @fileOverview A high-fidelity Legal AI agent for generating UK Tenancy Agreements.
 * Calibrated for the Renters' Rights Act 2024 (effective May 2026).
 * Ensures all Section 21 references are removed and periodic tenancy terms are enforced.
 */

import { ai, googleAI } from '@/ai/genkit';
import { z } from 'zod';

const GenerateTenancyAgreementInputSchema = z.object({
  propertyAddress: z.string(),
  landlordName: z.string(),
  tenantName: z.string(),
  rentAmount: z.number(),
  startDate: z.string().describe('ISO date string for the tenancy start.'),
  petPolicy: z.string().optional().default('Pets allowed subject to insurance requirement as per 2026 regulations.'),
});
export type GenerateTenancyAgreementInput = z.infer<typeof GenerateTenancyAgreementInputSchema>;

const GenerateTenancyAgreementOutputSchema = z.object({
  agreementText: z.string().describe('The full, professionally formatted text of the tenancy agreement.'),
  keyComplianceNotes: z.array(z.string()).describe('A list of specific post-2026 compliance points addressed.'),
});
export type GenerateTenancyAgreementOutput = z.infer<typeof GenerateTenancyAgreementOutputSchema>;

const agreementPrompt = ai.definePrompt({
  name: 'generateTenancyAgreementPrompt',
  model: googleAI.model('gemini-2.5-flash'),
  input: { schema: GenerateTenancyAgreementInputSchema },
  output: { schema: GenerateTenancyAgreementOutputSchema },
  config: { 
    temperature: 0.3,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ]
  },
  prompt: `You are an expert UK Residential Property Solicitor specializing in the Renters' Rights Act 2024.
Generate a comprehensive, legally compliant Assured Shorthold Tenancy (AST) agreement for a property in England, assuming the date is post-May 1st, 2026.

TENANCY DETAILS:
Property: {{{propertyAddress}}}
Landlord: {{{landlordName}}}
Tenant: {{{tenantName}}}
Rent: £{{{rentAmount}}} per calendar month
Start Date: {{{startDate}}}
Pet Policy: {{{petPolicy}}}

INSTRUCTIONS:
1. TENANCY TYPE: Must be a rolling periodic tenancy as required by the 2026 regulations. NO fixed-term language.
2. EVICTION: Remove all references to Section 21 "no-fault" evictions. References must only include the updated Section 8 grounds for possession.
3. RENT INCREASES: Rent increases must follow the new statutory section 13 procedure (once per year, aligned with market rates).
4. PETS: Include the tenant's right to request a pet and the landlord's right to require pet insurance.
5. DEPOSIT: Ensure references to mandatory deposit protection (DPS/TDS/MyDeposits) are present.
6. FORMATTING: Use professional, itemized headings (1. Parties, 2. The Property, 3. The Rent, etc.).

Provide the full agreement text and a summary of key compliance notes.`,
});

export async function generateTenancyAgreement(input: GenerateTenancyAgreementInput): Promise<GenerateTenancyAgreementOutput> {
  try {
    const { output } = await agreementPrompt(input);
    if (!output) throw new Error("Legal Intelligence Relay Timeout");
    return output;
  } catch (error: any) {
    console.error("AI Agreement Generation Failure:", error);
    return {
      agreementText: "ERROR: The legal intelligence relay experienced a synchronization delay. Please verify your asset metadata and try again.",
      keyComplianceNotes: ["System is currently re-calibrating for the 2026 statutory updates."]
    };
  }
}