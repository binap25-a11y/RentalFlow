# Supabase Storage Integration Guide

Your RentalFlow app is now connected to Supabase for storing images and documents.

## Environment Variables
The following are configured in your `.env` file:
```env
NEXT_PUBLIC_SUPABASE_URL=https://vucefokfhdrbgldrimgl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_fbyGbXPyWG1GepobX4Jeyw_sjbXTTCL
```

## 🛠️ Critical Step: Fix RLS Policy Errors
If you see broken images or "row-level security policy" errors, you must run the following SQL in your **Supabase Dashboard -> SQL Editor**:

```sql
-- 1. Allow anyone to see images (Public Access)
-- This is REQUIRED for visual assets to display throughout the app
CREATE POLICY "Allow Public Select" ON storage.objects FOR SELECT USING (bucket_id = 'property-images');

-- 2. Allow uploads (Firebase users appear as 'anon' to Supabase)
CREATE POLICY "Allow Public Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-images');

-- 3. Allow updates and deletions
CREATE POLICY "Allow Public Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'property-images');
CREATE POLICY "Allow Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'property-images');

-- Repeat for documents bucket
CREATE POLICY "Allow Docs Select" ON storage.objects FOR SELECT USING (bucket_id = 'property-documents');
CREATE POLICY "Allow Docs Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-documents');
CREATE POLICY "Allow Docs Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'property-documents');
CREATE POLICY "Allow Docs Delete" ON storage.objects FOR DELETE USING (bucket_id = 'property-documents');
```

## Setup Steps
1. **Create Buckets**: Log in to your [Supabase Dashboard](https://vucefokfhdrbgldrimgl.supabase.co) and go to **Storage**.
2. **Bucket Names**: Create the following buckets:
   - `property-images` (Public: **Yes**)
   - `property-documents` (Public: **Yes**)
3. **Policies**: Ensure the SQL above is executed. If images are still broken, double check that the buckets are toggled to **"Public"** in the bucket settings.

## Note on "alg" Errors
The application has been standardized on the **Anon Client**. This resolves the `"alg" Header Parameter` collision between Firebase and Supabase. No further configuration is required for this.
