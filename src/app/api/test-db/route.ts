import { NextResponse } from 'next/server';
import pool from '@/lib/db';

/**
 * @fileOverview Database connectivity diagnostic endpoint.
 * Returns a standardized status check for the PostgreSQL ledger.
 */

export async function GET() {
  try {
    const result = await pool.query('SELECT NOW()');
    return NextResponse.json({
      status: "ok",
      message: "Connected to PostgreSQL",
      time: result.rows[0].now
    });
  } catch (err: any) {
    console.error('Database connection error:', err);
    return NextResponse.json({ 
      status: "error",
      message: "Database connection failed", 
      details: err.message 
    }, { 
      status: 500
    });
  }
}