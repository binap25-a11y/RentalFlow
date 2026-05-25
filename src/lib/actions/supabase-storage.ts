'use server';

/**
 * @fileOverview High-Fidelity Cloud Storage Engine (Server Utility).
 * Optimized for administrative and automated synchronization tasks.
 * NOTE: For large mobile binary uploads, client-side direct sync is preferred to bypass payload limits.
 */

import { supabase } from '@/lib/supabase';

export async function uploadToSupabase(
  formData: FormData,
  bucket: 'property-images' | 'property-documents',
  path: string
) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No valid binary payload detected.');

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: true,
        cacheControl: '3600',
      });

    if (uploadError) {
      console.error('Supabase Core Sync Error:', uploadError);
      throw new Error(uploadError.message || 'Binary delivery failed.');
    }

    const { data: publicData } = supabase.storage.from(bucket).getPublicUrl(path);

    return { success: true, url: publicData.publicUrl };
  } catch (error: any) {
    console.error('Storage Orchestration Failure:', error.message);
    return { 
      success: false, 
      error: error.message || 'Synchronization aborted.' 
    };
  }
}

export async function deleteFromSupabase(
  bucket: 'property-images' | 'property-documents',
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
