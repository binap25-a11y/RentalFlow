
import { config } from 'dotenv';
config();

import '@/ai/flows/maintenance-request-triage.ts';
import '@/ai/flows/generate-inspection-report.ts';
import '@/ai/flows/summarize-lease-flow.ts';
import '@/ai/flows/tenant-concierge-flow.ts';
import '@/ai/flows/maintenance-troubleshooting-flow.ts';
