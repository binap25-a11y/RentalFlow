'use server';

/**
 * @fileOverview Hardened Cloud Storage Engine.
 * Targeted at the verified production project: wgezhbkkhamaawxgcqjf.
 * Standardized on atomic path protocol: ${uid}/${timestamp}-${filename}
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://wgezhbkkhamaawxgcqjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZXpoYmtraGFtYWF3eGdjcWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDM2NzEsImV4cCI6MjA5NTMxOTY3MX0.-wY09av9EQpPdeao5mi-BZXDflC0jzTVwfsxWWhINX4';

function getHardenedClient() {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

export async function uploadToSupabase(
  formData: FormData,
  bucket: 'Property-Images-' | 'property-docs',
  path: string
) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No valid binary payload detected.');

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const supabase = getHardenedClient();

    // TARGETING VERIFIED BUCKET: Case-sensitive identity Property-Images-
    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Supabase Sync Failure:', uploadError);
      throw new Error(`Storage Error: ${uploadError.message}. Ensure bucket "${bucket}" is initialized and set to Public Select.`);
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);

    return { 
      success: true, 
      url: publicData.publicUrl,
      path: data.path 
    };
  } catch (error: any) {
    console.error('Storage Orchestration Failure:', error.message);
    return { 
      success: false, 
      error: error.message || 'Synchronization aborted.' 
    };
  }
}

export async function deleteFromSupabase(
  bucket: 'Property-Images-' | 'property-docs',
  paths: string | string[]
) {
  try {
    const supabase = getHardenedClient();
    const pathArray = Array.isArray(paths) ? paths : [paths];
    const { data, error } = await supabase.storage.from(bucket).remove(pathArray);
    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
