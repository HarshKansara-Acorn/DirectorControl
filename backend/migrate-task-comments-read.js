/**
 * Migration: Add IsRead column to DC_TaskComments for WhatsApp-like read status
 * Run once: node backend/migrate-task-comments-read.js
 */
require('dotenv').config();
const { getPool } = require('./src/config/db');

async function migrate() {
  const pool = await getPool();

  await pool.request().query(`
    IF NOT EXISTS (SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_TaskComments' AND COLUMN_NAME='IsRead')
    BEGIN
      ALTER TABLE DC_TaskComments ADD IsRead BIT NOT NULL DEFAULT 0;
    END
  `);

  console.log('✅ IsRead column added to DC_TaskComments');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
