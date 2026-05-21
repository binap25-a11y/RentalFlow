'use server';

/**
 * @fileOverview Server Actions for Supabase Storage.
 * Handles the secure upload and deletion of property images and compliance documents.
 */

import { supabase } from '@/lib/supabase';

/**
 * Uploads a file to a specific Supabase bucket.
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

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return { success: true, url: publicUrlData.publicUrl };
  } catch (error: any) {
    console.error('Supabase Upload Error:', error.message);
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
