const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { meetings } = require('../data/mockData');

// GET /api/meetings?directorId=xxx&date=yyyy-mm-dd
router.get('/', authenticateToken, (req, res) => {
  const { directorId, date } = req.query;
  let filtered = meetings;

  if (req.user.role === 'director') {
    filtered = meetings.filter(m => m.directorId === req.user.id);
  } else if (directorId) {
    filtered = meetings.filter(m => m.directorId === directorId);
  }

  if (date) {
    filtered = filtered.filter(m => m.date === date);
  }

  res.json(filtered);
});

// POST /api/meetings
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { title, description, directorId, date, time, duration, location, attendees } = req.body;

  if (!title || !directorId || !date) {
    return res.status(400).json({ message: 'Title, directorId and date are required' });
  }

  const newMeeting = {
    id: uuidv4(),
    title,
    description: description || '',
    directorId,
    date,
    time: time || '09:00',
    duration: duration || 60,
    location: location || '',
    attendees: attendees || [],
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };

  meetings.push(newMeeting);
  res.status(201).json(newMeeting);
});

// PUT /api/meetings/:id
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = meetings.findIndex(m => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Meeting not found' });

  meetings[index] = { ...meetings[index], ...req.body, id: meetings[index].id };
  res.json(meetings[index]);
});

// DELETE /api/meetings/:id
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = meetings.findIndex(m => m.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Meeting not found' });

  meetings.splice(index, 1);
  res.json({ message: 'Meeting deleted' });
});

module.exports = router;
