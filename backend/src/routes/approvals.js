const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { approvals } = require('../data/mockData');

// GET /api/approvals?directorId=xxx
router.get('/', authenticateToken, (req, res) => {
  const { directorId } = req.query;
  let filtered = approvals;

  if (req.user.role === 'director') {
    filtered = approvals.filter(a => a.directorId === req.user.id);
  } else if (directorId) {
    filtered = approvals.filter(a => a.directorId === directorId);
  }

  res.json(filtered);
});

// POST /api/approvals
router.post('/', authenticateToken, requireAdmin, (req, res) => {
  const { type, title, description, fromName, fromEmail, directorId, priority, dueDate } = req.body;

  if (!title || !directorId) {
    return res.status(400).json({ message: 'Title and directorId are required' });
  }

  const newApproval = {
    id: uuidv4(),
    type: type || 'general',
    title,
    description: description || '',
    fromName: fromName || '',
    fromEmail: fromEmail || '',
    directorId,
    priority: priority || 'normal',
    dueDate: dueDate || null,
    status: 'pending',
    createdBy: req.user.id,
    createdAt: new Date().toISOString(),
  };

  approvals.push(newApproval);
  res.status(201).json(newApproval);
});

// PATCH /api/approvals/:id/action
router.patch('/:id/action', authenticateToken, (req, res) => {
  const { action, remarks } = req.body; // action: 'approved' | 'rejected'
  const index = approvals.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Approval not found' });

  // Only the assigned director or admin can act
  const approval = approvals[index];
  if (req.user.role === 'director' && approval.directorId !== req.user.id) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  approvals[index].status = action;
  approvals[index].remarks = remarks || '';
  approvals[index].actionBy = req.user.id;
  approvals[index].actionAt = new Date().toISOString();

  res.json(approvals[index]);
});

// DELETE /api/approvals/:id
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = approvals.findIndex(a => a.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Approval not found' });

  approvals.splice(index, 1);
  res.json({ message: 'Approval deleted' });
});

module.exports = router;
