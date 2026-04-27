/**
 * Migration: Add FileData columns for base64 file storage.
 * Run once: node backend/migrate-file-uploads.js
 */
require('dotenv').config();
const { getPool } = require('./src/config/db');

const migrations = [
  // Documents: FileUrl already exists (NVARCHAR(500)) — too small for base64.
  // Add a separate FileData column for the actual content.
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Documents' AND COLUMN_NAME='FileData')
   ALTER TABLE DC_Documents ADD FileData NVARCHAR(MAX) NULL`,

  // Bills: invoice/receipt attachment
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Bills' AND COLUMN_NAME='AttachmentData')
   ALTER TABLE DC_Bills ADD AttachmentData NVARCHAR(MAX) NULL`,
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Bills' AND COLUMN_NAME='AttachmentName')
   ALTER TABLE DC_Bills ADD AttachmentName NVARCHAR(300) NULL`,
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Bills' AND COLUMN_NAME='AttachmentType')
   ALTER TABLE DC_Bills ADD AttachmentType NVARCHAR(50) NULL`,

  // Travel: visa, ticket, itinerary
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Travel' AND COLUMN_NAME='AttachmentData')
   ALTER TABLE DC_Travel ADD AttachmentData NVARCHAR(MAX) NULL`,
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Travel' AND COLUMN_NAME='AttachmentName')
   ALTER TABLE DC_Travel ADD AttachmentName NVARCHAR(300) NULL`,
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Travel' AND COLUMN_NAME='AttachmentType')
   ALTER TABLE DC_Travel ADD AttachmentType NVARCHAR(50) NULL`,

  // Assets: purchase receipt, warranty doc, photo
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Assets' AND COLUMN_NAME='AttachmentData')
   ALTER TABLE DC_Assets ADD AttachmentData NVARCHAR(MAX) NULL`,
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Assets' AND COLUMN_NAME='AttachmentName')
   ALTER TABLE DC_Assets ADD AttachmentName NVARCHAR(300) NULL`,
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Assets' AND COLUMN_NAME='AttachmentType')
   ALTER TABLE DC_Assets ADD AttachmentType NVARCHAR(50) NULL`,

  // Events: agenda, minutes
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Events' AND COLUMN_NAME='AttachmentData')
   ALTER TABLE DC_Events ADD AttachmentData NVARCHAR(MAX) NULL`,
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Events' AND COLUMN_NAME='AttachmentName')
   ALTER TABLE DC_Events ADD AttachmentName NVARCHAR(300) NULL`,
  `IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='DC_Events' AND COLUMN_NAME='AttachmentType')
   ALTER TABLE DC_Events ADD AttachmentType NVARCHAR(50) NULL`,
];

async function migrate() {
  const pool = await getPool();
  for (const stmt of migrations) {
    await pool.request().query(stmt);
    const match = stmt.match(/TABLE_NAME='(\w+)' AND COLUMN_NAME='(\w+)'/);
    if (match) console.log(`✅ ${match[1]}.${match[2]} ensured`);
  }
  console.log('\n✅ All file upload migrations complete');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
