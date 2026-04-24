const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const teamsService = require('../services/teamsService');
const { users } = require('../data/mockData');

// ─────────────────────────────────────────────────────────────────────────────
// OAuth Flow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/teams/auth/connect?directorId=xxx
 * Redirects the director (or PA on their behalf) to Microsoft login.
 */
router.get('/auth/connect', authenticateToken, (req, res) => {
  const directorId = req.query.directorId || req.user.id;

  // Only admin can connect on behalf of a director
  if (req.user.role !== 'admin' && req.user.id !== directorId) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  if (!process.env.AZURE_CLIENT_ID || process.env.AZURE_CLIENT_ID === 'your_azure_app_client_id') {
    return res.status(503).json({
      message: 'Teams integration not configured. Please set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET and AZURE_TENANT_ID in backend/.env',
      configured: false,
    });
  }

  const authUrl = teamsService.getAuthUrl(directorId);
  res.json({ authUrl });
});

/**
 * GET /api/teams/auth/callback?code=xxx&state=directorId
 * Microsoft redirects here after user consents.
 */
router.get('/auth/callback', async (req, res) => {
  const { code, state: directorId, error, error_description } = req.query;

  if (error) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/teams?error=${encodeURIComponent(error_description || error)}`
    );
  }

  if (!code || !directorId) {
    return res.redirect(`${process.env.FRONTEND_URL}/teams?error=Invalid+callback`);
  }

  try {
    const tokens = await teamsService.exchangeCodeForTokens(code);
    // Get the MS user profile to store their email
    teamsService.storeTokens(directorId, tokens, '');
    const profile = await teamsService.getUserProfile(directorId);
    teamsService.storeTokens(directorId, tokens, profile.email);

    res.redirect(`${process.env.FRONTEND_URL}/teams?connected=true&directorId=${directorId}`);
  } catch (err) {
    console.error('Teams OAuth callback error:', err.message);
    res.redirect(`${process.env.FRONTEND_URL}/teams?error=${encodeURIComponent('Authentication failed')}`);
  }
});

/**
 * POST /api/teams/auth/disconnect
 * Disconnect a director's Teams account.
 */
router.post('/auth/disconnect', authenticateToken, (req, res) => {
  const { directorId } = req.body;
  const targetId = directorId || req.user.id;

  if (req.user.role !== 'admin' && req.user.id !== targetId) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  teamsService.disconnect(targetId);
  res.json({ message: 'Teams account disconnected' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/teams/status?directorId=xxx
 * Returns connection status for a director.
 */
router.get('/status', authenticateToken, (req, res) => {
  const directorId = req.query.directorId || req.user.id;
  const connected = teamsService.isConnected(directorId);
  const stored = teamsService.tokenStore[directorId];

  res.json({
    connected,
    msUserEmail: stored?.msUserEmail || null,
    configured: !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_ID !== 'your_azure_app_client_id'),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Data Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/teams/summary?directorId=xxx
 * Full Teams data summary — calendar, tasks, presence, mailbox, chats.
 */
router.get('/summary', authenticateToken, async (req, res) => {
  const directorId = req.query.directorId || req.user.id;

  if (!teamsService.isConnected(directorId)) {
    return res.status(404).json({ message: 'Teams not connected for this director', connected: false });
  }

  try {
    const summary = await teamsService.getTeamsSummary(directorId);
    res.json({ connected: true, ...summary });
  } catch (err) {
    if (err.message === 'NOT_CONNECTED') {
      return res.status(404).json({ message: 'Teams not connected', connected: false });
    }
    console.error('Teams summary error:', err.message);
    res.status(500).json({ message: 'Failed to fetch Teams data', error: err.message });
  }
});

/**
 * GET /api/teams/calendar?directorId=xxx&days=30
 * Calendar events from Microsoft.
 */
router.get('/calendar', authenticateToken, async (req, res) => {
  const directorId = req.query.directorId || req.user.id;
  const days = parseInt(req.query.days) || 30;

  if (!teamsService.isConnected(directorId)) {
    return res.status(404).json({ message: 'Teams not connected', connected: false });
  }

  try {
    const events = await teamsService.getCalendarEvents(directorId, days);
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch calendar', error: err.message });
  }
});

/**
 * GET /api/teams/today?directorId=xxx
 * Today's calendar events — used to enrich the Dashboard meetings card.
 */
router.get('/today', authenticateToken, async (req, res) => {
  const directorId = req.query.directorId || req.user.id;

  if (!teamsService.isConnected(directorId)) {
    return res.json([]);
  }

  try {
    const events = await teamsService.getTodayEvents(directorId);
    res.json(events);
  } catch (err) {
    res.json([]);
  }
});

/**
 * GET /api/teams/tasks?directorId=xxx
 * Microsoft To Do tasks.
 */
router.get('/tasks', authenticateToken, async (req, res) => {
  const directorId = req.query.directorId || req.user.id;

  if (!teamsService.isConnected(directorId)) {
    return res.status(404).json({ message: 'Teams not connected', connected: false });
  }

  try {
    const tasks = await teamsService.getTasks(directorId);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch tasks', error: err.message });
  }
});

/**
 * GET /api/teams/presence?directorId=xxx
 * Director's current Teams presence.
 */
router.get('/presence', authenticateToken, async (req, res) => {
  const directorId = req.query.directorId || req.user.id;

  if (!teamsService.isConnected(directorId)) {
    return res.json({ availability: 'Unknown', activity: 'Unknown' });
  }

  try {
    const presence = await teamsService.getPresence(directorId);
    res.json(presence);
  } catch (err) {
    res.json({ availability: 'Unknown', activity: 'Unknown' });
  }
});

/**
 * POST /api/teams/sync?directorId=xxx
 * Sync Teams calendar events into our local events store.
 * PA can trigger this to import Teams meetings into DirectorControl.
 */
router.post('/sync', authenticateToken, requireAdmin, async (req, res) => {
  const { directorId } = req.body;

  if (!teamsService.isConnected(directorId)) {
    return res.status(404).json({ message: 'Teams not connected for this director' });
  }

  try {
    const { events } = require('../data/mockData');
    const calEvents = await teamsService.getCalendarEvents(directorId, 60);

    let added = 0;
    let skipped = 0;

    calEvents.forEach(te => {
      // Skip if already synced (check by teams source id)
      const exists = events.find(e => e.teamsId === te.id);
      if (exists) { skipped++; return; }

      events.push({
        id: require('uuid').v4(),
        teamsId: te.id,
        source: 'teams',
        title: te.title,
        description: te.description,
        type: te.isTeamsMeeting ? 'teams_meeting' : 'meeting',
        directorId,
        startDate: te.startDate,
        endDate: te.endDate,
        startTime: te.startTime,
        endTime: te.endTime,
        location: te.location,
        attendees: te.attendees,
        isAllDay: te.isAllDay,
        priority: te.importance === 'high' ? 'high' : 'medium',
        status: 'upcoming',
        joinUrl: te.joinUrl,
        organizer: te.organizer,
        notes: '',
        createdBy: req.user.id,
        createdAt: new Date().toISOString(),
      });
      added++;
    });

    res.json({ message: `Sync complete. Added: ${added}, Skipped (already exists): ${skipped}` });
  } catch (err) {
    console.error('Teams sync error:', err.message);
    res.status(500).json({ message: 'Sync failed', error: err.message });
  }
});

module.exports = router;
