# Supabase Integration Guide

This application is now equipped to connect to Supabase for redundant storage and relational data management.

## Environment Variables
Add the following to your `.env` file:
```env
# Storage & SDK
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Relational Ledger (already used in src/lib/db.ts)
DATABASE_URL=your_supabase_postgres_connection_string
```

## Setup Steps
1. **Create Buckets**: Go to Supabase Dashbard -> Storage and create:
   - `property-images` (Public: Yes)
   - `property-documents` (Public: No, unless shared via signed URLs)
2. **Database Sync**: The app already uses `src/lib/actions/db-sync.ts` which connects to `DATABASE_URL`. Set this to your Supabase Postgres string to start syncing property metadata.

## Using the Storage Action
In any component, you can now use `uploadToSupabase`:
```tsx
const formData = new FormData();
formData.append('file', file);
const result = await uploadToSupabase(formData, 'property-images', `listing-${id}.jpg`);
```
