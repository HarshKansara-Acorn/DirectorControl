const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { execute, sql, queryOne } = require('../config/db');
const outlookService = require('../services/outlookService');

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

router.post('/director/:id/connect-outlook', authenticateToken, requireAdmin, async (req, res) => {
  const directorId = req.params.id;

  try {
    const director = await queryOne(
      "SELECT Id FROM DC_Users WHERE Id = @id AND Role = 'director'",
      { id: { type: sql.NVarChar, value: directorId } }
    );

    if (!director) {
      return res.status(404).json({ message: 'Director not found' });
    }

    if (!outlookService.isConfigured()) {
      return res.status(503).json({ message: 'Outlook integration not configured' });
    }

    const authUrl = outlookService.getAuthUrlForDirector(directorId, 'settings');
    await outlookService.createPendingConnection(directorId);
    res.json({ authUrl });
  } catch (err) {
    console.error('Connect Outlook error:', err.message);
    res.status(500).json({ message: 'Failed to generate Outlook connection link' });
  }
});

router.post('/director/:id/disconnect-outlook', authenticateToken, requireAdmin, async (req, res) => {
  const directorId = req.params.id;

  try {
    const director = await queryOne(
      "SELECT Id FROM DC_Users WHERE Id = @id AND Role = 'director'",
      { id: { type: sql.NVarChar, value: directorId } }
    );

    if (!director) {
      return res.status(404).json({ message: 'Director not found' });
    }

    await outlookService.disconnect(directorId);
    res.json({ message: 'Outlook disconnected for director' });
  } catch (err) {
    console.error('Disconnect Outlook error:', err.message);
    res.status(500).json({ message: 'Failed to disconnect Outlook' });
  }
});

router.get('/director/:id/outlook-status', authenticateToken, requireAdmin, async (req, res) => {
  const directorId = req.params.id;

  try {
    const director = await queryOne(
      "SELECT Id FROM DC_Users WHERE Id = @id AND Role = 'director'",
      { id: { type: sql.NVarChar, value: directorId } }
    );

    if (!director) {
      return res.status(404).json({ message: 'Director not found' });
    }

    const status = await outlookService.getConnectionStatus(directorId);
    res.json(status);
  } catch (err) {
    console.error('Outlook status error:', err.message);
    res.status(500).json({ message: 'Failed to load Outlook status' });
  }
});

router.get('/director/:id/calendar', authenticateToken, requireAdmin, async (req, res) => {
  const directorId = req.params.id;
  try {
    const status = await outlookService.getConnectionStatus(directorId);
    if (!status.connected) {
      return res.status(404).json({ message: 'Director Outlook not connected', connected: false });
    }
    const events = await outlookService.getSyncedCalendar(directorId);
    res.json(events);
  } catch (err) {
    console.error('Admin Outlook calendar error:', err.message);
    res.status(500).json({ message: 'Failed to load Outlook calendar' });
  }
});

router.get('/director/:id/emails', authenticateToken, requireAdmin, async (req, res) => {
  const directorId = req.params.id;
  try {
    const status = await outlookService.getConnectionStatus(directorId);
    if (!status.connected) {
      return res.status(404).json({ message: 'Director Outlook not connected', connected: false });
    }
    const emails = await outlookService.getSyncedEmails(directorId);
    res.json(emails);
  } catch (err) {
    console.error('Admin Outlook emails error:', err.message);
    res.status(500).json({ message: 'Failed to load Outlook emails' });
  }
});

router.get('/director/:id/tasks', authenticateToken, requireAdmin, async (req, res) => {
  const directorId = req.params.id;
  try {
    const status = await outlookService.getConnectionStatus(directorId);
    if (!status.connected) {
      return res.status(404).json({ message: 'Director Outlook not connected', connected: false });
    }
    const tasks = await outlookService.getSyncedTasks(directorId);
    res.json(tasks);
  } catch (err) {
    console.error('Admin Outlook tasks error:', err.message);
    res.status(500).json({ message: 'Failed to load Outlook tasks' });
  }
});

router.get('/director/:id/reminders', authenticateToken, requireAdmin, async (req, res) => {
  const directorId = req.params.id;
  try {
    const status = await outlookService.getConnectionStatus(directorId);
    if (!status.connected) {
      return res.status(404).json({ message: 'Director Outlook not connected', connected: false });
    }
    const reminders = await outlookService.getSyncedReminders(directorId);
    res.json(reminders);
  } catch (err) {
    console.error('Admin Outlook reminders error:', err.message);
    res.status(500).json({ message: 'Failed to load Outlook reminders' });
  }
});

router.get('/director/:id/approvals', authenticateToken, requireAdmin, async (req, res) => {
  const directorId = req.params.id;
  try {
    const status = await outlookService.getConnectionStatus(directorId);
    if (!status.connected) {
      return res.status(404).json({ message: 'Director Outlook not connected', connected: false });
    }
    const approvals = await outlookService.getApprovals(directorId);
    res.json(approvals);
  } catch (err) {
    console.error('Admin Outlook approvals error:', err.message);
    res.status(500).json({ message: 'Failed to load Outlook approvals' });
  }
});

module.exports = router;
