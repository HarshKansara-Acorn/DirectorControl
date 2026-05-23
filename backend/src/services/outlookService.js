/**
 * Microsoft Outlook integration service for DirectorControl.
 *
 * Handles OAuth authorization, token encryption, Graph API requests,
 * and storage of Outlook connection state for directors.
 */

const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { query, queryOne, execute, sql } = require('../config/db');

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const AAD_AUTH_BASE = 'https://login.microsoftonline.com';
const SCOPES = [
  'offline_access',
  'openid',
  'profile',
  'User.Read',
  'Calendars.Read',
  'Mail.Read',
  'Tasks.Read',
].join(' ');

const TOKEN_KEY = process.env.TOKEN_ENCRYPTION_KEY || process.env.JWT_SECRET || 'fallback-secret-key-that-is-not-secure';
const ENCRYPTION_KEY = crypto.createHash('sha256').update(TOKEN_KEY).digest();

const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:3000';
const getTenantId = () => process.env.AZURE_TENANT_ID;
const getClientId = () => process.env.AZURE_CLIENT_ID;
const getClientSecret = () => process.env.AZURE_CLIENT_SECRET;
const getRedirectUri = () => process.env.AZURE_REDIRECT_URI || `${getFrontendUrl()}/oauth/microsoft/callback`;

const isConfigured = () => {
  return !!(getTenantId() && getClientId() && getClientSecret() && getRedirectUri());
};

const encryptString = (text) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
};

const decryptString = (payload) => {
  if (!payload) return null;
  const [ivHex, tagHex, encryptedHex] = payload.split(':');
  if (!ivHex || !tagHex || !encryptedHex) return null;
  const iv = Buffer.from(ivHex, 'hex');
  const tag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
};

const signState = (payload) => {
  return crypto.createHmac('sha256', TOKEN_KEY).update(JSON.stringify(payload)).digest('hex');
};

const encodeState = (payload) => {
  const envelope = {
    payload,
    signature: signState(payload),
  };
  return encodeURIComponent(Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64'));
};

const decodeState = (state) => {
  if (!state) throw new Error('Missing state');
  let envelope;
  try {
    envelope = JSON.parse(Buffer.from(decodeURIComponent(state), 'base64').toString('utf8'));
  } catch (err) {
    throw new Error('Invalid state payload');
  }

  if (!envelope || !envelope.payload || !envelope.signature) {
    throw new Error('Malformed state');
  }

  const expected = signState(envelope.payload);
  if (expected !== envelope.signature) {
    throw new Error('Invalid state signature');
  }

  if (typeof envelope.payload.issuedAt !== 'number') {
    throw new Error('State missing issuedAt');
  }

  if (Date.now() - envelope.payload.issuedAt > 20 * 60 * 1000) {
    throw new Error('State expired');
  }

  return envelope.payload;
};

const getAuthUrl = (state) => {
  const params = new URLSearchParams({
    client_id: getClientId(),
    response_type: 'code',
    redirect_uri: getRedirectUri(),
    response_mode: 'query',
    scope: SCOPES,
    state,
    prompt: 'select_account',
  });

  return `${AAD_AUTH_BASE}/${getTenantId()}/oauth2/v2.0/authorize?${params.toString()}`;
};

const buildAuthState = (directorId, returnTo = 'settings') => {
  if (!directorId) throw new Error('directorId is required');
  const payload = {
    directorId,
    returnTo,
    issuedAt: Date.now(),
  };
  return encodeState(payload);
};

const getAuthUrlForDirector = (directorId, returnTo = 'settings') => {
  if (!isConfigured()) throw new Error('Outlook integration is not configured');
  const state = buildAuthState(directorId, returnTo);
  return getAuthUrl(state);
};

const exchangeCodeForTokens = async (code) => {
  const params = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    code,
    redirect_uri: getRedirectUri(),
    grant_type: 'authorization_code',
  });

  const res = await axios.post(
    `${AAD_AUTH_BASE}/${getTenantId()}/oauth2/v2.0/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  return {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token,
    expiresAt: Date.now() + (res.data.expires_in || 3600) * 1000,
  };
};

const refreshAccessToken = async (directorId, connection) => {
  if (!connection || !connection.RefreshTokenEncrypted) {
    throw new Error('No refresh token available');
  }

  const refreshToken = decryptString(connection.RefreshTokenEncrypted);
  if (!refreshToken) throw new Error('No refresh token available');

  const params = new URLSearchParams({
    client_id: getClientId(),
    client_secret: getClientSecret(),
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
    scope: SCOPES,
  });

  const res = await axios.post(
    `${AAD_AUTH_BASE}/${getTenantId()}/oauth2/v2.0/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  const tokens = {
    accessToken: res.data.access_token,
    refreshToken: res.data.refresh_token || refreshToken,
    expiresAt: Date.now() + (res.data.expires_in || 3600) * 1000,
  };

  await storeConnectionTokens(directorId, tokens, connection.MsUserEmail, connection.MicrosoftUserId);
  return tokens.accessToken;
};

