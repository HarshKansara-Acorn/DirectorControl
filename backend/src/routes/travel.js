const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { travelReminders } = require('../data/mockData');

// GET /api/travel?directorId=xxx
router.get('/', authenticateToken, (req, res) => {
  const { directorId } = req.query;
  let filtered = travelReminders;

  if (req.user.role === 'director') {
    filtered = travelReminders.filter(t => t.directorId === req.user.id);
  } else if (directorId) {
    filtered = travelReminders.filter(t => t.directorId === directorId);
  }

  res.json(filtered);
});

// POST /api/travel
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { destination, purpose, directorId, departureDate, returnDate, notes } = req.body;

  if (!destination || !directorId || !departureDate) {
    return res.status(400).json({ message: 'Destination, directorId and departureDate are required' });
  }

  const newTravel = {
    id: uuidv4(),
    destination,
    purpose: purpose || '',
    directorId,
    departureDate,
    returnDate: returnDate || null,
    status: 'upcoming',
    notes: notes || '',
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };

  travelReminders.push(newTravel);
  res.status(201).json(newTravel);
});

// PUT /api/travel/:id
router.put('/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = travelReminders.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Travel reminder not found' });

  travelReminders[index] = { ...travelReminders[index], ...req.body, id: travelReminders[index].id };
  res.json(travelReminders[index]);
});

// DELETE /api/travel/:id
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = travelReminders.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Travel reminder not found' });

  travelReminders.splice(index, 1);
  res.json({ message: 'Travel reminder deleted' });
});

module.exports = router;
