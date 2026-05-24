'use server';

/**
 * @fileOverview Resilient Cloud Storage Engine.
 * Optimized for mobile uploads with robust binary processing and buffer conversion.
 * Resolves "failed to fetch" errors on mobile browsers.
 */

import { supabase } from '@/lib/supabase';

export async function uploadToSupabase(
  formData: FormData,
  bucket: 'property-images' | 'property-documents',
  path: string
) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No valid file provided.');

    // Robust binary processing for mobile compatibility
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
      console.error('Supabase Upload Error:', uploadError);
      throw uploadError;
    }

    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 315360000); // 10 Years Persistence

    if (signedError) throw signedError;

    return { success: true, url: signedData.signedUrl };
  } catch (error: any) {
    console.error('Storage Engine Failure:', error.message);
    return { success: false, error: error.message || 'Binary synchronization failed.' };
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