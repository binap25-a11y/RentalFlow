# Supabase Storage Integration Guide

Your RentalFlow app is now synchronized with Supabase for high-fidelity binary storage.

## Target Environment
- **Project URL**: `https://wgezhbkkhamaawxgcqjf.supabase.co`
- **Bucket Names**: `Property-Images-`, `property-docs`

## 🛠️ Critical Step: Fix RLS Policy Errors
If you see broken images (the tiny broken icon) or "bucket not found" errors, you must verify the buckets exist and run the following SQL in your **Supabase Dashboard -> SQL Editor**. Standard `<img>` tags require public read access to display.

```sql
-- 1. Allow Public Select (REQUIRED for visual identity and standard <img> tags)
CREATE POLICY "Allow Public Select" ON storage.objects FOR SELECT USING (bucket_id = 'Property-Images-');

-- 2. Allow Secure Uploads (Authenticated only)
CREATE POLICY "Allow Auth Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'Property-Images-' AND auth.role() = 'authenticated');

-- 3. Allow Maintenance (Update/Delete)
CREATE POLICY "Allow Owner Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'Property-Images-' AND auth.role() = 'authenticated');
CREATE POLICY "Allow Owner Delete" ON storage.objects FOR DELETE USING (bucket_id = 'Property-Images-' AND auth.role() = 'authenticated');

-- Repeat for documents bucket (property-docs)
CREATE POLICY "Allow Docs Select" ON storage.objects FOR SELECT USING (bucket_id = 'property-docs');
CREATE POLICY "Allow Docs Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-docs' AND auth.role() = 'authenticated');
CREATE POLICY "Allow Docs Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'property-docs' AND auth.role() = 'authenticated');
CREATE POLICY "Allow Docs Delete" ON storage.objects FOR DELETE USING (bucket_id = 'property-docs' AND auth.role() = 'authenticated');
```

## Setup Verification
1. **Buckets**: Log in to [Supabase Dashboard](https://wgezhbkkhamaawxgcqjf.supabase.co) and go to **Storage**.
2. **Identity Check**: Ensure `Property-Images-` and `property-docs` are created exactly as cased here.
3. **Public Toggle**: Ensure `Property-Images-` is toggled to **"Public"** in the bucket settings. This is the most common cause of broken URLs.
4. **Policies**: Confirm the SQL above has been executed to grant the application permission to orchestrate binaries.