const upsertConnectionRecord = async (directorId, updates = {}) => {
  const existing = await queryOne(
    'SELECT Id FROM OutlookConnections WHERE DirectorId = @directorId',
    { directorId: { type: sql.NVarChar, value: directorId } }
  );

  const params = {
    directorId: { type: sql.NVarChar, value: directorId },
    msUserEmail: { type: sql.NVarChar, value: updates.msUserEmail || '' },
    microsoftUserId: { type: sql.NVarChar, value: updates.microsoftUserId || '' },
    accessToken: { type: sql.NVarChar, value: updates.accessTokenEncrypted || '' },
    refreshToken: { type: sql.NVarChar, value: updates.refreshTokenEncrypted || '' },
    tokenExpiry: { type: sql.BigInt, value: updates.tokenExpiry || null },
    connectedAt: { type: sql.DateTime2, value: updates.connectedAt || null },
    lastSync: { type: sql.DateTime2, value: updates.lastSync || null },
  };

  if (existing) {
    await execute(
      `UPDATE OutlookConnections SET
         MicrosoftUserId = @microsoftUserId,
         MsUserEmail = @msUserEmail,
         AccessTokenEncrypted = @accessToken,
         RefreshTokenEncrypted = @refreshToken,
         TokenExpiry = @tokenExpiry,
         ConnectedAt = COALESCE(ConnectedAt, @connectedAt),
         LastSync = @lastSync,
         UpdatedAt = GETUTCDATE()
       WHERE DirectorId = @directorId`,
      params
    );
  } else {
    await execute(
      `INSERT INTO OutlookConnections
        (Id, DirectorId, MicrosoftUserId, MsUserEmail, AccessTokenEncrypted, RefreshTokenEncrypted, TokenExpiry, ConnectedAt, LastSync, CreatedAt, UpdatedAt)
       VALUES
        (@id, @directorId, @microsoftUserId, @msUserEmail, @accessToken, @refreshToken, @tokenExpiry, @connectedAt, @lastSync, GETUTCDATE(), GETUTCDATE())`,
      { ...params, id: { type: sql.NVarChar, value: uuidv4() } }
    );
  }
};

const storeConnectionTokens = async (directorId, tokens, msUserEmail, microsoftUserId) => {
  const connection = await getConnection(directorId);
  const encryptedAccessToken = encryptString(tokens.accessToken);
  const encryptedRefreshToken = tokens.refreshToken ? encryptString(tokens.refreshToken) : null;
  const now = new Date();
  await upsertConnectionRecord(directorId, {
    msUserEmail,
    microsoftUserId,
    accessTokenEncrypted: encryptedAccessToken,
    refreshTokenEncrypted: encryptedRefreshToken,
    tokenExpiry: tokens.expiresAt,
    connectedAt: now,
    lastSync: connection?.LastSync || null,
  });
};

const getConnection = async (directorId) => {
  return queryOne(
    'SELECT * FROM OutlookConnections WHERE DirectorId = @directorId',
    { directorId: { type: sql.NVarChar, value: directorId } }
  );
};

const getConnectionStatus = async (directorId) => {
  const connection = await getConnection(directorId);
  return {
    connected: !!connection?.AccessTokenEncrypted,
    connectedAt: connection?.ConnectedAt || null,
    lastSync: connection?.LastSync || null,
    msUserEmail: connection?.MsUserEmail || null,
    microsoftUserId: connection?.MicrosoftUserId || null,
    configured: isConfigured(),
  };
};

