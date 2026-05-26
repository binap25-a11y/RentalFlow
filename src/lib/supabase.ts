/**
 * @fileOverview Supabase Client Initialization.
 * Synchronized with the verified production project: wgezhbkkhamaawxgcqjf.
 */

import { createClient } from '@supabase/supabase-js';

// Verified production project URL for wgezhbkkhamaawxgcqjf
const supabaseUrl = 'https://wgezhbkkhamaawxgcqjf.supabase.co';

/**
 * 🔐 Resilient Key Orchestration
 * Using the high-fidelity production anon key provided by the user.
 */
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZXpoYmtraGFtYWF3eGdjcWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDM2NzEsImV4cCI6MjA5NTMxOTY3MX0.-wY09av9EQpPdeao5mi-BZXDflC0jzTVwfsxWWhINX4';

/**
 * 🔐 Clean Storage Client
 * Strictly disables session persistence to prevent JWT signature conflicts 
 * during server-side binary orchestration.
 */
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);
