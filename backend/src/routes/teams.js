const express = require('express');
const router = express.Router();
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const teamsService = require('../services/teamsService');
const { execute, query, sql } = require('../config/db');
const { v4: uuidv4 } = require('uuid');

const mapOutlookTaskStatusToApp = (status) => {
  switch ((status || '').toLowerCase()) {
    case 'completed':
      return 'done';
    case 'inprogress':
      return 'inprogress';
    case 'waitingonothers':
      return 'review';
    case 'deferred':
      return 'review';
    case 'notstarted':
    default:
      return 'todo';
  }
};

const mapOutlookTaskPriorityToApp = (importance) => {
  if ((importance || '').toLowerCase() === 'high') return 'high';
  if ((importance || '').toLowerCase() === 'low') return 'low';
  return 'medium';
};

const syncOutlookTasksToApp = async ({ directorId, tokenUserId }) => {
  const outlookTasks = await teamsService.getTasks(tokenUserId);
  let added = 0;
  let updated = 0;

  for (const ot of outlookTasks) {
    const extId = ot.id || '';
    const normalizedExtId = extId.startsWith('teams-task-') ? extId : `teams-task-${extId}`;
    if (!normalizedExtId) continue;

    const dueDate = ot.dueDate ? new Date(ot.dueDate) : null;
    const status = mapOutlookTaskStatusToApp(ot.status);
    const priority = mapOutlookTaskPriorityToApp(ot.importance);
    const tags = ot.listName ? [ot.listName] : [];

    const existing = await query(
      `SELECT Id FROM DC_Tasks
       WHERE ExternalTaskId = @extId AND AssignedTo = @directorId`,
      {
        extId: { type: sql.NVarChar, value: normalizedExtId },
        directorId: { type: sql.NVarChar, value: directorId },
      }
    );

    if (existing.length > 0) {
      await execute(
        `UPDATE DC_Tasks SET
           Title=@title, Description=@desc, Priority=@priority, Status=@status,
           DueDate=@dueDate, Tags=@tags, Source='outlook', UpdatedAt=GETUTCDATE()
         WHERE ExternalTaskId=@extId AND AssignedTo=@directorId`,
        {
          title: { type: sql.NVarChar, value: ot.title || '(No title)' },
          desc: { type: sql.NVarChar, value: ot.body || '' },
          priority: { type: sql.NVarChar, value: priority },
          status: { type: sql.NVarChar, value: status },
          dueDate: { type: sql.Date, value: dueDate },
          tags: { type: sql.NVarChar, value: JSON.stringify(tags) },
          extId: { type: sql.NVarChar, value: normalizedExtId },
          directorId: { type: sql.NVarChar, value: directorId },
        }
      );
      updated++;
    } else {
      await execute(
        `INSERT INTO DC_Tasks
          (Id, Title, Description, Priority, Status, AssignedTo, CreatedBy, DueDate, DueTime, Tags, ExternalTaskId, Source, CreatedAt, UpdatedAt)
         VALUES
          (@id, @title, @desc, @priority, @status, @assignedTo, @createdBy, @dueDate, NULL, @tags, @extId, 'outlook', GETUTCDATE(), GETUTCDATE())`,
        {
          id: { type: sql.NVarChar, value: uuidv4() },
          title: { type: sql.NVarChar, value: ot.title || '(No title)' },
          desc: { type: sql.NVarChar, value: ot.body || '' },
          priority: { type: sql.NVarChar, value: priority },
          status: { type: sql.NVarChar, value: status },
          assignedTo: { type: sql.NVarChar, value: directorId },
          // Keep ownership with the in-app director context so visibility is consistent.
          createdBy: { type: sql.NVarChar, value: directorId },
          dueDate: { type: sql.Date, value: dueDate },
          tags: { type: sql.NVarChar, value: JSON.stringify(tags) },
          extId: { type: sql.NVarChar, value: normalizedExtId },
        }
      );
      added++;
    }
  }

  return { total: outlookTasks.length, added, updated };
};

