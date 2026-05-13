/**
 * Microsoft Graph API service for Outlook Calendar integration.
 *
 * Fetches from Graph API via OAuth2 (delegated permissions):
 *  - Outlook Calendar events
 *  - Mailbox settings (out-of-office / automatic replies)
 *  - User profile
 *
 * Auth flow: OAuth2 Authorization Code
 * Each user connects their own Microsoft/Outlook account.
 * Tokens are stored in DC_TeamsTokens table (reused for Outlook).
 */

const axios = require('axios');
const { query, queryOne, execute, sql } = require('../config/db');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// In-memory cache: { userId -> { accessToken, refreshToken, expiresAt, msUserEmail } }
const tokenStore = {};

// Scopes needed for Outlook Calendar integration
const OUTLOOK_SCOPES = [
  'offline_access',
  'User.Read',
  'Calendars.Read',
  'Calendars.ReadWrite',
  'MailboxSettings.Read',
  'Mail.Read',
].join(' ');

/**
 * Build the OAuth2 authorization URL for Outlook.
 * @param {string} state - JSON string containing { userId, returnTo }
 */
const getAuthUrl = (state) => {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.AZURE_REDIRECT_URI,
    response_mode: 'query',
    scope: OUTLOOK_SCOPES,
    state,
    // prompt=select_account lets the user pick which Microsoft account to use
    prompt: 'select_account',
  });

  return `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/authorize?${params}`;
};

/**
 * Exchange authorization code for tokens.
 */
const exchangeCodeForTokens = async (code) => {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    code,
    redirect_uri: process.env.AZURE_REDIRECT_URI,
    grant_type: 'authorization_code',
  });

  const res = await axios.post(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    expiresAt: Date.now() + res.data.expires_in * 1000,
  };
};

/**
 * Refresh an expired access token using the refresh token.
 */
const refreshAccessToken = async (userId) => {
  const stored = tokenStore[userId];
  if (!stored?.refreshToken) throw new Error('No refresh token available');

  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    refresh_token: stored.refreshToken,
    grant_type: 'refresh_token',
    scope: OUTLOOK_SCOPES,
  });

  const res = await axios.post(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const newTokens = {
    accessToken:  res.data.access_token,
    refreshToken: res.data.refresh_token || stored.refreshToken,
    expiresAt:    Date.now() + res.data.expires_in * 1000,
  };

  await storeTokens(userId, newTokens, stored.msUserEmail);
  return newTokens.accessToken;
};

/**
 * Get a valid access token for a user, loading from DB if needed, refreshing if expired.
 */
const getValidToken = async (userId) => {
  // Load from DB if not in memory
  if (!tokenStore[userId]) {
    await loadTokenFromDb(userId);
  }
  const stored = tokenStore[userId];
  if (!stored) return null;

  // Refresh if expiring within 5 minutes
  if (Date.now() >= stored.expiresAt - 5 * 60 * 1000) {
    return await refreshAccessToken(userId);
  }

  return stored.accessToken;
};

/**
 * Store tokens after OAuth callback — writes to DB and in-memory cache.
 */
const storeTokens = async (userId, tokens, msUserEmail) => {
  tokenStore[userId] = { ...tokens, msUserEmail };
  try {
    // Upsert into DC_TeamsTokens
    const exists = await queryOne(
      'SELECT DirectorId FROM DC_TeamsTokens WHERE DirectorId = @id',
      { id: { type: sql.NVarChar, value: userId } }
    );
    if (exists) {
      await execute(
        `UPDATE DC_TeamsTokens SET
          AccessToken  = @at,
          RefreshToken = @rt,
          ExpiresAt    = @ea,
          MsUserEmail  = @em,
          UpdatedAt    = GETUTCDATE()
        WHERE DirectorId = @id`,
        {
          at: { type: sql.NVarChar, value: tokens.accessToken },
          rt: { type: sql.NVarChar, value: tokens.refreshToken || '' },
          ea: { type: sql.BigInt,   value: tokens.expiresAt },
          em: { type: sql.NVarChar, value: msUserEmail || '' },
          id: { type: sql.NVarChar, value: userId },
        }
      );
    } else {
      await execute(
        `INSERT INTO DC_TeamsTokens (DirectorId, AccessToken, RefreshToken, ExpiresAt, MsUserEmail)
         VALUES (@id, @at, @rt, @ea, @em)`,
        {
          id: { type: sql.NVarChar, value: userId },
          at: { type: sql.NVarChar, value: tokens.accessToken },
          rt: { type: sql.NVarChar, value: tokens.refreshToken || '' },
          ea: { type: sql.BigInt,   value: tokens.expiresAt },
          em: { type: sql.NVarChar, value: msUserEmail || '' },
        }
      );
    }
  } catch (err) {
    console.error('TeamsTokens DB write error:', err.message);
  }
};

