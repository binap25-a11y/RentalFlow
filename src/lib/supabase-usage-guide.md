# Supabase Storage Integration Guide

Your RentalFlow app is now synchronized with Supabase for high-fidelity binary storage.

## Target Environment
- **Project URL**: `https://wgezhbkkhamaawxgcqjf.supabase.co`
- **Bucket Names**: `Property-Images-`, `property-docs`

## 🛠️ Critical Step: Fix RLS Policy Errors
If you see broken images or "bucket not found" errors, you must verify the buckets exist and run the following SQL in your **Supabase Dashboard -> SQL Editor**:

```sql
-- 1. Allow Public Select (REQUIRED for visual identity)
CREATE POLICY "Allow Public Select" ON storage.objects FOR SELECT USING (bucket_id = 'Property-Images-');

-- 2. Allow Secure Uploads
CREATE POLICY "Allow Public Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'Property-Images-');

-- 3. Allow Maintenance (Update/Delete)
CREATE POLICY "Allow Public Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'Property-Images-');
CREATE POLICY "Allow Public Delete" ON storage.objects FOR DELETE USING (bucket_id = 'Property-Images-');

-- Repeat for documents bucket (property-docs)
CREATE POLICY "Allow Docs Select" ON storage.objects FOR SELECT USING (bucket_id = 'property-docs');
CREATE POLICY "Allow Docs Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'property-docs');
CREATE POLICY "Allow Docs Update" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'property-docs');
CREATE POLICY "Allow Docs Delete" ON storage.objects FOR DELETE USING (bucket_id = 'property-docs');
```

## Setup Verification
1. **Buckets**: Log in to [Supabase Dashboard](https://wgezhbkkhamaawxgcqjf.supabase.co) and go to **Storage**.
2. **Create**: Ensure `Property-Images-` and `property-docs` are created.
3. **Public Toggle**: Ensure both buckets are toggled to **"Public"** (unless specifically managing user-private RLS via folder paths).
4. **Policies**: Confirm the SQL above has been executed to grant the application permission to orchestrate binaries.
