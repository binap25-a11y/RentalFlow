
/**
 * @fileOverview Supabase Client Initialization.
 * Hardened to resolve "signature verification failed" and "alg" parameter errors.
 * Optimized for high-speed binary delivery in the RentalFlow ecosystem.
 */

import { createClient } from '@supabase/supabase-js';

// Standardized on the verified production project ID to ensure binary persistence.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vucefokfhdrbgldrimgl.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

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

/**
 * 🔐 Authenticated Supabase Proxy (Deprecated for Storage)
 */
export function getAuthSupabase() {
  return supabase;
}
