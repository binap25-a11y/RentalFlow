'use server';

/**
 * @fileOverview Server Actions for Supabase Storage.
 * Handles the secure upload of property images and compliance documents.
 */

import { supabase } from '@/lib/supabase';

/**
 * Uploads a file to a specific Supabase bucket.
 * @param file The file object (sent from a client-side FormData).
 * @param bucket The destination bucket ('property-images' or 'property-documents').
 * @param path The specific file path/name within the bucket.
 */
export async function uploadToSupabase(
  formData: FormData,
  bucket: 'property-images' | 'property-documents',
  path: string
) {
  try {
    const file = formData.get('file') as File;
    if (!file) throw new Error('No file provided');

    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true,
      });

    if (error) throw error;

    // Retrieve the public URL for the newly uploaded file
    const { data: publicUrlData } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return { success: true, url: publicUrlData.publicUrl };
  } catch (error: any) {
    console.error('Supabase Storage Error:', error.message);
    return { success: false, error: error.message };
  }
}
