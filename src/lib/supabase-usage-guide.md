# Supabase Storage Integration Guide

Your RentalFlow app is now connected to Supabase for storing images and documents.

## Environment Variables
The following are configured in your `.env` file:
```env
NEXT_PUBLIC_SUPABASE_URL=https://vucefokfhdrbgldrimgl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_fbyGbXPyWG1GepobX4Jeyw_sjbXTTCL
```

## Setup Steps
1. **Create Buckets**: Log in to your [Supabase Dashboard](https://vucefokfhdrbgldrimgl.supabase.co) and go to **Storage**.
2. **Bucket Names**: Create the following buckets:
   - `property-images` (Public: **Yes**)
   - `property-documents` (Public: **Yes** or set appropriate policies)
3. **Policies**: Add a "Public access" policy to `property-images` so residents can see listings.

## Using the Storage Action in Code
You can use the server action in your components like this:

```tsx
import { uploadToSupabase } from '@/lib/actions/supabase-storage';

const handleUpload = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  
  // Upload to 'property-images'
  const result = await uploadToSupabase(
    formData, 
    'property-images', 
    `assets/${propertyId}/${Date.now()}_${file.name}`
  );
  
  if (result.success) {
    console.log("Uploaded URL:", result.url);
    // Now save result.url to your Firestore document
  }
};
```

Note: `DATABASE_URL` is separate and only needed if you are performing server-side PostgreSQL operations, not for Storage uploads.
