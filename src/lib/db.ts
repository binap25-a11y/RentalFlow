import { Pool } from 'pg';

/**
 * 🔐 Premium Database Connection Pool
 * Configured for secure, high-performance communication with the RentalFlow relational ledger.
 * Lazily initialized to prevent blocking server startup if the DATABASE_URL is missing or unreachable.
 */
let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString || connectionString.includes('YOUR_POSTGRES_URL')) {
    console.warn('DATABASE_URL is missing or placeholder. Relational sync operations will be bypassed.');
    return null;
  }

  try {
    pool = new Pool({
      connectionString: connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      // Short timeouts to prevent hanging the server heartbeat
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
    });
    
    // Catch pool-level errors to prevent process crashes
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client:', err);
    });

    return pool;
  } catch (err) {
    console.error('Failed to initialize database pool:', err);
    return null;
  }
}

// Named export for the instance itself if needed
export const dbPool = pool;
