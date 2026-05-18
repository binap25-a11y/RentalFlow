const { Pool } = require('pg');

/**
 * 🔐 Premium Database Connection Pool
 * Configured for secure, high-performance communication with the RentalFlow relational ledger.
 */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

module.exports = pool;