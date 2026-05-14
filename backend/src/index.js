const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
// Load .env using absolute path so it works regardless of PM2 cwd
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  'https://directorcontrol.astutehealthcare.co.uk',
  'http://localhost:3000', // keep for local dev
];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (server-to-server, curl, health checks)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
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
app.use('/api/events',      require('./routes/events'));
app.use('/api/teams',       require('./routes/teams'));
app.use('/api/family-tree', require('./routes/familyTree'));

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

    // Sync real user names and emails — runs on every startup, updates only what changed
    const { execute, query, sql } = require('./config/db');
    const users = await query('SELECT Id, Email, Name FROM DC_Users');
    const nameMap = {
      'chintan.patel@acornuniversalconsultancy.com':  { name: 'Chintan Patel',  first: 'Chintan', last: 'Patel',    avatar: 'CP', newEmail: null },
      'tanvi.laddha@acornuniversalconsultancy.com':   { name: 'Tanvi Laddha',   first: 'Tanvi',   last: 'Laddha',   avatar: 'TL', newEmail: null },
      'harsh.kansara@acornuniversalconsultancy.com':  { name: 'Harsh Kansara',  first: 'Harsh',   last: 'Kansara',  avatar: 'HK', newEmail: null },
      'dhruval.patel@acornuniversalconsultancy.com':  { name: 'Dhruval Patel',  first: 'Dhruval', last: 'Patel',    avatar: 'DP', newEmail: null },
      'gaumish.patel@acornuniversalconsultancy.com':  { name: 'Gaumish Patel',  first: 'Gaumish', last: 'Patel',    avatar: 'GP', newEmail: null },
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
    console.log('✅ User names & emails synced');
  } catch (err) {
    console.error('Startup error:', err.message);
  }
});
