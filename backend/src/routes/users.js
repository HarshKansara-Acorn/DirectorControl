const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, sql } = require('../config/db');

// ── Helpers ──────────────────────────────────────────────────────────────────

const mapUser = (u) => ({
  id:          u.Id,
  name:        u.Name,
  firstName:   u.FirstName || '',
  lastName:    u.LastName  || '',
  email:       u.Email,
  role:        u.Role,
  title:       u.Title     || '',
  avatar:      u.Avatar    || '',
  avatarColor: u.AvatarColor || '#1e40af',
  avatarPhoto: u.AvatarPhoto || null,
  phone:       u.Phone     || '',
  bio:         u.Bio       || '',
  location:    u.Location  || '',
  department:  u.Department || '',
  twoFAEnabled: u.TwoFAEnabled === true || u.TwoFAEnabled === 1,
  isActive:    u.IsActive === true || u.IsActive === 1,
  lastLoginAt: u.LastLoginAt || null,
  createdAt:   u.CreatedAt  || null,
});

// ── GET /api/users/directors ──────────────────────────────────────────────────
router.get('/directors', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const rows = await query(
      "SELECT Id,Name,Email,Role,Title,Avatar,AvatarColor,FirstName,LastName,Department FROM DC_Users WHERE Role='director' ORDER BY Name"
    );
    res.json(rows.map(mapUser));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch directors' });
  }
});

// ── GET /api/users/me ─────────────────────────────────────────────────────────
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const u = await queryOne(
      'SELECT * FROM DC_Users WHERE Id=@id',
      { id: { type: sql.NVarChar, value: req.user.id } }
    );
    if (!u) return res.status(404).json({ message: 'User not found' });
    res.json(mapUser(u));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// ── PUT /api/users/me/profile — update profile info ──────────────────────────
router.put('/me/profile', authenticateToken, async (req, res) => {
  const { firstName, lastName, phone, bio, location, department, title, avatarColor } = req.body;
  try {
    // Rebuild display name from first+last
    const name = [firstName, lastName].filter(Boolean).join(' ') || req.user.name;

    await execute(
      `UPDATE DC_Users SET
        FirstName=@fn, LastName=@ln, Name=@name,
        Phone=@phone, Bio=@bio, Location=@loc,
        Department=@dept, Title=@title, AvatarColor=@color,
        UpdatedAt=GETUTCDATE()
       WHERE Id=@id`,
      {
        id:    { type: sql.NVarChar, value: req.user.id },
        fn:    { type: sql.NVarChar, value: firstName   || '' },
        ln:    { type: sql.NVarChar, value: lastName    || '' },
        name:  { type: sql.NVarChar, value: name },
        phone: { type: sql.NVarChar, value: phone       || '' },
        bio:   { type: sql.NVarChar, value: bio         || '' },
        loc:   { type: sql.NVarChar, value: location    || '' },
        dept:  { type: sql.NVarChar, value: department  || '' },
        title: { type: sql.NVarChar, value: title       || '' },
        color: { type: sql.NVarChar, value: avatarColor || '#1e40af' },
      }
    );

    const updated = await queryOne('SELECT * FROM DC_Users WHERE Id=@id', { id: { type: sql.NVarChar, value: req.user.id } });
    res.json(mapUser(updated));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to update profile' });
  }
});

