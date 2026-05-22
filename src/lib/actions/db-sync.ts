'use server';

import { getPool } from '@/lib/db';

/**
 * @fileOverview Server Actions for synchronizing Firebase metadata to PostgreSQL.
 * These actions ensure a redundant, relational record of all property assets and documents.
 * Updated to be resilient: if no DATABASE_URL is provided, it skips sync gracefully.
 */

export async function syncPropertyToDb(propertyData: {
  id: string;
  landlordId: string;
  addressLine1: string;
  city: string;
  zipCode: string;
  rentAmount: number;
  imageUrl: string;
  imageUrls?: string[];
  propertyType: string;
  numberOfBedrooms: number;
  numberOfBathrooms: number;
  description?: string;
}) {
  const pool = getPool();
  if (!pool) {
    console.warn('Relational Sync Skipped: Database pool not available.');
    return { success: true, message: 'Sync skipped' };
  }

  const { 
    id, landlordId, addressLine1, city, zipCode, 
    rentAmount, imageUrl, imageUrls, propertyType, 
    numberOfBedrooms, numberOfBathrooms, description 
  } = propertyData;
  
  try {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO properties (
          id, landlord_id, address, city, zip_code, 
          rent_amount, image_url, image_urls, property_type, 
          bedrooms, bathrooms, description
        )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (id) DO UPDATE SET
           address = EXCLUDED.address,
           city = EXCLUDED.city,
           zip_code = EXCLUDED.zip_code,
           rent_amount = EXCLUDED.rent_amount,
           image_url = EXCLUDED.image_url,
           image_urls = EXCLUDED.image_urls,
           property_type = EXCLUDED.property_type,
           bedrooms = EXCLUDED.bedrooms,
           bathrooms = EXCLUDED.bathrooms,
           description = EXCLUDED.description,
           synced_at = CURRENT_TIMESTAMP`,
        [
          id, landlordId, addressLine1, city, zipCode, 
          rentAmount, imageUrl, JSON.stringify(imageUrls || []), propertyType, 
          numberOfBedrooms, numberOfBathrooms, description
        ]
      );
      return { success: true };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Relational Sync Error (Property):', error);
    return { success: false, error: 'Database connection failed' };
  }
}

export async function syncDocumentToDb(docData: {
  id: string;
  propertyId: string;
  landlordId: string;
  fileName: string;
  fileUrl: string;
  documentType: string;
  expiryDate?: string | null;
}) {
  const pool = getPool();
  if (!pool) return { success: true, message: 'Sync skipped' };

  const { id, propertyId, landlordId, fileName, fileUrl, documentType, expiryDate } = docData;
  
  try {
    const client = await pool.connect();
    try {
      await client.query(
        `INSERT INTO documents (id, property_id, landlord_id, file_name, file_url, document_type, expiry_date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           file_name = EXCLUDED.file_name,
           file_url = EXCLUDED.file_url,
           document_type = EXCLUDED.document_type,
           expiry_date = EXCLUDED.expiry_date,
           synced_at = CURRENT_TIMESTAMP`,
        [id, propertyId, landlordId, fileName, fileUrl, documentType, expiryDate]
      );
      return { success: true };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Relational Sync Error (Document):', error);
    return { success: false, error: 'Database connection failed' };
  }
}

export async function deleteDocumentFromDb(docId: string) {
  const pool = getPool();
  if (!pool) return { success: true };

  try {
    const client = await pool.connect();
    try {
      await client.query('DELETE FROM documents WHERE id = $1', [docId]);
      return { success: true };
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Relational Deletion Error (Document):', error);
    return { success: false, error };
  }
}
