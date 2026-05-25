/**
 * @fileOverview Supabase Client Initialization.
 * Standardized on the Anon client to resolve "alg" algorithm header parameter errors.
 * Optimized for high-speed binary delivery in the RentalFlow ecosystem.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Base client for standard operations (Image & Document Storage)
// Uses the project's Anon Key which is compatible with standard Storage protocols.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co', 
  supabaseAnonKey || 'placeholder'
);

/**
 * 🔐 Authenticated Supabase Proxy (Deprecated for Storage)
 * Removed Authorization headers to prevent "alg" parameter rejection errors
 * when using Firebase ID tokens with standard Supabase projects.
 */
export function getAuthSupabase() {
  return supabase;
}
