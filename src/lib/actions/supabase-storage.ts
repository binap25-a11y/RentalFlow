'use server';

/**
 * @fileOverview Server Actions for Supabase Storage (Private Bucket Compatible).
 * Handles the secure upload and deletion of property images and compliance documents.
 * Generates long-lived signed URLs to work with private storage settings.
 * Optimized for mobile uploads with robust binary processing.
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
    const file = formData.get('file');
    
    // Check if file exists and is a valid File object
    if (!file || typeof file === 'string') {
      throw new Error('No valid file provided for upload.');
    }

    const typedFile = file as unknown as File;
    
    // Process binary data into a Buffer for Node.js environment
    // Use Uint8Array for maximum compatibility with server action streams
    const arrayBuffer = await typedFile.arrayBuffer();
    const buffer = Buffer.from(new Uint8Array(arrayBuffer));

    // 1. Physical Upload to Private/Public Bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: typedFile.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (uploadError) {
      console.error('Supabase Physical Upload Error:', uploadError);
      throw new Error(uploadError.message);
    }

    // 2. Generate Long-Lived Signed URL (315360000s = 10 Years)
    const { data: signedData, error: signedError } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 315360000);

    if (signedError) {
      console.error('Supabase Signature Error:', signedError);
      throw new Error(signedError.message);
    }

    if (!signedData?.signedUrl) {
      throw new Error('Storage engine failed to return a valid access URL.');
    }

    return { success: true, url: signedData.signedUrl };
  } catch (error: any) {
    const errorMessage = error?.message || 'Unknown orchestration error in cloud storage.';
    console.error('Supabase Action Critical Failure:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Deletes a file or multiple files from a Supabase bucket.
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
