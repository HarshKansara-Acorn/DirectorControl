const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { tasks } = require('../data/mockData');

// GET /api/tasks?directorId=xxx
router.get('/', authenticateToken, (req, res) => {
  const { directorId } = req.query;

  let filtered = tasks;

  if (req.user.role === 'director') {
    // Directors only see their own tasks
    filtered = tasks.filter(t => t.assignedTo === req.user.id);
  } else if (directorId) {
    // Admin can filter by director
    filtered = tasks.filter(t => t.assignedTo === directorId);
  }

  res.json(filtered);
});

// POST /api/tasks
router.post('/', authenticateToken, (req, res) => {
  const { title, description, priority, status, assignedTo, dueDate, tags } = req.body;

  if (!title || !assignedTo) {
    return res.status(400).json({ message: 'Title and assignedTo are required' });
  }

  const newTask = {
    id: uuidv4(),
    title,
    description: description || '',
    priority: priority || 'medium',
    status: status || 'todo',
    assignedTo,
    createdBy: req.user.id,
    dueDate: dueDate || null,
    tags: tags || [],
    comments: [],
    createdAt: new Date().toISOString(),
  };

  tasks.push(newTask);
  res.status(201).json(newTask);
});

// PUT /api/tasks/:id
router.put('/:id', authenticateToken, (req, res) => {
  const index = tasks.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Task not found' });

  tasks[index] = { ...tasks[index], ...req.body, id: tasks[index].id };
  res.json(tasks[index]);
});

// PATCH /api/tasks/:id/status
router.patch('/:id/status', authenticateToken, (req, res) => {
  const { status } = req.body;
  const index = tasks.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Task not found' });

  tasks[index].status = status;
  res.json(tasks[index]);
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticateToken, requireAdmin, (req, res) => {
  const index = tasks.findIndex(t => t.id === req.params.id);
  if (index === -1) return res.status(404).json({ message: 'Task not found' });

  tasks.splice(index, 1);
  res.json({ message: 'Task deleted' });
});

module.exports = router;
