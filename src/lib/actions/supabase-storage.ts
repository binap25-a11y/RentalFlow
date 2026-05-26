'use server';

/**
 * @fileOverview Hardened Cloud Storage Engine.
 * Optimized for Private Buckets using Signed URL Orchestration.
 * Standardized on atomic path protocol: ${uid}/${propertyId}/${timestamp}-${filename}
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

    // 1. Binary Transmission
    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Supabase Sync Failure:', uploadError);
      throw new Error(`Storage Error: ${uploadError.message}.`);
    }

    // 2. Private Access Orchestration: Use Signed URL for 1 Week
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24 * 7);

    if (signedError) {
      throw new Error(`Signature Error: ${signedError.message}`);
    }

    return { 
      success: true, 
      url: signedData.signedUrl,
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