// ─────────────────────────────────────────────────────────────────────────────
// OAuth Flow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/teams/auth/connect?userId=xxx&returnTo=settings|teams
 * Any authenticated user can connect their own account.
 * Admin can also connect on behalf of another user by passing userId.
 */
router.get('/auth/connect', authenticateToken, (req, res) => {
  const targetId  = req.query.userId || req.user.id;
  const returnTo  = req.query.returnTo || 'settings'; // 'settings' or 'teams'

  // Only admin can connect on behalf of someone else
  if (req.user.role !== 'admin' && req.user.id !== targetId) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  if (!process.env.AZURE_CLIENT_ID || process.env.AZURE_CLIENT_ID === 'your_azure_app_client_id') {
    return res.status(503).json({
      message: 'Teams integration not configured. Please set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET and AZURE_TENANT_ID in backend/.env',
      configured: false,
    });
  }

  // Encode both userId and returnTo in the state param
  const state = JSON.stringify({ userId: targetId, returnTo });
  const authUrl = teamsService.getAuthUrl(state);
  res.json({ authUrl });
});

/**
 * GET /api/teams/auth/callback?code=xxx&state=...
 * Microsoft redirects here after user consents.
 * State contains { userId, returnTo }.
 */
router.get('/auth/callback', async (req, res) => {
  const { code, state: rawState, error, error_description } = req.query;

  // Parse state — support both old plain-string format and new JSON format
  let userId, returnTo;
  try {
    const parsed = JSON.parse(rawState);
    userId   = parsed.userId;
    returnTo = parsed.returnTo || 'settings';
  } catch {
    // Legacy: state was just the directorId string
    userId   = rawState;
    returnTo = 'teams';
  }

  const redirectBase = process.env.FRONTEND_URL || 'http://localhost:3000';
  const returnPath   = '/settings?section=linked';

  if (error) {
    return res.redirect(
      `${redirectBase}${returnPath}&teamsError=${encodeURIComponent(error_description || error)}`
    );
  }

  if (!code || !userId) {
    return res.redirect(`${redirectBase}${returnPath}&teamsError=Invalid+callback`);
  }

  try {
    const tokens  = await teamsService.exchangeCodeForTokens(code);
    // Temporarily store with empty email so we can call getUserProfile
    await teamsService.storeTokens(userId, tokens, '');
    const profile = await teamsService.getUserProfile(userId);
    await teamsService.storeTokens(userId, tokens, profile.email);

    res.redirect(`${redirectBase}${returnPath}&teamsConnected=true&userId=${userId}`);
  } catch (err) {
    console.error('Teams OAuth callback error:', err.message);
    res.redirect(`${redirectBase}${returnPath}&teamsError=${encodeURIComponent('Authentication failed')}`);
  }
});

/**
 * POST /api/teams/auth/disconnect
 * Any user can disconnect their own account. Admin can disconnect any user.
 */
router.post('/auth/disconnect', authenticateToken, async (req, res) => {
  const targetId = req.body.userId || req.body.directorId || req.user.id;

  if (req.user.role !== 'admin' && req.user.id !== targetId) {
    return res.status(403).json({ message: 'Not authorized' });
  }

  await teamsService.disconnect(targetId);
  res.json({ message: 'Teams account disconnected' });
});

// ─────────────────────────────────────────────────────────────────────────────
// Status
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/teams/status?userId=xxx
 * Returns connection status.
 * For admin: checks the requested userId first, then falls back to the admin's own token.
 */
