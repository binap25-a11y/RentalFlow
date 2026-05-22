import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

/**
 * @fileOverview Database connectivity diagnostic endpoint.
 * Returns a standardized status check for the PostgreSQL ledger.
 */

export async function GET() {
  const pool = getPool();

  if (!pool) {
    return NextResponse.json({
      status: "skipped",
      message: "Database environment variable not configured"
    }, { status: 200 });
  }

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
