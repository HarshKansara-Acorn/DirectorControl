/**
 * One-time migration routes — NO AUTH REQUIRED
 * Remove this file after running once
 */
const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { execute, sql } = require('../config/db');

/**
 * POST /api/migrate/reset-passwords
 * Sets all users to their correct passwords:
 *  - PA: Admin@123
 *  - Directors: Director@123
 */
router.post('/reset-passwords', async (req, res) => {
  try {
    const adminHash = await bcrypt.hash('Admin@123', 10);
    const directorHash = await bcrypt.hash('Director@123', 10);

    // Update PA
    await execute(
      "UPDATE DC_Users SET Password = @hash WHERE Role = 'admin'",
      { hash: { type: sql.NVarChar, value: adminHash } }
    );

    // Update all directors
    await execute(
      "UPDATE DC_Users SET Password = @hash WHERE Role = 'director'",
      { hash: { type: sql.NVarChar, value: directorHash } }
    );

    res.json({
      message: 'Passwords reset successfully',
      details: {
        admin: 'Admin@123',
        directors: 'Director@123',
      },
    });
  } catch (err) {
    console.error('Password reset error:', err.message);
    res.status(500).json({ message: 'Failed to reset passwords', error: err.message });
  }
});

module.exports = router;