// ── PUT /api/users/me/avatar — update avatar initials ────────────────────────
router.put('/me/avatar', authenticateToken, async (req, res) => {
  const { avatar, avatarColor } = req.body;
  try {
    await execute(
      'UPDATE DC_Users SET Avatar=@avatar, AvatarColor=@color, UpdatedAt=GETUTCDATE() WHERE Id=@id',
      {
        id:     { type: sql.NVarChar, value: req.user.id },
        avatar: { type: sql.NVarChar, value: avatar      || '' },
        color:  { type: sql.NVarChar, value: avatarColor || '#1e40af' },
      }
    );
    res.json({ message: 'Avatar updated' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to update avatar' });
  }
});

// ── PUT /api/users/me/photo — upload profile picture (base64) ────────────────
router.put('/me/photo', authenticateToken, async (req, res) => {
  const { photo } = req.body;

  if (!photo) return res.status(400).json({ message: 'No photo provided' });

  // Must be a valid image data URL
  const validPrefix = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/i;
  if (!validPrefix.test(photo)) {
    return res.status(400).json({ message: 'Invalid image format. Use JPEG, PNG, GIF or WebP.' });
  }

  // After client-side resize the base64 should be well under 500kb.
  // Hard cap at 5MB base64 string (~3.75MB raw) as a safety net.
  const MAX_B64_LEN = 5 * 1024 * 1024;
  if (photo.length > MAX_B64_LEN) {
    return res.status(413).json({ message: 'Image too large. Please use a smaller image.' });
  }

  try {
    // Use NVarChar(MAX) explicitly so mssql doesn't truncate large strings
    const pool = await require('../config/db').getPool();
    await pool.request()
      .input('id',    sql.NVarChar(36),  req.user.id)
      .input('photo', sql.NVarChar(sql.MAX), photo)
      .query('UPDATE DC_Users SET AvatarPhoto=@photo, UpdatedAt=GETUTCDATE() WHERE Id=@id');

    res.json({ message: 'Profile photo updated', avatarPhoto: photo });
  } catch (err) {
    console.error('Photo upload error:', err.message);
    res.status(500).json({ message: 'Failed to save photo', error: err.message });
  }
});

// ── DELETE /api/users/me/photo — remove profile picture ──────────────────────
router.delete('/me/photo', authenticateToken, async (req, res) => {
  try {
    await execute(
      'UPDATE DC_Users SET AvatarPhoto=NULL, UpdatedAt=GETUTCDATE() WHERE Id=@id',
      { id: { type: sql.NVarChar, value: req.user.id } }
    );
    res.json({ message: 'Profile photo removed' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove photo' });
  }
});

// ── PUT /api/users/me/password — change password ─────────────────────────────
router.put('/me/password', authenticateToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword)
    return res.status(400).json({ message: 'Current and new password are required' });

  if (newPassword.length < 8)
    return res.status(400).json({ message: 'New password must be at least 8 characters' });

  try {
    const u = await queryOne('SELECT Password FROM DC_Users WHERE Id=@id', { id: { type: sql.NVarChar, value: req.user.id } });
    if (!u) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(currentPassword, u.Password);
    if (!isMatch) return res.status(401).json({ message: 'Current password is incorrect' });

    const hash = await bcrypt.hash(newPassword, 10);
    await execute(
      'UPDATE DC_Users SET Password=@hash, UpdatedAt=GETUTCDATE() WHERE Id=@id',
      {
        id:   { type: sql.NVarChar, value: req.user.id },
        hash: { type: sql.NVarChar, value: hash },
      }
    );
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to change password' });
  }
});

// ── PUT /api/users/me/2fa — legacy toggle (kept for backwards compat, no-op) ─
// Real 2FA setup/disable is handled by /api/auth/2fa/* endpoints
router.put('/me/2fa', authenticateToken, async (req, res) => {
  // Return current state — actual enable/disable requires the auth flow
  try {
    const u = await queryOne(
      'SELECT TwoFAEnabled FROM DC_Users WHERE Id=@id',
      { id: { type: sql.NVarChar, value: req.user.id } }
    );
    const enabled = u?.TwoFAEnabled === true || u?.TwoFAEnabled === 1;
    res.json({ twoFAEnabled: enabled, message: 'Use /api/auth/2fa/setup to enable 2FA' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch 2FA status' });
  }
});

// ── DELETE /api/users/me — deactivate account ────────────────────────────────
router.delete('/me', authenticateToken, async (req, res) => {
  const { password, action } = req.body; // action: 'deactivate' | 'delete'

  if (!password) return res.status(400).json({ message: 'Password confirmation required' });

  try {
    const u = await queryOne('SELECT * FROM DC_Users WHERE Id=@id', { id: { type: sql.NVarChar, value: req.user.id } });
    if (!u) return res.status(404).json({ message: 'User not found' });

    const isMatch = await bcrypt.compare(password, u.Password);
    if (!isMatch) return res.status(401).json({ message: 'Incorrect password' });

    if (action === 'delete') {
      await execute('DELETE FROM DC_Users WHERE Id=@id', { id: { type: sql.NVarChar, value: req.user.id } });
      return res.json({ message: 'Account permanently deleted' });
    }

    // Default: deactivate
    await execute(
      'UPDATE DC_Users SET IsActive=0, UpdatedAt=GETUTCDATE() WHERE Id=@id',
      { id: { type: sql.NVarChar, value: req.user.id } }
    );
    res.json({ message: 'Account deactivated' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to process account action' });
  }
});

// ── GET /api/users/me/sessions — active sessions (simplified) ────────────────
router.get('/me/sessions', authenticateToken, async (req, res) => {
  // In a real app this would query a sessions table
  // For now return the current session info
  res.json([{
    id: 'current',
    device: 'Current Session',
    browser: req.headers['user-agent']?.split(' ').pop() || 'Unknown',
    ip: req.ip || 'Unknown',
    lastActive: new Date().toISOString(),
    isCurrent: true,
  }]);
});

module.exports = router;
