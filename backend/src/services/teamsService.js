/**
 * Microsoft Graph API service for Teams integration.
 *
 * Fetches from Graph API:
 *  - Calendar events (meetings, all-day events)
 *  - Online meetings (Teams calls)
 *  - Tasks from Microsoft To Do / Planner
 *  - User presence (Available, Busy, Away, etc.)
 *  - Unread chat messages / mentions
 *  - Out-of-office / automatic replies status
 *
 * Auth flow: OAuth2 Authorization Code (delegated permissions)
 * Each director connects their own Microsoft account.
 * Tokens are stored in memory (replace with DB when MS SQL is ready).
 */

const axios = require('axios');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

// In-memory token store: { userId -> { accessToken, refreshToken, expiresAt, msUserEmail } }
const tokenStore = {};

/**
 * Build the OAuth2 authorization URL for a director to connect their Teams account.
 * @param {string} directorId - Our internal director ID (passed as state)
 */
const getAuthUrl = (directorId) => {
  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    response_type: 'code',
    redirect_uri: process.env.AZURE_REDIRECT_URI,
    response_mode: 'query',
    scope: [
      'offline_access',
      'User.Read',
      'Calendars.Read',
      'OnlineMeetings.Read',
      'Tasks.Read',
      'Presence.Read',
      'Chat.Read',
      'MailboxSettings.Read',
    ].join(' '),
    state: directorId,
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
const refreshAccessToken = async (directorId) => {
  const stored = tokenStore[directorId];
  if (!stored?.refreshToken) throw new Error('No refresh token available');

  const params = new URLSearchParams({
    client_id: process.env.AZURE_CLIENT_ID,
    client_secret: process.env.AZURE_CLIENT_SECRET,
    refresh_token: stored.refreshToken,
    grant_type: 'refresh_token',
    scope: [
      'offline_access', 'User.Read', 'Calendars.Read',
      'OnlineMeetings.Read', 'Tasks.Read', 'Presence.Read',
      'Chat.Read', 'MailboxSettings.Read',
    ].join(' '),
  });

  const res = await axios.post(
    `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID}/oauth2/v2.0/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  tokenStore[directorId] = {
    ...stored,
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token || stored.refreshToken,
    expiresAt: Date.now() + res.data.expires_in * 1000,
  };

  return tokenStore[directorId].accessToken;
};

/**
 * Get a valid access token for a director, refreshing if needed.
 */
const getValidToken = async (directorId) => {
  const stored = tokenStore[directorId];
  if (!stored) return null;

  // Refresh if expiring within 5 minutes
  if (Date.now() >= stored.expiresAt - 5 * 60 * 1000) {
    return await refreshAccessToken(directorId);
  }

  return stored.accessToken;
};

/**
 * Store tokens after OAuth callback.
 */
const storeTokens = (directorId, tokens, msUserEmail) => {
  tokenStore[directorId] = { ...tokens, msUserEmail };
};

/**
 * Check if a director has connected their Teams account.
 */
const isConnected = (directorId) => !!tokenStore[directorId];

/**
 * Disconnect a director's Teams account.
 */
const disconnect = (directorId) => {
  delete tokenStore[directorId];
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
 * Get calendar events for the next N days.
 * Includes Teams meetings, Outlook calendar events, all-day events.
 */
const getCalendarEvents = async (directorId, days = 30) => {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  const data = await graphGet(directorId, '/me/calendarView', {
    startDateTime: now.toISOString(),
    endDateTime: end.toISOString(),
    $select: 'id,subject,bodyPreview,start,end,location,attendees,isAllDay,onlineMeeting,onlineMeetingUrl,organizer,importance,showAs,responseStatus,recurrence,categories',
    $orderby: 'start/dateTime',
    $top: 100,
  });

  return (data.value || []).map(e => ({
    id: `teams-cal-${e.id}`,
    source: 'teams',
    title: e.subject || '(No title)',
    description: e.bodyPreview || '',
    startDate: e.start?.dateTime?.split('T')[0] || '',
    startTime: e.start?.dateTime?.split('T')[1]?.substring(0, 5) || '',
    endDate: e.end?.dateTime?.split('T')[0] || '',
    endTime: e.end?.dateTime?.split('T')[1]?.substring(0, 5) || '',
    isAllDay: e.isAllDay || false,
    location: e.location?.displayName || '',
    attendees: (e.attendees || []).map(a => a.emailAddress?.name || a.emailAddress?.address).filter(Boolean),
    isTeamsMeeting: !!e.onlineMeeting,
    joinUrl: e.onlineMeeting?.joinUrl || e.onlineMeetingUrl || null,
    organizer: e.organizer?.emailAddress?.name || '',
    importance: e.importance || 'normal',
    showAs: e.showAs || 'busy',
    responseStatus: e.responseStatus?.response || 'none',
    categories: e.categories || [],
    type: e.onlineMeeting ? 'teams_meeting' : (e.isAllDay ? 'all_day' : 'meeting'),
  }));
};

/**
 * Get today's calendar events only.
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

  return (data.value || []).map(e => ({
    id: `teams-today-${e.id}`,
    source: 'teams',
    title: e.subject || '(No title)',
    startTime: e.start?.dateTime?.split('T')[1]?.substring(0, 5) || '',
    endTime: e.end?.dateTime?.split('T')[1]?.substring(0, 5) || '',
    isAllDay: e.isAllDay || false,
    location: e.location?.displayName || '',
    attendees: (e.attendees || []).map(a => a.emailAddress?.name).filter(Boolean),
    isTeamsMeeting: !!e.onlineMeeting,
    joinUrl: e.onlineMeeting?.joinUrl || e.onlineMeetingUrl || null,
    organizer: e.organizer?.emailAddress?.name || '',
    importance: e.importance || 'normal',
  }));
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
  getValidToken,
  getCalendarEvents,
  getTodayEvents,
  getTasks,
  getPresence,
  getMailboxSettings,
  getChats,
  getUserProfile,
  getTeamsSummary,
  tokenStore,
};
