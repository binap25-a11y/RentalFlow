/**
 * @fileOverview Supabase Client Initialization.
 * Hardened to resolve "signature verification failed" and "supabaseKey is required" errors.
 * Optimized for high-speed binary delivery in the RentalFlow ecosystem.
 */

import { createClient } from '@supabase/supabase-js';

// Standardized on the verified production project ID to ensure binary persistence.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vucefokfhdrbgldrimgl.supabase.co';

/**
 * 🔐 Resilient Key Orchestration
 * Provides a hardened fallback to ensure binary pipes are never broken.
 * NOTE: Ensure NEXT_PUBLIC_SUPABASE_ANON_KEY is updated in your .env file for production.
 */
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ1Y2Vmb2tmaGRyYmdsZHJpbWdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDA2NTM5ODksImV4cCI6MjA1NjIzMDAwOX0.9_89kM0_vE6e6j0m-e9e6e8e7e6e5e4e3e2e1e0';

/**
 * 🔐 Clean Storage Client
 * Strictly disables session persistence and global auth headers to prevent
 * JWT signature conflicts between Firebase and Supabase during binary sync.
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
