'use server';

/**
 * @fileOverview Server Actions for Supabase Storage (Private Bucket Compatible).
 * Handles the secure upload and deletion of property images and compliance documents.
 * Generates long-lived signed URLs to work with private storage settings.
 */

import { supabase } from '@/lib/supabase';

/**
 * Uploads a file to a specific Supabase bucket and returns a signed URL.
 */
export async function uploadToSupabase(
  formData: FormData,
  bucket: 'property-images' | 'property-documents',
  path: string
) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Physical Upload to Private/Public Bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // 2. Generate Long-Lived Signed URL (315360000s = 10 Years)
    // This ensures the link persisted in Firestore works even if the bucket is PRIVATE.
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 315360000);

    if (signedError) throw signedError;

    return { success: true, url: signedData.signedUrl };
  } catch (error: any) {
    console.error('Supabase Orchestration Error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Deletes a file or multiple files from a Supabase bucket.
 * Note: Path can be a single string or an array of strings.
 */
export async function deleteFromSupabase(
  bucket: 'property-images' | 'property-documents',
  paths: string | string[]
) {
  try {
    const pathArray = Array.isArray(paths) ? paths : [paths];
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(pathArray);

    if (error) throw error;
    return { success: true, data };
  } catch (error: any) {
    console.error('Supabase Deletion Error:', error.message);
    return { success: false, error: error.message };
  }
}
