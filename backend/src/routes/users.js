const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { users } = require('../data/mockData');

// GET /api/users/directors - Get all directors (admin only)
router.get('/directors', authenticateToken, requireAdmin, (req, res) => {
  const directors = users
    .filter(u => u.role === 'director')
    .map(({ password, ...u }) => u);
  res.json(directors);
});

// GET /api/users/me - Get current user profile
router.get('/me', authenticateToken, (req, res) => {
  const user = users.find(u => u.id === req.user.id);
  if (!user) return res.status(404).json({ message: 'User not found' });
  const { password, ...userWithoutPassword } = user;
  res.json(userWithoutPassword);
});

module.exports = router;
