'use server';

/**
 * @fileOverview Hardened Cloud Storage Engine.
 * Resolved "signature verification failed" by enforcing isolated, clean client creation
 * using verified production credentials for every request.
 */

import { createClient } from '@supabase/supabase-js';

function getHardenedClient() {
  const url = 'https://wgezhbkkhamaawxgcqjf.supabase.co';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndnZXpoYmtraGFtYWF3eGdjcWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk3NDM2NzEsImV4cCI6MjA5NTMxOTY3MX0.-wY09av9EQpPdeao5mi-BZXDflC0jzTVwfsxWWhINX4';
  
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

export async function uploadToSupabase(
  formData: FormData,
  bucket: 'property-images' | 'property-docs',
  path: string
) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No valid binary payload detected.');

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    // Create clean client to eliminate signature errors using verified credentials
    const supabase = getHardenedClient();

    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Supabase Signature Sync Error:', uploadError);
      throw new Error(uploadError.message || 'Binary delivery failed.');
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
  bucket: 'property-images' | 'property-docs',
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
