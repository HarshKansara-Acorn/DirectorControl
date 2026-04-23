const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { urgentEmails } = require('../data/mockData');

// GET /api/emails?directorId=xxx
router.get('/', authenticateToken, (req, res) => {
  const { directorId } = req.query;
  let filtered = urgentEmails;

  if (req.user.role === 'director') {
    filtered = urgentEmails.filter(e => e.directorId === req.user.id);
  } else if (directorId) {
    filtered = urgentEmails.filter(e => e.directorId === directorId);
  }

  res.json(filtered);
});

// POST /api/emails
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { subject, from, fromName, directorId, preview, priority } = req.body;

  if (!subject || !directorId) {
    return res.status(400).json({ message: 'Subject and directorId are required' });
  }

  const newEmail = {
    id: uuidv4(),
    subject,
    from: from || '',
    fromName: fromName || '',
    directorId,
    preview: preview || '',
    priority: priority || 'urgent',
    isRead: false,
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };

  urgentEmails.push(newEmail);
  res.status(201).json(newEmail);
});

// PATCH /api/emails/:id/read
router.patch('/:id/read', authenticateToken, (req, res) => {
  const index = urgentEmails.findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Email not found' });

  urgentEmails[index].isRead = true;
  res.json(urgentEmails[index]);
});

// DELETE /api/emails/:id
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = urgentEmails.findIndex(e => e.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Email not found' });

  urgentEmails.splice(index, 1);
  res.json({ message: 'Email deleted' });
});

module.exports = router;