const getValidAccessToken = async (directorId) => {
  const connection = await getConnection(directorId);
  if (!connection || !connection.AccessTokenEncrypted) {
    return null;
  }

  const accessToken = decryptString(connection.AccessTokenEncrypted);
  if (!accessToken) return null;

  if (connection.TokenExpiry && Date.now() >= Number(connection.TokenExpiry) - 5 * 60 * 1000) {
    return await refreshAccessToken(directorId, connection);
  }

  return accessToken;
};

const graphGet = async (directorId, endpoint, params = {}, headers = {}) => {
  const token = await getValidAccessToken(directorId);
  if (!token) throw new Error('NOT_CONNECTED');

  const response = await axios.get(`${GRAPH_BASE}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}`, ...headers },
    params,
  });

  return response.data;
};

const getMailboxSettings = async (directorId) => {
  try {
    const data = await graphGet(directorId, '/me/mailboxSettings', {
      $select: 'automaticRepliesSetting,timeZone,workingHours',
    });
    return data;
  } catch {
    return { timeZone: 'UTC' };
  }
};

const getCalendarEvents = async (directorId, days = 30) => {
  const now = new Date();
  const end = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
  const mailboxSettings = await getMailboxSettings(directorId);
  const timezoneHeader = mailboxSettings.timeZone ? { Prefer: `outlook.timezone="${mailboxSettings.timeZone}"` } : {};

  const data = await graphGet(directorId, '/me/calendarView', {
    startDateTime: now.toISOString(),
    endDateTime: end.toISOString(),
    $select: 'id,subject,bodyPreview,start,end,location,attendees,isAllDay,onlineMeeting,onlineMeetingUrl,organizer,importance,showAs,responseStatus,categories',
    $orderby: 'start/dateTime',
    $top: 100,
  }, timezoneHeader);

  return (data.value || []).map((event) => {
    const startDateTime = event.start?.dateTime || '';
    const endDateTime = event.end?.dateTime || '';
    return {
      id: event.id,
      title: event.subject || '(No subject)',
      bodyPreview: event.bodyPreview || '',
      startDateTime,
      endDateTime,
      isAllDay: event.isAllDay || false,
      location: event.location?.displayName || '',
      attendees: (event.attendees || []).map((attendee) => attendee.emailAddress?.name || attendee.emailAddress?.address).filter(Boolean),
      organizer: event.organizer?.emailAddress?.name || event.organizer?.emailAddress?.address || '',
      importance: event.importance || 'normal',
      showAs: event.showAs || 'busy',
      responseStatus: event.responseStatus?.response || 'none',
      categories: event.categories || [],
      onlineMeeting: !!event.onlineMeeting,
      joinUrl: event.onlineMeeting?.joinUrl || event.onlineMeetingUrl || null,
    };
  });
};

const getEmails = async (directorId) => {
  const data = await graphGet(directorId, '/me/mailFolders/inbox/messages', {
    $select: 'id,subject,from,receivedDateTime,bodyPreview,importance,isRead',
    $orderby: 'receivedDateTime desc',
    $top: 20,
  });

  return (data.value || []).map((message) => ({
    id: message.id,
    subject: message.subject || '(No subject)',
    from: message.from?.emailAddress?.name || message.from?.emailAddress?.address || 'Unknown sender',
    fromEmail: message.from?.emailAddress?.address || '',
    receivedAt: message.receivedDateTime,
    preview: message.bodyPreview || '',
    importance: message.importance || 'normal',
    isRead: message.isRead || false,
  }));
};

const getTasks = async (directorId) => {
  const lists = await graphGet(directorId, '/me/todo/lists', { $select: 'id,displayName', $top: 50 });
  const allTasks = [];
  await Promise.all((lists.value || []).map(async (list) => {
    try {
      const tasks = await graphGet(directorId, `/me/todo/lists/${list.id}/tasks`, {
        $select: 'id,title,status,importance,dueDateTime,reminderDateTime,body,completedDateTime,createdDateTime',
        $top: 50,
      });
      (tasks.value || []).forEach((task) => {
        allTasks.push({
          id: task.id,
          listName: list.displayName,
          title: task.title || '(No title)',
          status: task.status || 'notStarted',
          importance: task.importance || 'normal',
          dueDate: task.dueDateTime?.dateTime || null,
          reminderDate: task.reminderDateTime?.dateTime || null,
          body: task.body?.content || '',
          createdAt: task.createdDateTime || null,
          completedAt: task.completedDateTime?.dateTime || null,
        });
      });
    } catch (err) {
      // ignore individual list failures
    }
  }));
  return allTasks;
};

