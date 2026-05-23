import { Pool } from 'pg';

/**
 * 🔐 Relational Ledger Connection Pool
 * Configured for high-performance communication with the PostgreSQL database.
 * Lazily initialized to prevent build-time crashes if the DATABASE_URL is missing.
 */
let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString || connectionString.includes('YOUR_POSTGRES_URL')) {
    console.warn('DATABASE_URL is missing. Relational sync operations will be bypassed.');
    return null;
  }

  try {
    pool = new Pool({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    });
    
    pool.on('error', (err) => {
      console.error('Relational Ledger Error:', err);
    });

    return pool;
  } catch (err) {
    console.error('Failed to initialize database pool:', err);
    return null;
  }
}
