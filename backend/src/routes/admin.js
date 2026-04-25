const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { execute, sql } = require('../config/db');

/**
 * POST /api/admin/reset-password
 * Admin-only: reset any user's password
 */
router.post('/reset-password', authenticateToken, requireAdmin, async (req, res) => {
  const { userId, newPassword } = req.body;

  if (!userId || !newPassword) {
    return res.status(400).json({ message: 'userId and newPassword are required' });
  }

  try {
    const hash = await bcrypt.hash(newPassword, 10);
    await execute(
      'UPDATE DC_Users SET Password = @hash WHERE Id = @id',
      {
        id:   { type: sql.NVarChar, value: userId },
        hash: { type: sql.NVarChar, value: hash },
      }
    );
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Password reset error:', err.message);
    res.status(500).json({ message: 'Failed to reset password' });
  }
});

/**
 * POST /api/admin/reset-all-directors
 * One-time helper: set all 3 directors to Director@123
 */
router.post('/reset-all-directors', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const hash = await bcrypt.hash('Director@123', 10);
    await execute(
      "UPDATE DC_Users SET Password = @hash WHERE Role = 'director'",
      { hash: { type: sql.NVarChar, value: hash } }
    );
    res.json({ message: 'All director passwords set to Director@123' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to reset passwords' });
  }
});

module.exports = router;
