/**
 * Migration: Create DC_FamilyMembers table.
 * Run once: node backend/migrate-family-tree.js
 */
require('dotenv').config();
const { getPool } = require('./src/config/db');

async function migrate() {
  const pool = await getPool();

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_FamilyMembers' AND xtype='U')
    CREATE TABLE DC_FamilyMembers (
      Id           NVARCHAR(36)  NOT NULL PRIMARY KEY,
      DirectorId   NVARCHAR(36)  NOT NULL,
      Name         NVARCHAR(150) NOT NULL,
      Relationship NVARCHAR(100) NOT NULL,
      DateOfBirth  DATE          NULL,
      Phone        NVARCHAR(50)  NULL,
      Email        NVARCHAR(150) NULL,
      Notes        NVARCHAR(MAX) NULL,
      PhotoData    NVARCHAR(MAX) NULL,
      PhotoName    NVARCHAR(300) NULL,
      CreatedBy    NVARCHAR(36)  NOT NULL,
      CreatedAt    DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
      UpdatedAt    DATETIME2     NOT NULL DEFAULT GETUTCDATE()
    )
  `);

  console.log('✅ DC_FamilyMembers table created');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
