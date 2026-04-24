/**
 * Runs schema.sql against the Azure SQL database on server startup.
 * Uses IF NOT EXISTS guards so it's safe to run every time.
 */
const fs = require('fs');
const path = require('path');
const { getPool } = require('./db');

const runSchema = async () => {
  try {
    const pool = await getPool();
    const schemaPath = path.join(__dirname, '..', '..', 'schema.sql');

    if (!fs.existsSync(schemaPath)) {
      console.warn('⚠️  schema.sql not found, skipping auto-setup');
      return;
    }

    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split on blank lines between IF NOT EXISTS blocks
    // Each CREATE TABLE / INSERT block is separated by a blank line
    const statements = schema
      .split(/\n\s*\n/)
      .map(s => s.trim())
      .filter(s => s.length > 10 && !s.startsWith('--') && !s.startsWith('/*'));

    let created = 0;
    let skipped = 0;

    for (const stmt of statements) {
      // Skip pure comment blocks
      if (stmt.replace(/--.*$/gm, '').trim().length < 5) continue;
      try {
        await pool.request().query(stmt);
        created++;
      } catch (e) {
        // "There is already an object" = table exists, that's fine
        if (e.message.includes('already an object') || e.message.includes('already exists')) {
          skipped++;
        } else {
          console.warn('Schema warning:', e.message.substring(0, 120));
        }
      }
    }

    console.log(`✅ Schema ready — ${created} statements ran, ${skipped} already existed`);
  } catch (err) {
    console.error('❌ Schema setup failed:', err.message);
    // Don't crash the server — app still works if tables already exist
  }
};

module.exports = runSchema;