router.get('/status', authenticateToken, async (req, res) => {
  const targetId = req.query.userId || req.query.directorId || req.user.id;

  // Check the target user's token
  let connected = await teamsService.isConnected(targetId);
  let stored = teamsService.tokenStore[targetId];

  // If admin is checking and target has no token, check if the admin themselves has one
  // (admin connected Outlook from their own Settings — their token can be used for syncing)
  if (!connected && req.user.role === 'admin' && targetId !== req.user.id) {
    const adminConnected = await teamsService.isConnected(req.user.id);
    if (adminConnected) {
      connected = true;
      stored = teamsService.tokenStore[req.user.id];
    }
  }

  res.json({
    connected,
    msUserEmail: stored?.msUserEmail || null,
    tokenUserId: stored ? (teamsService.tokenStore[targetId] ? targetId : req.user.id) : null,
    configured: !!(process.env.AZURE_CLIENT_ID && process.env.AZURE_CLIENT_ID !== 'your_azure_app_client_id'),
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Data Endpoints
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/teams/summary?userId=xxx
 */
router.get('/summary', authenticateToken, async (req, res) => {
  const targetId = req.query.userId || req.query.directorId || req.user.id;

  if (!(await teamsService.isConnected(targetId))) {
    return res.status(404).json({ message: 'Teams not connected for this user', connected: false });
  }

  try {
    const summary = await teamsService.getTeamsSummary(targetId);
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
 * GET /api/teams/calendar?userId=xxx&days=30
 */
router.get('/calendar', authenticateToken, async (req, res) => {
  const targetId = req.query.userId || req.query.directorId || req.user.id;
  const days = parseInt(req.query.days) || 30;

  if (!(await teamsService.isConnected(targetId))) {
    return res.status(404).json({ message: 'Teams not connected', connected: false });
  }

  try {
    const events = await teamsService.getCalendarEvents(targetId, days);
    res.json(events);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch calendar', error: err.message });
  }
});

/**
 * GET /api/teams/today?userId=xxx
 */
router.get('/today', authenticateToken, async (req, res) => {
  const targetId = req.query.userId || req.query.directorId || req.user.id;

  if (!(await teamsService.isConnected(targetId))) {
    return res.json([]);
  }

  try {
    const events = await teamsService.getTodayEvents(targetId);
    res.json(events);
  } catch (err) {
    res.json([]);
  }
});

/**
 * GET /api/teams/tasks?userId=xxx
 */
router.get('/tasks', authenticateToken, async (req, res) => {
  const targetId = req.query.userId || req.query.directorId || req.user.id;

  if (!(await teamsService.isConnected(targetId))) {
    return res.status(404).json({ message: 'Teams not connected', connected: false });
  }

  try {
    const tasks = await teamsService.getTasks(targetId);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch tasks', error: err.message });
  }
});

/**
 * GET /api/teams/presence?userId=xxx
 */
router.get('/presence', authenticateToken, async (req, res) => {
  const targetId = req.query.userId || req.query.directorId || req.user.id;

  if (!(await teamsService.isConnected(targetId))) {
    return res.json({ availability: 'Unknown', activity: 'Unknown' });
  }

  try {
    const presence = await teamsService.getPresence(targetId);
    res.json(presence);
  } catch (err) {
    res.json({ availability: 'Unknown', activity: 'Unknown' });
  }
});

/**
 * GET /api/teams/unread-mail
 * Returns unread emails from the user's Outlook inbox.
 * Falls back to admin's token if user has no token (same pattern as sync).
 */
router.get('/unread-mail', authenticateToken, async (req, res) => {
  const targetId = req.query.userId || req.user.id;

  // Token resolution: user's own token → admin's token → not connected
  let tokenUserId = null;
  if (await teamsService.isConnected(targetId)) {
    tokenUserId = targetId;
  } else if (req.user.role === 'admin' && await teamsService.isConnected(req.user.id)) {
    tokenUserId = req.user.id;
  }

  if (!tokenUserId) {
    return res.json({ connected: false, mails: [] });
  }

  try {
    const mails = await teamsService.getUnreadMails(tokenUserId);
    res.json({ connected: true, mails });
  } catch (err) {
    console.error('Unread mail error:', err.message);
    res.json({ connected: true, mails: [] });
  }
});

/**
 * POST /api/teams/sync — Sync Outlook calendar into DC_Events. Admin only.
 */
router.post('/sync', authenticateToken, requireAdmin, async (req, res) => {
  const { directorId } = req.body;
  if (!directorId) return res.status(400).json({ message: 'directorId is required' });

  // Resolve which token to use for fetching calendar data
  let tokenUserId = null;

  if (await teamsService.isConnected(directorId)) {
    // Director has their own Outlook connected
    tokenUserId = directorId;
  } else if (await teamsService.isConnected(req.user.id)) {
    // Admin has Outlook connected — use admin's calendar on behalf of the director
    tokenUserId = req.user.id;
  } else {
    return res.status(404).json({
      message: 'No Outlook account connected. Please connect Outlook from Settings → Linked Accounts first.',
    });
  }

  try {
    const calEvents = await teamsService.getCalendarEvents(tokenUserId, 60);

    let added = 0;
    let skipped = 0;

    for (const te of calEvents) {
      // Check if already synced by TeamsId for this director
      const existing = await query(
        'SELECT Id FROM DC_Events WHERE TeamsId = @tid AND DirectorId = @did',
        {
          tid: { type: sql.NVarChar, value: te.id },
          did: { type: sql.NVarChar, value: directorId },
        }
      );

      if (existing.length > 0) { skipped++; continue; }

      await execute(
        `INSERT INTO DC_Events
          (Id, Title, Description, Type, DirectorId, StartDate, EndDate,
           StartTime, EndTime, Location, Attendees, IsAllDay, Priority,
           Status, Notes, TeamsId, JoinUrl, Source, CreatedBy, CreatedAt)
         VALUES
          (@id, @title, @desc, @type, @did, @sd, @ed,
           @st, @et, @loc, @att, @allday, @pri,
           @status, @notes, @tid, @jurl, 'outlook', @cb, GETUTCDATE())`,
        {
          id:     { type: sql.NVarChar, value: uuidv4() },
          title:  { type: sql.NVarChar, value: te.title },
          desc:   { type: sql.NVarChar, value: te.description || '' },
          type:   { type: sql.NVarChar, value: te.isOnlineMeeting ? 'online_meeting' : 'meeting' },
          did:    { type: sql.NVarChar, value: directorId },
          sd:     { type: sql.Date,     value: new Date(te.startDate) },
          ed:     { type: sql.Date,     value: new Date(te.endDate || te.startDate) },
          st:     { type: sql.NVarChar, value: te.startTime || '' },
          et:     { type: sql.NVarChar, value: te.endTime || '' },
          loc:    { type: sql.NVarChar, value: te.location || '' },
          att:    { type: sql.NVarChar, value: JSON.stringify(te.attendees || []) },
          allday: { type: sql.Bit,      value: te.isAllDay ? 1 : 0 },
          pri:    { type: sql.NVarChar, value: te.importance === 'high' ? 'high' : 'medium' },
          status: { type: sql.NVarChar, value: 'upcoming' },
          notes:  { type: sql.NVarChar, value: '' },
          tid:    { type: sql.NVarChar, value: te.id },
          jurl:   { type: sql.NVarChar, value: te.joinUrl || '' },
          cb:     { type: sql.NVarChar, value: req.user.id },
        }
      );
      added++;
    }

    const calendarOwner = tokenUserId === directorId ? 'director\'s' : 'your connected';
    res.json({
      message: `Outlook sync complete. Added: ${added}, Skipped (already exists): ${skipped}`,
      calendarUsed: teamsService.tokenStore[tokenUserId]?.msUserEmail || tokenUserId,
    });
  } catch (err) {
    console.error('Outlook sync error:', err.message);
    res.status(500).json({ message: 'Sync failed', error: err.message });
  }
});

/**
 * GET /api/teams/auto-sync?directorId=xxx
 * Pulls Outlook calendar events and upserts them into DC_Events.
 * Any authenticated user can call this (not just admin).
 * Used by the Events page to auto-sync every 30 seconds.
 * Token resolution: director's own token → admin's token → skip silently.
 */
router.get('/auto-sync', authenticateToken, async (req, res) => {
  const directorId = req.query.directorId || req.user.id;

  // Resolve token
  let tokenUserId = null;
  if (await teamsService.isConnected(directorId)) {
    tokenUserId = directorId;
  } else if (req.user.role === 'admin' && await teamsService.isConnected(req.user.id)) {
    tokenUserId = req.user.id;
  }

  // No token — return silently (not an error, just not connected)
  if (!tokenUserId) {
    return res.json({ synced: false, added: 0, updated: 0 });
  }

  try {
    const calEvents = await teamsService.getCalendarEvents(tokenUserId, 90);
    let added = 0;
    let updated = 0;

    for (const te of calEvents) {
      if (!te.startDate) continue;

      const existing = await query(
        'SELECT Id FROM DC_Events WHERE TeamsId = @tid AND DirectorId = @did',
        {
          tid: { type: sql.NVarChar, value: te.id },
          did: { type: sql.NVarChar, value: directorId },
        }
      );

      if (existing.length > 0) {
        // Update existing event in case title/time changed
        await execute(
          `UPDATE DC_Events SET
            Title=@title, Description=@desc, StartDate=@sd, EndDate=@ed,
            StartTime=@st, EndTime=@et, Location=@loc, IsAllDay=@allday,
            JoinUrl=@jurl
           WHERE TeamsId=@tid AND DirectorId=@did`,
          {
            title:  { type: sql.NVarChar, value: te.title },
            desc:   { type: sql.NVarChar, value: te.description || '' },
            sd:     { type: sql.Date,     value: new Date(te.startDate) },
            ed:     { type: sql.Date,     value: new Date(te.endDate || te.startDate) },
            st:     { type: sql.NVarChar, value: te.startTime || '' },
            et:     { type: sql.NVarChar, value: te.endTime || '' },
            loc:    { type: sql.NVarChar, value: te.location || '' },
            allday: { type: sql.Bit,      value: te.isAllDay ? 1 : 0 },
            jurl:   { type: sql.NVarChar, value: te.joinUrl || '' },
            tid:    { type: sql.NVarChar, value: te.id },
            did:    { type: sql.NVarChar, value: directorId },
          }
        );
        updated++;
      } else {
        // Insert new event
        await execute(
          `INSERT INTO DC_Events
            (Id, Title, Description, Type, DirectorId, StartDate, EndDate,
             StartTime, EndTime, Location, Attendees, IsAllDay, Priority,
             Status, Notes, TeamsId, JoinUrl, Source, CreatedBy, CreatedAt)
           VALUES
            (@id, @title, @desc, @type, @did, @sd, @ed,
             @st, @et, @loc, @att, @allday, @pri,
             'upcoming', '', @tid, @jurl, 'outlook', @cb, GETUTCDATE())`,
          {
            id:     { type: sql.NVarChar, value: uuidv4() },
            title:  { type: sql.NVarChar, value: te.title },
            desc:   { type: sql.NVarChar, value: te.description || '' },
            type:   { type: sql.NVarChar, value: te.isOnlineMeeting ? 'online_meeting' : 'meeting' },
            did:    { type: sql.NVarChar, value: directorId },
            sd:     { type: sql.Date,     value: new Date(te.startDate) },
            ed:     { type: sql.Date,     value: new Date(te.endDate || te.startDate) },
            st:     { type: sql.NVarChar, value: te.startTime || '' },
            et:     { type: sql.NVarChar, value: te.endTime || '' },
            loc:    { type: sql.NVarChar, value: te.location || '' },
            att:    { type: sql.NVarChar, value: JSON.stringify(te.attendees || []) },
            allday: { type: sql.Bit,      value: te.isAllDay ? 1 : 0 },
            pri:    { type: sql.NVarChar, value: te.importance === 'high' ? 'high' : 'medium' },
            tid:    { type: sql.NVarChar, value: te.id },
            jurl:   { type: sql.NVarChar, value: te.joinUrl || '' },
            cb:     { type: sql.NVarChar, value: req.user.id },
          }
        );
        added++;
      }
    }

    const taskSync = await syncOutlookTasksToApp({ directorId, tokenUserId });

    res.json({
      synced: true,
      added,
      updated,
      total: calEvents.length,
      tasksAdded: taskSync.added,
      tasksUpdated: taskSync.updated,
      tasksTotal: taskSync.total,
    });
  } catch (err) {
    console.error('Auto-sync error:', err.message);
    // Return success:false but don't throw — page should still load
    res.json({ synced: false, added: 0, updated: 0, error: err.message });
  }
});

module.exports = router;