/**
 * Load tokens from DB into memory cache on startup / on demand.
 */
const loadTokenFromDb = async (userId) => {
  try {
    const row = await queryOne(
      'SELECT AccessToken, RefreshToken, ExpiresAt, MsUserEmail FROM DC_TeamsTokens WHERE DirectorId = @id',
      { id: { type: sql.NVarChar, value: userId } }
    );
    if (row) {
      tokenStore[userId] = {
        accessToken:  row.AccessToken,
        refreshToken: row.RefreshToken,
        expiresAt:    Number(row.ExpiresAt),
        msUserEmail:  row.MsUserEmail,
      };
      return tokenStore[userId];
    }
  } catch (err) {
    console.error('TeamsTokens DB read error:', err.message);
  }
  return null;
};

/**
 * Check if a user has connected their Teams account.
 * Checks memory first, then DB.
 */
const isConnected = async (userId) => {
  if (tokenStore[userId]) return true;
  const row = await loadTokenFromDb(userId);
  return !!row;
};

/**
 * Disconnect a user's Teams account — removes from DB and memory.
 */
const disconnect = async (userId) => {
  delete tokenStore[userId];
  try {
    await execute(
      'DELETE FROM DC_TeamsTokens WHERE DirectorId = @id',
      { id: { type: sql.NVarChar, value: userId } }
    );
  } catch (err) {
    console.error('TeamsTokens DB delete error:', err.message);
  }
};

/**
 * Make an authenticated Graph API request.
 */