const getReminders = async (directorId) => {
  const tasks = await getTasks(directorId);
  return tasks.filter((task) => task.reminderDate !== null);
};

const getApprovals = async (directorId) => {
  const tasks = await getTasks(directorId);
  return tasks.filter((task) => {
    const normalizedList = (task.listName || '').toLowerCase();
    const normalizedTitle = (task.title || '').toLowerCase();
    return normalizedList.includes('approval') || normalizedTitle.includes('approval') || normalizedTitle.includes('approve');
  });
};

const getUserProfile = async (directorId) => {
  const data = await graphGet(directorId, '/me', {
    $select: 'id,displayName,mail,userPrincipalName,jobTitle,department,officeLocation',
  });
  return {
    msId: data.id,
    name: data.displayName,
    email: data.mail || data.userPrincipalName,
    title: data.jobTitle || '',
    department: data.department || '',
    officeLocation: data.officeLocation || '',
  };
};

const validateDirectorEmailMatch = async (directorId, email) => {
  if (!email) return true;
  const row = await queryOne('SELECT Email FROM DC_Users WHERE Id = @id', { id: { type: sql.NVarChar, value: directorId } });
  if (!row?.Email) return true;
  return row.Email.toLowerCase() === email.toLowerCase() || row.Email.toLowerCase() === (email || '').toLowerCase();
};

const disconnect = async (directorId) => {
  await execute('DELETE FROM OutlookConnections WHERE DirectorId = @directorId', {
    directorId: { type: sql.NVarChar, value: directorId },
  });
};

const createPendingConnection = async (directorId) => {
  await upsertConnectionRecord(directorId, {});
};

