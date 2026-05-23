/**
 * @fileOverview Supabase Client Initialization.
 * Centralizes the connection to the Supabase backend for Storage and Database operations.
 * Initialized lazily or with fallbacks to prevent top-level import crashes.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// If credentials are missing, createClient will still work but operations will fail.
// We use a dummy URL if missing to prevent the constructor from throwing immediately.
const finalUrl = supabaseUrl || 'https://placeholder.supabase.co';
const finalKey = supabaseAnonKey || 'placeholder';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Storage operations will return controlled errors.');
}

export const supabase = createClient(finalUrl, finalKey);
