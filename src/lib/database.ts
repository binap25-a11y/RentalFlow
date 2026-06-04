import { Pool } from 'pg';

/**
 * 🔐 Relational Ledger Connection Pool (Supabase Compatible)
 * Configured for high-performance communication with the PostgreSQL database.
 * Uses strict SSL configuration required by Supabase for secure cloud synchronization.
 */
let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;

  // Resilience: Verify connection string presence before pool initialization
  if (!connectionString || typeof connectionString !== 'string' || connectionString.includes('YOUR_POSTGRES_URL')) {
    console.warn('⚠️ DATABASE_URL is missing or using placeholder. Supabase relational sync will be bypassed.');
    return null;
  }

  try {
    pool = new Pool({
      connectionString: connectionString.trim(),
      // Supabase requires SSL with unauthorized rejection disabled for standard connection strings
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    
    pool.on('error', (err) => {
      console.error('❌ Relational Ledger Error:', err);
    });

    console.log('✅ Relational Ledger: Connection Pool Initialized (Supabase)');
    return pool;
  } catch (err) {
    console.error('❌ Failed to initialize Supabase database pool:', err);
    return null;
  }
}