/**
 * Migration: Add time columns to all tables that have date fields.
 * Run once: node backend/migrate-time-fields.js
 */
require('dotenv').config();
const { getPool, sql } = require('./src/config/db');

const migrations = [
  // Tasks: DueTime
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Tasks' AND COLUMN_NAME='DueTime')
   ALTER TABLE DC_Tasks ADD DueTime NVARCHAR(10) NULL`,
  // Reminders: DueTime
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Reminders' AND COLUMN_NAME='DueTime')
   ALTER TABLE DC_Reminders ADD DueTime NVARCHAR(10) NULL`,
  // Approvals: DueTime
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Approvals' AND COLUMN_NAME='DueTime')
   ALTER TABLE DC_Approvals ADD DueTime NVARCHAR(10) NULL`,
  // Travel: DepartureTime, ReturnTime
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Travel' AND COLUMN_NAME='DepartureTime')
   ALTER TABLE DC_Travel ADD DepartureTime NVARCHAR(10) NULL`,
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Travel' AND COLUMN_NAME='ReturnTime')
   ALTER TABLE DC_Travel ADD ReturnTime NVARCHAR(10) NULL`,
  // Bills: DueTime
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Bills' AND COLUMN_NAME='DueTime')
   ALTER TABLE DC_Bills ADD DueTime NVARCHAR(10) NULL`,
  // Assets: PurchaseTime (optional, for completeness)
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Assets' AND COLUMN_NAME='PurchaseTime')
   ALTER TABLE DC_Assets ADD PurchaseTime NVARCHAR(10) NULL`,
  // Documents: ExpiryTime
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Documents' AND COLUMN_NAME='ExpiryTime')
   ALTER TABLE DC_Documents ADD ExpiryTime NVARCHAR(10) NULL`,
];

async function migrate() {
  const pool = await getPool();
  for (const sql of migrations) {
    await pool.request().query(sql);
    const match = sql.match(/TABLE_NAME='(\w+)' AND COLUMN_NAME='(\w+)'/);
    if (match) console.log(`✅ ${match[1]}.${match[2]} ensured`);
  }
  console.log('\n✅ All time field migrations complete');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