const storeSyncRecords = async (directorId, events, emails, tasks, reminders) => {
  const upsertEvent = async (event) => {
    const existing = await queryOne(
      'SELECT Id FROM OutlookCalendarEvents WHERE DirectorId = @directorId AND OutlookResourceId = @resourceId',
      {
        directorId: { type: sql.NVarChar, value: directorId },
        resourceId: { type: sql.NVarChar, value: event.id },
      }
    );
    const row = {
      id: { type: sql.NVarChar, value: existing?.Id || uuidv4() },
      directorId: { type: sql.NVarChar, value: directorId },
      resourceId: { type: sql.NVarChar, value: event.id },
      subject: { type: sql.NVarChar, value: event.title },
      body: { type: sql.NVarChar, value: event.bodyPreview || '' },
      startDateTime: { type: sql.DateTime2, value: event.startDateTime ? new Date(event.startDateTime) : new Date() },
      endDateTime: { type: sql.DateTime2, value: event.endDateTime ? new Date(event.endDateTime) : null },
      isAllDay: { type: sql.Bit, value: event.isAllDay ? 1 : 0 },
      location: { type: sql.NVarChar, value: event.location || '' },
      organizer: { type: sql.NVarChar, value: event.organizer || '' },
      attendees: { type: sql.NVarChar, value: JSON.stringify(event.attendees || []) },
      rawData: { type: sql.NVarChar, value: JSON.stringify(event) },
    };
    if (existing) {
      await execute(
        `UPDATE OutlookCalendarEvents SET
           Subject=@subject, Body=@body, StartDateTime=@startDateTime,
           EndDateTime=@endDateTime, IsAllDay=@isAllDay, Location=@location,
           Organizer=@organizer, Attendees=@attendees, RawData=@rawData, SyncedAt=GETUTCDATE()
         WHERE Id=@id`,
        row
      );
    } else {
      await execute(
        `INSERT INTO OutlookCalendarEvents
          (Id, DirectorId, OutlookResourceId, Subject, Body, StartDateTime, EndDateTime, IsAllDay, Location, Organizer, Attendees, RawData, SyncedAt)
         VALUES
          (@id, @directorId, @resourceId, @subject, @body, @startDateTime, @endDateTime, @isAllDay, @location, @organizer, @attendees, @rawData, GETUTCDATE())`,
        { ...row, resourceId: { type: sql.NVarChar, value: event.id } }
      );
    }
  };

  const upsertEmail = async (email) => {
    const existing = await queryOne(
      'SELECT Id FROM OutlookEmails WHERE DirectorId = @directorId AND OutlookResourceId = @resourceId',
      {
        directorId: { type: sql.NVarChar, value: directorId },
        resourceId: { type: sql.NVarChar, value: email.id },
      }
    );
    const row = {
      id: { type: sql.NVarChar, value: existing?.Id || uuidv4() },
      directorId: { type: sql.NVarChar, value: directorId },
      resourceId: { type: sql.NVarChar, value: email.id },
      subject: { type: sql.NVarChar, value: email.subject },
      fromAddress: { type: sql.NVarChar, value: email.fromEmail || email.from },
      fromName: { type: sql.NVarChar, value: email.from || '' },
      receivedAt: { type: sql.DateTime2, value: email.receivedAt ? new Date(email.receivedAt) : null },
      preview: { type: sql.NVarChar, value: email.preview || '' },
      isRead: { type: sql.Bit, value: email.isRead ? 1 : 0 },
      importance: { type: sql.NVarChar, value: email.importance || 'normal' },
      rawData: { type: sql.NVarChar, value: JSON.stringify(email) },
    };
    if (existing) {
      await execute(
        `UPDATE OutlookEmails SET
           Subject=@subject, FromAddress=@fromAddress, FromName=@fromName,
           ReceivedAt=@receivedAt, Preview=@preview, IsRead=@isRead,
           Importance=@importance, RawData=@rawData, SyncedAt=GETUTCDATE()
         WHERE Id=@id`,
        row
      );
    } else {
      await execute(
        `INSERT INTO OutlookEmails
          (Id, DirectorId, OutlookResourceId, Subject, FromAddress, FromName, ReceivedAt, Preview, IsRead, Importance, RawData, SyncedAt)
         VALUES
          (@id, @directorId, @resourceId, @subject, @fromAddress, @fromName, @receivedAt, @preview, @isRead, @importance, @rawData, GETUTCDATE())`,
        { ...row, resourceId: { type: sql.NVarChar, value: email.id } }
      );
    }
  };

  const upsertTask = async (task) => {
    const existing = await queryOne(
      'SELECT Id FROM OutlookTasks WHERE DirectorId = @directorId AND OutlookResourceId = @resourceId',
      {
        directorId: { type: sql.NVarChar, value: directorId },
        resourceId: { type: sql.NVarChar, value: task.id },
      }
    );
    const row = {
      id: { type: sql.NVarChar, value: existing?.Id || uuidv4() },
      directorId: { type: sql.NVarChar, value: directorId },
      resourceId: { type: sql.NVarChar, value: task.id },
      title: { type: sql.NVarChar, value: task.title },
      listName: { type: sql.NVarChar, value: task.listName || '' },
      status: { type: sql.NVarChar, value: task.status || 'notStarted' },
      importance: { type: sql.NVarChar, value: task.importance || 'normal' },
      dueDate: { type: sql.DateTime2, value: task.dueDate ? new Date(task.dueDate) : null },
      reminderDate: { type: sql.DateTime2, value: task.reminderDate ? new Date(task.reminderDate) : null },
      body: { type: sql.NVarChar, value: task.body || '' },
      rawData: { type: sql.NVarChar, value: JSON.stringify(task) },
    };
    if (existing) {
      await execute(
        `UPDATE OutlookTasks SET
           Title=@title, ListName=@listName, Status=@status,
           Importance=@importance, DueDate=@dueDate, ReminderDate=@reminderDate,
           Body=@body, RawData=@rawData, SyncedAt=GETUTCDATE()
         WHERE Id=@id`,
        row
      );
    } else {
      await execute(
        `INSERT INTO OutlookTasks
          (Id, DirectorId, OutlookResourceId, Title, ListName, Status, Importance, DueDate, ReminderDate, Body, RawData, SyncedAt)
         VALUES
          (@id, @directorId, @resourceId, @title, @listName, @status, @importance, @dueDate, @reminderDate, @body, @rawData, GETUTCDATE())`,
        { ...row, resourceId: { type: sql.NVarChar, value: task.id } }
      );
    }
  };

  const upsertReminder = async (reminder) => {
    const existing = await queryOne(
      'SELECT Id FROM OutlookReminders WHERE DirectorId = @directorId AND OutlookResourceId = @resourceId',
      {
        directorId: { type: sql.NVarChar, value: directorId },
        resourceId: { type: sql.NVarChar, value: reminder.id },
      }
    );
    const row = {
      id: { type: sql.NVarChar, value: existing?.Id || uuidv4() },
      directorId: { type: sql.NVarChar, value: directorId },
      resourceId: { type: sql.NVarChar, value: reminder.id },
      title: { type: sql.NVarChar, value: reminder.title },
      listName: { type: sql.NVarChar, value: reminder.listName || '' },
      dueDate: { type: sql.DateTime2, value: reminder.dueDate ? new Date(reminder.dueDate) : null },
      reminderDate: { type: sql.DateTime2, value: reminder.reminderDate ? new Date(reminder.reminderDate) : null },
      body: { type: sql.NVarChar, value: reminder.body || '' },
      rawData: { type: sql.NVarChar, value: JSON.stringify(reminder) },
    };
    if (existing) {
      await execute(
        `UPDATE OutlookReminders SET
           Title=@title, ListName=@listName, DueDate=@dueDate,
           ReminderDate=@reminderDate, Body=@body, RawData=@rawData, SyncedAt=GETUTCDATE()
         WHERE Id=@id`,
        row
      );
    } else {
      await execute(
        `INSERT INTO OutlookReminders
          (Id, DirectorId, OutlookResourceId, Title, ListName, DueDate, ReminderDate, Body, RawData, SyncedAt)
         VALUES
          (@id, @directorId, @resourceId, @title, @listName, @dueDate, @reminderDate, @body, @rawData, GETUTCDATE())`,
        { ...row, resourceId: { type: sql.NVarChar, value: reminder.id } }
      );
    }
  };

  await Promise.all(
    events.map((event) => upsertEvent(event))
      .concat(emails.map((email) => upsertEmail(email)))
      .concat(tasks.map((task) => upsertTask(task)))
      .concat(reminders.map((reminder) => upsertReminder(reminder)))
  );
};

