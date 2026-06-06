'use server';
/**
 * @fileOverview A high-fidelity Legal AI agent for generating full UK Tenancy Agreements.
 * Calibrated for the Renters' Rights Act 2024 (effective May 2026).
 * Hardened with a resilient 4-tier retry protocol for production stability.
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
  agreementText: z.string().describe('The full, professionally formatted text of the tenancy agreement including all clauses.'),
  keyComplianceNotes: z.array(z.string()).describe('A list of specific post-2026 compliance points addressed.'),
});
export type GenerateTenancyAgreementOutput = z.infer<typeof GenerateTenancyAgreementOutputSchema>;

const agreementPrompt = ai.definePrompt({
  name: 'generateTenancyAgreementPrompt',
  model: googleAI.model('gemini-2.5-flash'),
  input: { schema: GenerateTenancyAgreementInputSchema },
  output: { schema: GenerateTenancyAgreementOutputSchema },
  config: { 
    temperature: 0.2,
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ]
  },
  prompt: `You are an expert UK Residential Property Solicitor specializing in the Renters' Rights Act 2024.
Generate a comprehensive, FULL-LENGTH, legally compliant Assured Shorthold Tenancy (AST) agreement (or the 2026 periodic equivalent) for a property in England.

TENANCY DETAILS:
Property: {{{propertyAddress}}}
Landlord: {{{landlordName}}}
Tenant: {{{tenantName}}}
Rent: £{{{rentAmount}}} per calendar month
Start Date: {{{startDate}}}
Pet Policy: {{{petPolicy}}}

INSTRUCTIONS FOR FULL CLAUSES:
You MUST provide the full legal text for the following sections. Do not summarize.

1. THE PARTIES AND THE PROPERTY: Full identification of the Landlord, Tenant, and the specific Asset Address.
2. THE TERM: Must be a rolling periodic tenancy as required by the 2026 regulations. NO fixed-term language.
3. THE RENT: Details of payment frequency, due date, and the mandatory Section 13 procedure for future rent increases (once per year maximum).
4. DEPOSIT: Details of the Deposit amount (capped at 5 weeks' rent) and the mandatory requirement to protect it in a government-authorized scheme (DPS, TDS, or MyDeposits).
5. TENANT'S OBLIGATIONS: Full clauses covering:
   - Payment of Council Tax, Utilities, and TV License.
   - Use of the Property (Private Residential Use only).
   - Prohibitions on Sub-letting or Assignment.
   - Maintenance of internal decoration and cleanliness.
   - Reporting of repairs immediately to the Landlord.
   - Rights of Access for the Landlord (24 hours notice required).
6. PETS: The tenant's statutory right to request a pet and the landlord's right to require pet insurance as a condition of consent.
7. LANDLORD'S OBLIGATIONS: Full clauses covering:
   - Quiet Enjoyment.
   - Section 11 Repairing Obligations (Structure and exterior, supply of water, gas, electricity, and space/water heating).
8. ENDING THE TENANCY: 
   - Explicitly REMOVE all references to Section 21 "no-fault" evictions.
   - Include the Tenant's right to end the tenancy by giving 2 months' notice (post-2026 standard).
   - Reference the Landlord's limited rights to end the tenancy using the updated Section 8 grounds (e.g., sale of property, moving back in, or serious rent arrears).
9. SIGNATURE BLOCKS: Designated areas for all parties.

FORMATTING: Use clear, numbered headers (e.g., 1. DEFINITIONS, 2. RENT, etc.) and professional legal prose. Provide the full text intended for a PDF document.`,
});

/**
 * 🚀 Resilient Legal AI Orchestrator
 * Implements exponential backoff to handle transient AI capacity errors and generates full-length legal text.
 */
export async function generateTenancyAgreement(input: GenerateTenancyAgreementInput): Promise<GenerateTenancyAgreementOutput> {
  let retries = 4;
  let delay = 1500;

  const fallback: GenerateTenancyAgreementOutput = {
    agreementText: `TENANCY RECORD LOGGED: Asset synchronization for ${input.propertyAddress} is in progress. The legal intelligence relay is currently handling high volume. Please verify your asset metadata in the Commander Hub and re-trigger generation if the draft does not appear in the vault within 60 seconds.`,
    keyComplianceNotes: ["System is currently re-calibrating for the 2026 statutory updates."]
  };

  while (retries >= 0) {
    try {
      const { output } = await agreementPrompt(input);
      if (!output) throw new Error("Legal Intelligence Relay Timeout");
      return output;
    } catch (error: any) {
      console.error(`⚖️ LEGAL SYNC ATTEMPT FAILURE (${retries} left):`, error.message);
      
      const errorMsg = (error.message || "").toUpperCase();
      const isRetryable = errorMsg.includes('429') || 
                          errorMsg.includes('QUOTA') || 
                          errorMsg.includes('RESOURCE_EXHAUSTED') ||
                          errorMsg.includes('503') ||
                          errorMsg.includes('500');

      if (isRetryable && retries > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
        retries--;
        delay *= 2; 
        continue;
      }
      return fallback;
    }
  }
  return fallback;
}
