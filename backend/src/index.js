const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const taskRoutes = require('./routes/tasks');
const reminderRoutes = require('./routes/reminders');
const approvalRoutes = require('./routes/approvals');
const meetingRoutes = require('./routes/meetings');
const emailRoutes = require('./routes/emails');
const travelRoutes = require('./routes/travel');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reminders', reminderRoutes);
app.use('/api/approvals', approvalRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/travel', travelRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'DirectorControl API is running' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
