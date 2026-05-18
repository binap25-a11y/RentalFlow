import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * @fileOverview Database connectivity diagnostic endpoint.
 * Returns the current database timestamp to verify the connection.
 */

export async function GET() {
  try {
    const result = await pool.query('SELECT NOW()');
    return NextResponse.json(result.rows);
  } catch (err: any) {
    console.error('Database connection error:', err);
    return new NextResponse(
      JSON.stringify({ 
        error: 'Database connection failed', 
        details: err.message 
      }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}