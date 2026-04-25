const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json({ limit: '10mb' }));        // allow photo uploads (compressed base64)
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global error handler for unhandled async errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/users',     require('./routes/users'));
app.use('/api/admin',     require('./routes/admin'));
app.use('/api/migrate',   require('./routes/migrate'));
app.use('/api/tasks',     require('./routes/tasks'));
app.use('/api/reminders', require('./routes/reminders'));
app.use('/api/approvals', require('./routes/approvals'));
app.use('/api/meetings',  require('./routes/meetings'));
app.use('/api/emails',    require('./routes/emails'));
app.use('/api/travel',    require('./routes/travel'));
app.use('/api/documents', require('./routes/documents'));
app.use('/api/bills',     require('./routes/bills'));
app.use('/api/assets',    require('./routes/assets'));
app.use('/api/events',    require('./routes/events'));
app.use('/api/teams',     require('./routes/teams'));

// Health check — tests live DB connection
app.get('/api/health', async (req, res) => {
  try {
    const { query } = require('./config/db');
    await query('SELECT 1 AS ok');
    res.json({ status: 'OK', db: 'connected', message: 'DirectorControl API running' });
  } catch (err) {
    res.status(503).json({ status: 'degraded', db: 'disconnected', error: err.message });
  }
});

// Manual schema setup trigger (safe to call multiple times)
app.post('/api/db/setup', async (req, res) => {
  try {
    const runSchema = require('./config/setupDb');
    await runSchema();
    res.json({ message: 'Schema setup complete' });
  } catch (err) {
    res.status(500).json({ message: 'Schema setup failed', error: err.message });
  }
});

// Start server then connect DB + run schema
app.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  try {
    const runSchema = require('./config/setupDb');
    await runSchema();

    const migrateProfile = require('./config/migrateProfile');
    await migrateProfile();

    // Auto-reset passwords to correct values on every startup
    const bcrypt = require('bcryptjs');
    const { execute, query, sql } = require('./config/db');
    const adminHash    = await bcrypt.hash('Admin@123', 10);
    const directorHash = await bcrypt.hash('Director@123', 10);
    await execute("UPDATE DC_Users SET Password=@h WHERE Role='admin'",    { h: { type: sql.NVarChar, value: adminHash } });
    await execute("UPDATE DC_Users SET Password=@h WHERE Role='director'", { h: { type: sql.NVarChar, value: directorHash } });
    console.log('✅ Passwords synced — PA: Admin@123 | Directors: Director@123');

    // Sync real user names and emails — runs on every startup, updates only what changed
    const users = await query('SELECT Id, Email, Name FROM DC_Users');
    const nameMap = {
      // old email → new details (handles both old and new email in case already migrated)
      'harsh.kansara@acornuniversalconsultancy.com':  { name: 'Chintan Patel',  first: 'Chintan', last: 'Patel',    avatar: 'CP', newEmail: 'chintan.patel@acornuniversalconsultancy.com'  },
      'chintan.patel@acornuniversalconsultancy.com':  { name: 'Chintan Patel',  first: 'Chintan', last: 'Patel',    avatar: 'CP', newEmail: null },
      'director1@acornuniversalconsultancy.com':      { name: 'Dhruval Patel',  first: 'Dhruval', last: 'Patel',    avatar: 'DP', newEmail: 'dhruval.patel@acornuniversalconsultancy.com'  },
      'dhruval.patel@acornuniversalconsultancy.com':  { name: 'Dhruval Patel',  first: 'Dhruval', last: 'Patel',    avatar: 'DP', newEmail: null },
      'director2@acornuniversalconsultancy.com':      { name: 'Gaumish Patel',  first: 'Gaumish', last: 'Patel',    avatar: 'GP', newEmail: 'gaumish.patel@acornuniversalconsultancy.com'  },
      'gaumish.patel@acornuniversalconsultancy.com':  { name: 'Gaumish Patel',  first: 'Gaumish', last: 'Patel',    avatar: 'GP', newEmail: null },
      'director3@acornuniversalconsultancy.com':      { name: 'Umesh Savaliya', first: 'Umesh',   last: 'Savaliya', avatar: 'US', newEmail: 'umesh.savaliya@acornuniversalconsultancy.com' },
      'umesh.savaliya@acornuniversalconsultancy.com': { name: 'Umesh Savaliya', first: 'Umesh',   last: 'Savaliya', avatar: 'US', newEmail: null },
    };
    for (const u of users) {
      const m = nameMap[u.Email?.toLowerCase()];
      if (!m) continue;
      const needsName  = u.Name !== m.name;
      const needsEmail = m.newEmail !== null;
      if (needsName || needsEmail) {
        const emailClause = needsEmail ? ', Email = @email' : '';
        const params = {
          name:   { type: sql.NVarChar, value: m.name },
          first:  { type: sql.NVarChar, value: m.first },
          last:   { type: sql.NVarChar, value: m.last },
          avatar: { type: sql.NVarChar, value: m.avatar },
          id:     { type: sql.NVarChar, value: u.Id },
        };
        if (needsEmail) params.email = { type: sql.NVarChar, value: m.newEmail };
        await execute(
          `UPDATE DC_Users SET Name=@name, FirstName=@first, LastName=@last, Avatar=@avatar${emailClause} WHERE Id=@id`,
          params
        );
      }
    }
    console.log('✅ User names & emails synced — Chintan Patel, Dhruval Patel, Gaumish Patel, Umesh Savaliya');
  } catch (err) {
    console.error('Startup error:', err.message);
  }
});
