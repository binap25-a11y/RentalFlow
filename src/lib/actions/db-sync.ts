'use server';

import pool from '@/lib/db';

/**
 * @fileOverview Server Actions for synchronizing Firebase metadata to PostgreSQL.
 * These actions ensure a redundant, relational record of all property assets and documents.
 */

export async function syncPropertyToDb(propertyData: {
  id: string;
  landlordId: string;
  addressLine1: string;
  city: string;
  zipCode: string;
  rentAmount: number;
  imageUrl: string;
  propertyType: string;
  description?: string;
}) {
  const { id, landlordId, addressLine1, city, zipCode, rentAmount, imageUrl, propertyType, description } = propertyData;
  const client = await pool.connect();
  try {
    // Ensure table structure exists for the relational ledger
    await client.query(`
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY,
        landlord_id TEXT NOT NULL,
        address TEXT NOT NULL,
        city TEXT NOT NULL,
        zip_code TEXT NOT NULL,
        rent_amount NUMERIC NOT NULL,
        image_url TEXT,
        property_type TEXT,
        description TEXT,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Perform Upsert
    await client.query(
      `INSERT INTO properties (id, landlord_id, address, city, zip_code, rent_amount, image_url, property_type, description)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (id) DO UPDATE SET
         address = EXCLUDED.address,
         city = EXCLUDED.city,
         zip_code = EXCLUDED.zip_code,
         rent_amount = EXCLUDED.rent_amount,
         image_url = EXCLUDED.image_url,
         property_type = EXCLUDED.property_type,
         description = EXCLUDED.description,
         synced_at = CURRENT_TIMESTAMP`,
      [id, landlordId, addressLine1, city, zipCode, rentAmount, imageUrl, propertyType, description]
    );
    return { success: true };
  } catch (error) {
    console.error('Relational Sync Error (Property):', error);
    return { success: false, error };
  } finally {
    client.release();
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
  const { id, propertyId, landlordId, fileName, fileUrl, documentType, expiryDate } = docData;
  const client = await pool.connect();
  try {
    // Ensure table structure exists for the relational document vault
    await client.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        property_id TEXT NOT NULL,
        landlord_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_url TEXT NOT NULL,
        document_type TEXT,
        expiry_date TIMESTAMP,
        synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Perform Upsert
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
  } catch (error) {
    console.error('Relational Sync Error (Document):', error);
    return { success: false, error };
  } finally {
    client.release();
  }
}
