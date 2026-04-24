const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, sql } = require('../config/db');

// GET /api/users/directors
router.get('/directors', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const directors = await query(
      "SELECT Id, Name, Email, Role, Title, Avatar FROM DC_Users WHERE Role = 'director' ORDER BY Name"
    );
    res.json(directors.map(u => ({
      id: u.Id, name: u.Name, email: u.Email,
      role: u.Role, title: u.Title, avatar: u.Avatar,
    })));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to fetch directors' });
  }
});

// GET /api/users/me
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await queryOne(
      'SELECT Id, Name, Email, Role, Title, Avatar FROM DC_Users WHERE Id = @id',
      { id: { type: sql.NVarChar, value: req.user.id } }
    );
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ id: user.Id, name: user.Name, email: user.Email, role: user.Role, title: user.Title, avatar: user.Avatar });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user' });
  }
});

module.exports = router;