const syncDirectorData = async (directorId) => {
  if (!isConfigured()) throw new Error('Outlook integration not configured');
  const connected = await getConnectionStatus(directorId);
  if (!connected.connected) throw new Error('NOT_CONNECTED');

  const [events, emails, tasks, reminders] = await Promise.all([
    getCalendarEvents(directorId, 30),
    getEmails(directorId),
    getTasks(directorId),
    getReminders(directorId),
  ]);

  await storeSyncRecords(directorId, events, emails, tasks, reminders);
  await execute(
    'UPDATE OutlookConnections SET LastSync=GETUTCDATE(), UpdatedAt=GETUTCDATE() WHERE DirectorId = @directorId',
    { directorId: { type: sql.NVarChar, value: directorId } }
  );
};

const getSyncedCalendar = async (directorId) => {
  return query(
    'SELECT * FROM OutlookCalendarEvents WHERE DirectorId = @directorId ORDER BY StartDateTime DESC',
    { directorId: { type: sql.NVarChar, value: directorId } }
  );
};

const getSyncedEmails = async (directorId) => {
  return query(
    'SELECT * FROM OutlookEmails WHERE DirectorId = @directorId ORDER BY ReceivedAt DESC',
    { directorId: { type: sql.NVarChar, value: directorId } }
  );
};

const getSyncedTasks = async (directorId) => {
  return query(
    'SELECT * FROM OutlookTasks WHERE DirectorId = @directorId ORDER BY SyncedAt DESC',
    { directorId: { type: sql.NVarChar, value: directorId } }
  );
};

const getSyncedReminders = async (directorId) => {
  return query(
    'SELECT * FROM OutlookReminders WHERE DirectorId = @directorId ORDER BY ReminderDate DESC',
    { directorId: { type: sql.NVarChar, value: directorId } }
  );
};

module.exports = {
  isConfigured,
  getAuthUrlForDirector,
  exchangeCodeForTokens,
  getUserProfile,
  validateDirectorEmailMatch,
  storeConnectionTokens,
  getConnectionStatus,
  createPendingConnection,
  disconnect,
  getValidAccessToken,
  graphGet,
  syncDirectorData,
  getSyncedCalendar,
  getSyncedEmails,
  getSyncedTasks,
  getSyncedReminders,
  getApprovals,
  decodeState,
};
