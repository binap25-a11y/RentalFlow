# Supabase Storage Integration Guide

Your RentalFlow app is now synchronized with Supabase for high-fidelity binary storage.

## Target Environment
- **Project URL**: `https://wgezhbkkhamaawxgcqjf.supabase.co`
- **Bucket Names**: `Property-Images-`, `property-docs`

## 🛠️ Critical Step 1: Fix RLS Policy Errors
If you see broken images or "bucket not found" errors, you must verify the buckets exist and run the following SQL in your **Supabase Dashboard -> SQL Editor**. Standard `<img>` tags require specific permissions even when using signed URLs.

```sql
-- 1. Allow Public Select (REQUIRED for visual identity)
CREATE POLICY "Allow Public Select" ON storage.objects FOR SELECT USING (bucket_id = 'Property-Images-');

-- 2. Allow Secure Uploads (Authenticated only)
CREATE POLICY "Allow Auth Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'Property-Images-' AND auth.role() = 'authenticated');

-- 3. Allow Maintenance (Update/Delete)
CREATE POLICY "Allow Owner Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'Property-Images-' AND auth.role() = 'authenticated');
CREATE POLICY "Allow Owner Delete" ON storage.objects FOR DELETE USING (bucket_id = 'Property-Images-' AND auth.role() = 'authenticated');

-- Repeat for documents bucket (property-docs)
CREATE POLICY "Allow Docs Select" ON storage.objects FOR SELECT USING (bucket_id = 'property-docs');
CREATE POLICY "Allow Docs Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-docs' AND auth.role() = 'authenticated');
```

## 🛠️ Critical Step 2: Configure CORS (Essential for Cloud Workstations)
Standard browsers and Next.js require a CORS policy to load binaries from Supabase. In your **Supabase Dashboard**, go to **Storage -> Settings -> Configuration** and ensure your CORS settings permit your workstation domains:

- **Allowed Origins**: `*` (or your specific `.cloudworkstations.dev` domains)
- **Allowed Methods**: `GET`, `POST`, `PUT`, `DELETE`
- **Allowed Headers**: `*`
- **Exposed Headers**: `Content-Range`, `X-Content-Range`

## Setup Verification
1. **Buckets**: Ensure `Property-Images-` is created exactly as cased.
2. **Public Toggle**: Even if using Signed URLs, setting the bucket to **"Public"** can resolve transient rendering issues in some development environments.
