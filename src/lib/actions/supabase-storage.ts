
'use server';

/**
 * @fileOverview Standard Cloud Storage Engine (Server Utility).
 * Standardized on Server Actions to resolve "signature verification failed" errors
 * occurring during client-side browser uploads.
 */

import { supabase } from '@/lib/supabase';

export async function uploadToSupabase(
  formData: FormData,
  bucket: 'property-images' | 'property-docs',
  path: string
) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No valid binary payload detected.');

    // Convert to Buffer for server-side stability
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Perform atomic upload using the hardened server client
    const { data, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type || 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Supabase Server Sync Error:', uploadError);
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
    const pathArray = Array.isArray(paths) ? paths : [paths];
    const { data, error } = await supabase.storage.from(bucket).remove(pathArray);
    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
