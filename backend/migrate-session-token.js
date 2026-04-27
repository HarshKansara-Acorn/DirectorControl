/**
 * Migration: Add SessionToken column to DC_Users
 * Run once: node backend/migrate-session-token.js
 */
require('dotenv').config({ path: __dirname + '/.env' });
const { getPool, sql } = require('./src/config/db');

async function migrate() {
  const pool = await getPool();

  // Add SessionToken column if it doesn't already exist
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'DC_Users' AND COLUMN_NAME = 'SessionToken'
    )
    ALTER TABLE DC_Users ADD SessionToken NVARCHAR(36) NULL
  `);

  console.log('✅ Migration complete: SessionToken column ensured on DC_Users');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
