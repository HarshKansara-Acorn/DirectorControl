const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));
app.use(express.json());

// Global error handler for unhandled async errors
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ message: 'Internal server error', error: err.message });
});

// Routes
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/users',     require('./routes/users'));
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
  } catch (err) {
    console.error('Startup DB error:', err.message);
  }
});