const graphGet = async (directorId, endpoint, params = {}) => {
  const token = await getValidToken(directorId);
  if (!token) throw new Error('NOT_CONNECTED');

  const res = await axios.get(`${GRAPH_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
  });
  return res.data;
};

// ─────────────────────────────────────────────────────────────────────────────
// DATA FETCHERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get Outlook calendar events for the next N days.
 */
const getCalendarEvents = async (directorId, days = 30) => {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const data = await graphGet(directorId, '/me/calendarView', {
    startDateTime: now.toISOString(),
    endDateTime: end.toISOString(),
    $select: 'id,subject,bodyPreview,start,end,location,attendees,isAllDay,onlineMeeting,onlineMeetingUrl,organizer,importance,showAs,responseStatus,categories',
    $orderby: 'start/dateTime',
    $top: 100,
  });

  return (data.value || []).map(e => {
    // Outlook returns times in the event's timezone — extract date/time parts directly
    const startDT = e.start?.dateTime || '';
    const endDT   = e.end?.dateTime   || '';
    return {
      id: `outlook-cal-${e.id}`,
      source: 'outlook',
      title: e.subject || '(No title)',
      description: e.bodyPreview || '',
      startDate: startDT.split('T')[0] || '',
      startTime: startDT.split('T')[1]?.substring(0, 5) || '',
      endDate:   endDT.split('T')[0] || '',
      endTime:   endDT.split('T')[1]?.substring(0, 5) || '',
      isAllDay: e.isAllDay || false,
      location: e.location?.displayName || '',
      attendees: (e.attendees || []).map(a => a.emailAddress?.name || a.emailAddress?.address).filter(Boolean),
      isOnlineMeeting: !!e.onlineMeeting,
      joinUrl: e.onlineMeeting?.joinUrl || e.onlineMeetingUrl || null,
      organizer: e.organizer?.emailAddress?.name || '',
      importance: e.importance || 'normal',
      showAs: e.showAs || 'busy',
      responseStatus: e.responseStatus?.response || 'none',
      categories: e.categories || [],
      type: e.onlineMeeting ? 'online_meeting' : (e.isAllDay ? 'all_day' : 'meeting'),
    };
  });
};

/**
 * Get today's Outlook calendar events only.
 */
const getTodayEvents = async (directorId) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

  const data = await graphGet(directorId, '/me/calendarView', {
    startDateTime: today.toISOString(),
    endDateTime: tomorrow.toISOString(),
    $select: 'id,subject,bodyPreview,start,end,location,attendees,isAllDay,onlineMeeting,onlineMeetingUrl,organizer,importance,showAs',
    $orderby: 'start/dateTime',
    $top: 50,
  });

  return (data.value || []).map(e => {
    const startDT = e.start?.dateTime || '';
    const endDT   = e.end?.dateTime   || '';
    return {
      id: `outlook-today-${e.id}`,
      source: 'outlook',
      title: e.subject || '(No title)',
      startTime: startDT.split('T')[1]?.substring(0, 5) || '',
      endTime:   endDT.split('T')[1]?.substring(0, 5) || '',
      isAllDay: e.isAllDay || false,
      location: e.location?.displayName || '',
      attendees: (e.attendees || []).map(a => a.emailAddress?.name).filter(Boolean),
      isOnlineMeeting: !!e.onlineMeeting,
      joinUrl: e.onlineMeeting?.joinUrl || e.onlineMeetingUrl || null,
      organizer: e.organizer?.emailAddress?.name || '',
      importance: e.importance || 'normal',
    };
  });
};

/**
 * Get Microsoft To Do tasks (all lists).
 */
const getTasks = async (directorId) => {
  // Get all task lists first
  const listsData = await graphGet(directorId, '/me/todo/lists', {
    $select: 'id,displayName',
  });

  const lists = listsData.value || [];
  const allTasks = [];

  // Fetch tasks from each list in parallel
  await Promise.all(lists.map(async (list) => {
    try {
      const tasksData = await graphGet(directorId, `/me/todo/lists/${list.id}/tasks`, {
        $select: 'id,title,status,importance,dueDateTime,reminderDateTime,body,completedDateTime,createdDateTime',
        $filter: "status ne 'completed'",
        $top: 50,
      });

      (tasksData.value || []).forEach(t => {
        allTasks.push({
          id: `teams-task-${t.id}`,
          source: 'teams',
          listName: list.displayName,
          title: t.title || '(No title)',
          status: t.status || 'notStarted',
          importance: t.importance || 'normal',
          dueDate: t.dueDateTime?.dateTime?.split('T')[0] || null,
          reminderDate: t.reminderDateTime?.dateTime?.split('T')[0] || null,
          body: t.body?.content || '',
          createdAt: t.createdDateTime,
        });
      });
    } catch (err) {
      // Skip lists that fail (permissions)
    }
  }));

  return allTasks;
};

/**
 * Get user presence (Available, Busy, Away, BeRightBack, DoNotDisturb, Offline).
 */
const getPresence = async (directorId) => {
  try {
    const data = await graphGet(directorId, '/me/presence', {
      $select: 'availability,activity',
    });
    return {
      availability: data.availability || 'Unknown',
      activity: data.activity || 'Unknown',
    };
  } catch {
    return { availability: 'Unknown', activity: 'Unknown' };
  }
};

/**
 * Get mailbox settings — out of office / automatic replies.
 */
const getMailboxSettings = async (directorId) => {
  try {
    const data = await graphGet(directorId, '/me/mailboxSettings', {
      $select: 'automaticRepliesSetting,timeZone,workingHours',
    });
    return {
      autoReplyStatus: data.automaticRepliesSetting?.status || 'disabled',
      autoReplyInternal: data.automaticRepliesSetting?.internalReplyMessage || '',
      autoReplyExternal: data.automaticRepliesSetting?.externalReplyMessage || '',
      autoReplyStartTime: data.automaticRepliesSetting?.scheduledStartDateTime?.dateTime || null,
      autoReplyEndTime: data.automaticRepliesSetting?.scheduledEndDateTime?.dateTime || null,
      timeZone: data.timeZone || '',
      workingHours: data.workingHours || null,
    };
  } catch {
    return { autoReplyStatus: 'unknown' };
  }
};

/**
 * Get unread emails from Outlook inbox (requires Mail.Read permission).
 * Returns up to 20 most recent unread messages.
 */
const getUnreadMails = async (directorId) => {
  try {
    const data = await graphGet(directorId, '/me/mailFolders/inbox/messages', {
      $filter: 'isRead eq false',
      $select: 'id,subject,from,receivedDateTime,bodyPreview,importance,isRead',
      $orderby: 'receivedDateTime desc',
      $top: 20,
    });
    return (data.value || []).map(m => ({
      id: m.id,
      subject: m.subject || '(No subject)',
      from: m.from?.emailAddress?.name || m.from?.emailAddress?.address || 'Unknown',
      fromEmail: m.from?.emailAddress?.address || '',
      receivedAt: m.receivedDateTime,
      preview: m.bodyPreview || '',
      importance: m.importance || 'normal',
      isRead: m.isRead || false,
    }));
  } catch {
    return [];
  }
};

/**
 * Get unread chat message count and recent mentions.
 */
const getChats = async (directorId) => {
  try {
    const data = await graphGet(directorId, '/me/chats', {
      $select: 'id,topic,chatType,lastUpdatedDateTime',
      $top: 20,
    });
    return (data.value || []).map(c => ({
      id: c.id,
      topic: c.topic || 'Direct Message',
      type: c.chatType,
      lastUpdated: c.lastUpdatedDateTime,
    }));
  } catch {
    return [];
  }
};

/**
 * Get the connected Microsoft user profile.
 */
const getUserProfile = async (directorId) => {
  const data = await graphGet(directorId, '/me', {
    $select: 'id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation',
  });
  return {
    msId: data.id,
    name: data.displayName,
    email: data.mail || data.userPrincipalName,
    jobTitle: data.jobTitle || '',
    department: data.department || '',
    officeLocation: data.officeLocation || '',
  };
};

/**
 * Get a full Teams summary for a director — all data in one call.
 */
const getTeamsSummary = async (directorId) => {
  const [calendarEvents, todayEvents, tasks, presence, mailboxSettings, chats] =
    await Promise.allSettled([
      getCalendarEvents(directorId, 30),
      getTodayEvents(directorId),
      getTasks(directorId),
      getPresence(directorId),
      getMailboxSettings(directorId),
      getChats(directorId),
    ]);

  return {
    calendarEvents: calendarEvents.status === 'fulfilled' ? calendarEvents.value : [],
    todayEvents: todayEvents.status === 'fulfilled' ? todayEvents.value : [],
    tasks: tasks.status === 'fulfilled' ? tasks.value : [],
    presence: presence.status === 'fulfilled' ? presence.value : { availability: 'Unknown' },
    mailboxSettings: mailboxSettings.status === 'fulfilled' ? mailboxSettings.value : {},
    chats: chats.status === 'fulfilled' ? chats.value : [],
  };
};

module.exports = {
  getAuthUrl,
  exchangeCodeForTokens,
  storeTokens,
  isConnected,
  disconnect,
  loadTokenFromDb,
  getValidToken,
  getCalendarEvents,
  getTodayEvents,
  getTasks,
  getPresence,
  getMailboxSettings,
  getChats,
  getUnreadMails,
  getUserProfile,
  getTeamsSummary,
  tokenStore,
};
