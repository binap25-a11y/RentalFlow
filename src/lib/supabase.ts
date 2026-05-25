/**
 * @fileOverview Supabase Client Initialization.
 * Centralizes the connection to the Supabase backend for Storage and Database operations.
 * Optimized for Authenticated Direct Sync using Firebase tokens.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Base client for public operations
export const supabase = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabaseAnonKey || 'placeholder');

/**
 * 🔐 Authenticated Supabase Proxy
 * Creates a client instance authorized with the user's Firebase ID Token.
 * Required for private bucket operations (INSERT/UPDATE/DELETE) via RLS.
 */
export function getAuthSupabase(token: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  });
}
