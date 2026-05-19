
# Supabase Integration Guide

Your RentalFlow app is now connected to Supabase for redundant storage and relational data management.

## Environment Variables
The following have been configured in your `.env` file:
```env
NEXT_PUBLIC_SUPABASE_URL=https://vucefokfhdrbgldrimgl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_fbyGbXPyWG1GepobX4Jeyw_sjbXTTCL

# Action Required: Add your Postgres connection string here to enable DB sync
DATABASE_URL=your_supabase_postgres_connection_string
```

## Setup Steps
1. **Create Buckets**: Log in to your [Supabase Dashboard](https://vucefokfhdrbgldrimgl.supabase.co) and go to **Storage**.
2. **Bucket Names**: Create the following buckets:
   - `property-images` (Public: **Yes**)
   - `property-documents` (Public: **No**, if you want to use signed URLs for privacy)
3. **Policies**: Add a "Public access" policy to `property-images` so residents can see listings.

## Using the Storage Action
In any component (e.g., `src/app/landlord/properties/[propertyId]/page.tsx`), you can use the pre-built action:

```tsx
import { uploadToSupabase } from '@/lib/actions/supabase-storage';

const handleUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const result = await uploadToSupabase(
    formData, 
    'property-images', 
    `assets/${propertyId}/${file.name}`
  );
  
  if (result.success) {
    console.log("Uploaded URL:", result.url);
  }
};
```
