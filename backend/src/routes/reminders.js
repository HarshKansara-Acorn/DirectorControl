const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { reminders } = require('../data/mockData');

// GET /api/reminders?directorId=xxx
router.get('/', authenticateToken, (req, res) => {
  const { directorId } = req.query;
  let filtered = reminders;

  if (req.user.role === 'director') {
    filtered = reminders.filter(r => r.directorId === req.user.id);
  } else if (directorId) {
    filtered = reminders.filter(r => r.directorId === directorId);
  }

  res.json(filtered);
});

// POST /api/reminders
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { title, description, directorId, dueDate, priority } = req.body;

  if (!title || !directorId) {
    return res.status(400).json({ message: 'Title and directorId are required' });
  }

  const newReminder = {
    id: uuidv4(),
    title,
    description: description || '',
    directorId,
    dueDate: dueDate || null,
    priority: priority || 'medium',
    isActive: true,
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };

  reminders.push(newReminder);
  res.status(201).json(newReminder);
});

// PUT /api/reminders/:id
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = reminders.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Reminder not found' });

  reminders[index] = { ...reminders[index], ...req.body, id: reminders[index].id };
  res.json(reminders[index]);
});

// DELETE /api/reminders/:id
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = reminders.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Reminder not found' });

  reminders.splice(index, 1);
  res.json({ message: 'Reminder deleted' });
});

module.exports = router;
