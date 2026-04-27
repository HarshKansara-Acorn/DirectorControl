/**
 * Migration: Add DC_TaskComments table for two-way task communication.
 * Run once: node backend/migrate-task-comments.js
 */
require('dotenv').config();
const { getPool } = require('./src/config/db');

async function migrate() {
  const pool = await getPool();

  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='DC_TaskComments' AND xtype='U')
    CREATE TABLE DC_TaskComments (
      Id        NVARCHAR(36)  NOT NULL PRIMARY KEY,
      TaskId    NVARCHAR(36)  NOT NULL,
      UserId    NVARCHAR(36)  NOT NULL,
      Comment   NVARCHAR(MAX) NOT NULL,
      CreatedAt DATETIME2     NOT NULL DEFAULT GETUTCDATE(),
      FOREIGN KEY (TaskId) REFERENCES DC_Tasks(Id) ON DELETE CASCADE,
      FOREIGN KEY (UserId) REFERENCES DC_Users(Id)
    )
  `);

  console.log('✅ DC_TaskComments table created');
  process.exit(0);
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
});
