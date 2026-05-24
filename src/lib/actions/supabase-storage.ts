'use server';

/**
 * @fileOverview High-Fidelity Cloud Storage Engine.
 * Optimized for mobile uploads with robust binary processing and extended timeouts.
 * Resolves "failed to fetch" errors on mobile by ensuring complete payload delivery.
 */

import { supabase } from '@/lib/supabase';

export const maxDuration = 60; // Extend server action timeout for large mobile uploads

export async function uploadToSupabase(
  formData: FormData,
  bucket: 'property-images' | 'property-documents',
  path: string
) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No valid binary payload detected.');

    // Robust binary processing: 
    // Converting to ArrayBuffer then Buffer is more stable for Next.js 15 Server Actions
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

    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 315360000); // 10 Years Persistence

    if (signedError) throw signedError;

    return { success: true, url: signedData.signedUrl };
  } catch (error: any) {
    console.error('Storage Orchestration Failure:', error.message);
    return { success: false, error: error.message || 'Synchronization aborted.' };
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
