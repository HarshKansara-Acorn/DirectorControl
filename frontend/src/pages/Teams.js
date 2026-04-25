import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useDirector } from '../context/DirectorContext';
import api from '../services/api';
import {
  Users, Calendar, CheckSquare, Wifi, WifiOff,
  RefreshCw, ExternalLink, Clock, MapPin,
  AlertCircle, Link, Unlink, ChevronDown, ChevronUp,
  Mail, Bell
} from 'lucide-react';
import styles from './Teams.module.css';

// ── Presence styling ──────────────────────────────────────────────────────────
const PRESENCE = {
  Available:      { color: '#16a34a', bg: '#f0fdf4', dot: '#16a34a',  label: 'Available' },
  Busy:           { color: '#dc2626', bg: '#fef2f2', dot: '#dc2626',  label: 'Busy' },
  DoNotDisturb:   { color: '#dc2626', bg: '#fef2f2', dot: '#dc2626',  label: 'Do Not Disturb' },
  BeRightBack:    { color: '#d97706', bg: '#fffbeb', dot: '#d97706',  label: 'Be Right Back' },
  Away:           { color: '#d97706', bg: '#fffbeb', dot: '#d97706',  label: 'Away' },
  Offline:        { color: '#94a3b8', bg: '#f8fafc', dot: '#94a3b8',  label: 'Offline' },
  Unknown:        { color: '#94a3b8', bg: '#f8fafc', dot: '#94a3b8',  label: 'Unknown' },
};

const IMPORTANCE = {
  high:   { label: '🔴 High',   bg: '#fef2f2', color: '#dc2626' },
  normal: { label: '🟡 Normal', bg: '#fffbeb', color: '#d97706' },
  low:    { label: '🟢 Low',    bg: '#f0fdf4', color: '#15803d' },
};

const Teams = () => {
  const location = useLocation();
  const { isAdmin } = useAuth();
  const { directors, selectedDirector, activeDirectorId } = useDirector();

  const [status, setStatus]         = useState({ connected: false, configured: false, msUserEmail: null });
  const [summary, setSummary]       = useState(null);
  const [loading, setLoading]       = useState(true);
  const [syncing, setSyncing]       = useState(false);
  const [syncMsg, setSyncMsg]       = useState('');
  const [activeTab, setActiveTab]   = useState('calendar');
  const [calFilter, setCalFilter]   = useState('all');   // all | teams | today
  const [connectingId, setConnectingId] = useState(null);

  // ── Check URL params after OAuth redirect ──────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('connected') === 'true' || params.get('teamsConnected') === 'true') {
      setSyncMsg('✅ Teams account connected successfully!');
      setTimeout(() => setSyncMsg(''), 4000);
    }
    if (params.get('error') || params.get('teamsError')) {
      const errMsg = params.get('error') || params.get('teamsError');
      setSyncMsg(`❌ ${decodeURIComponent(errMsg)}`);
    }
  }, [location.search]);

  // ── Fetch connection status ────────────────────────────────────────────────
  const fetchStatus = useCallback(async () => {
    if (!activeDirectorId) return;
    try {
      const res = await api.get('/teams/status', { params: { userId: activeDirectorId } });
      setStatus(res.data);
    } catch { setStatus({ connected: false, configured: false }); }
  }, [activeDirectorId]);

  // ── Fetch Teams summary ────────────────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
    if (!activeDirectorId) return;
    setLoading(true);
    try {
      const res = await api.get('/teams/summary', { params: { userId: activeDirectorId } });
      setSummary(res.data);
    } catch (err) {
      if (err.response?.status === 404) setSummary(null);
    } finally { setLoading(false); }
  }, [activeDirectorId]);

  useEffect(() => {
    fetchStatus();
    fetchSummary();
  }, [fetchStatus, fetchSummary]);

  // ── Connect Teams ──────────────────────────────────────────────────────────
  const handleConnect = async (userId) => {
    setConnectingId(userId);
    try {
      const res = await api.get('/teams/auth/connect', {
        params: { userId, returnTo: 'teams' },
      });
      if (res.data.authUrl) {
        window.location.href = res.data.authUrl;
      } else {
        setSyncMsg('❌ Teams integration not configured yet. See setup guide below.');
      }
    } catch (err) {
      setSyncMsg(`❌ ${err.response?.data?.message || 'Failed to start connection'}`);
    } finally { setConnectingId(null); }
  };

  // ── Disconnect Teams ───────────────────────────────────────────────────────
  const handleDisconnect = async () => {
    try {
      await api.post('/teams/auth/disconnect', { userId: activeDirectorId });
      setStatus({ connected: false, configured: status.configured });
      setSummary(null);
      setSyncMsg('Teams account disconnected.');
    } catch (err) { console.error(err); }
  };

  // ── Sync calendar into Events tab ─────────────────────────────────────────
  const handleSync = async () => {
    setSyncing(true); setSyncMsg('');
    try {
      const res = await api.post('/teams/sync', { directorId: activeDirectorId });
      setSyncMsg(`✅ ${res.data.message}`);
    } catch (err) {
      setSyncMsg(`❌ ${err.response?.data?.message || 'Sync failed'}`);
    } finally { setSyncing(false); }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatTime = (t) => {
    if (!t) return '';
    const [h, m] = t.split(':');
    const hour = parseInt(h);
    return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
  };

  const formatDate = (d) => d
    ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    : '';

  const isToday = (d) => d === new Date().toISOString().split('T')[0];

  const filteredCalendar = (summary?.calendarEvents || []).filter(e => {
    if (calFilter === 'teams') return e.isTeamsMeeting;
    if (calFilter === 'today') return isToday(e.startDate);
    return true;
  });

  const presence = summary?.presence || {};
  const ps = PRESENCE[presence.availability] || PRESENCE.Unknown;
  const mailbox = summary?.mailboxSettings || {};
  const isOOO = mailbox.autoReplyStatus === 'alwaysEnabled' || mailbox.autoReplyStatus === 'scheduled';

  // ── Not configured ─────────────────────────────────────────────────────────
  if (!status.configured && !loading) {
    return (
      <div className={styles.page}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}>Microsoft Teams</h1>
            <p className={styles.subtitle}>Connect Teams to sync calendar, tasks and presence</p>
          </div>
        </div>
        <SetupGuide />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Page Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Microsoft Teams</h1>
          <p className={styles.subtitle}>
            {selectedDirector?.name} — {status.connected ? `Connected as ${status.msUserEmail || 'Microsoft Account'}` : 'Not connected'}
          </p>
        </div>
        <div className={styles.headerActions}>
          {status.connected && isAdmin && (
            <>
              <button className={styles.syncBtn} onClick={handleSync} disabled={syncing}>
                <RefreshCw size={14} className={syncing ? styles.spinning : ''} />
                {syncing ? 'Syncing...' : 'Sync to Events'}
              </button>
              <button className={styles.disconnectBtn} onClick={handleDisconnect}>
                <Unlink size={14} /> Disconnect
              </button>
            </>
          )}
          {!status.connected && isAdmin && (
            <button
              className={styles.connectBtn}
              onClick={() => handleConnect(activeDirectorId)}
              disabled={connectingId === activeDirectorId}
            >
              <Link size={14} />
              {connectingId === activeDirectorId ? 'Connecting...' : 'Connect Teams'}
            </button>
          )}
          <button className={styles.refreshBtn} onClick={() => { fetchStatus(); fetchSummary(); }}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* ── Sync message ── */}
      {syncMsg && (
        <div className={`${styles.syncMsg} ${syncMsg.startsWith('❌') ? styles.syncMsgError : styles.syncMsgSuccess}`}>
          {syncMsg}
        </div>
      )}

      {/* ── Not connected state ── */}
      {!status.connected && (
        <div className={styles.notConnected}>
          <div className={styles.notConnectedIcon}><WifiOff size={40} /></div>
          <h3 className={styles.notConnectedTitle}>Teams not connected</h3>
          <p className={styles.notConnectedText}>
            Connect {selectedDirector?.name}'s Microsoft Teams account to see their calendar,
            tasks, presence and out-of-office status.
          </p>
          {isAdmin && (
            <button className={styles.connectBtnLarge} onClick={() => handleConnect(activeDirectorId)}>
              <Link size={16} /> Connect Microsoft Teams
            </button>
          )}

          {/* PA: show all directors connection status */}
          {isAdmin && directors.length > 0 && (
            <DirectorConnectionStatus
              directors={directors}
              onConnect={handleConnect}
              connectingId={connectingId}
            />
          )}
        </div>
      )}

      {/* ── Connected: Status Bar ── */}
      {status.connected && (
        <>
          <div className={styles.statusBar}>
            {/* Presence */}
            <div className={styles.statusCard} style={{ background: ps.bg }}>
              <div className={styles.presenceDot} style={{ background: ps.dot }} />
              <div>
                <div className={styles.statusCardLabel}>Presence</div>
                <div className={styles.statusCardValue} style={{ color: ps.color }}>{ps.label}</div>
                {presence.activity && presence.activity !== presence.availability && (
                  <div className={styles.statusCardSub}>{presence.activity}</div>
                )}
              </div>
            </div>

            {/* Today's meetings count */}
            <div className={styles.statusCard}>
              <Calendar size={20} color="#1e40af" />
              <div>
                <div className={styles.statusCardLabel}>Today's Meetings</div>
                <div className={styles.statusCardValue}>
                  {(summary?.todayEvents || []).length}
                </div>
              </div>
            </div>

            {/* Pending To Do tasks */}
            <div className={styles.statusCard}>
              <CheckSquare size={20} color="#7c3aed" />
              <div>
                <div className={styles.statusCardLabel}>To Do Tasks</div>
                <div className={styles.statusCardValue}>
                  {(summary?.tasks || []).length}
                </div>
              </div>
            </div>

            {/* Out of Office */}
            <div className={styles.statusCard} style={{ background: isOOO ? '#fff7ed' : undefined }}>
              <Mail size={20} color={isOOO ? '#c2410c' : '#64748b'} />
              <div>
                <div className={styles.statusCardLabel}>Out of Office</div>
                <div className={styles.statusCardValue} style={{ color: isOOO ? '#c2410c' : '#15803d' }}>
                  {isOOO ? 'Active' : 'Off'}
                </div>
              </div>
            </div>
          </div>

          {/* ── OOO Banner ── */}
          {isOOO && mailbox.autoReplyInternal && (
            <div className={styles.oooBanner}>
              <Bell size={14} />
              <div>
                <strong>Out of Office is active</strong>
                {mailbox.autoReplyStartTime && (
                  <span> · {new Date(mailbox.autoReplyStartTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {mailbox.autoReplyEndTime && ` → ${new Date(mailbox.autoReplyEndTime).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                  </span>
                )}
                <p className={styles.oooMessage}>{mailbox.autoReplyInternal.replace(/<[^>]*>/g, '')}</p>
              </div>
            </div>
          )}

          {/* ── Tabs ── */}
          <div className={styles.tabs}>
            {[
              { id: 'calendar', label: 'Calendar', icon: Calendar },
              { id: 'today',    label: "Today's Schedule", icon: Clock },
              { id: 'tasks',    label: 'To Do Tasks', icon: CheckSquare },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={`${styles.tab} ${activeTab === id ? styles.tabActive : ''}`}
                onClick={() => setActiveTab(id)}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </div>

          {/* ── Tab Content ── */}
          {loading ? (
            <div className={styles.skeletonList}>
              {[...Array(4)].map((_, i) => <div key={i} className={styles.skeletonItem} />)}
            </div>
          ) : (
            <>
              {/* Calendar Tab */}
              {activeTab === 'calendar' && (
                <div className={styles.tabContent}>
                  <div className={styles.calFilterRow}>
                    {['all', 'teams', 'today'].map(f => (
                      <button
                        key={f}
                        className={`${styles.filterChip} ${calFilter === f ? styles.filterChipActive : ''}`}
                        onClick={() => setCalFilter(f)}
                      >
                        {f === 'all' ? 'All Events' : f === 'teams' ? '🎥 Teams Meetings' : '📅 Today'}
                      </button>
                    ))}
                    <span className={styles.calCount}>{filteredCalendar.length} event{filteredCalendar.length !== 1 ? 's' : ''}</span>
                  </div>

                  {filteredCalendar.length === 0 ? (
                    <div className={styles.emptyTab}>
                      <Calendar size={32} color="#cbd5e1" />
                      <p>No events found</p>
                    </div>
                  ) : (
                    <div className={styles.eventList}>
                      {filteredCalendar.map(event => (
                        <CalendarEventCard key={event.id} event={event} formatTime={formatTime} formatDate={formatDate} isToday={isToday} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Today's Schedule Tab */}
              {activeTab === 'today' && (
                <div className={styles.tabContent}>
                  {(summary?.todayEvents || []).length === 0 ? (
                    <div className={styles.emptyTab}>
                      <Clock size={32} color="#cbd5e1" />
                      <p>No meetings scheduled for today</p>
                    </div>
                  ) : (
                    <div className={styles.todayTimeline}>
                      {(summary.todayEvents || []).map(event => (
                        <TodayEventRow key={event.id} event={event} formatTime={formatTime} />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tasks Tab */}
              {activeTab === 'tasks' && (
                <div className={styles.tabContent}>
                  {(summary?.tasks || []).length === 0 ? (
                    <div className={styles.emptyTab}>
                      <CheckSquare size={32} color="#cbd5e1" />
                      <p>No pending To Do tasks</p>
                    </div>
                  ) : (
                    <TasksList tasks={summary.tasks} />
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

// ── Sub-components ────────────────────────────────────────────────────────────

const CalendarEventCard = ({ event, formatTime, formatDate, isToday }) => {
  const [expanded, setExpanded] = useState(false);
  const today = isToday(event.startDate);

  return (
    <div className={`${styles.calCard} ${today ? styles.calCardToday : ''} ${event.isTeamsMeeting ? styles.calCardTeams : ''}`}>
      <div className={styles.calCardMain} onClick={() => setExpanded(v => !v)}>
        <div className={styles.calDateCol}>
          <div className={styles.calDay}>{new Date(event.startDate).getDate()}</div>
          <div className={styles.calMonth}>{new Date(event.startDate).toLocaleDateString('en-GB', { month: 'short' })}</div>
          {today && <div className={styles.todayPill}>Today</div>}
        </div>

        <div className={styles.calInfo}>
          <div className={styles.calTitle}>
            {event.isTeamsMeeting && <span className={styles.teamsBadge}>🎥 Teams</span>}
            {event.title}
          </div>
          <div className={styles.calMeta}>
            {!event.isAllDay && (
              <span><Clock size={11} /> {formatTime(event.startTime)}{event.endTime ? ` – ${formatTime(event.endTime)}` : ''}</span>
            )}
            {event.isAllDay && <span>All Day</span>}
            {event.location && <span><MapPin size={11} /> {event.location}</span>}
            {event.attendees?.length > 0 && <span>👥 {event.attendees.length} attendee{event.attendees.length !== 1 ? 's' : ''}</span>}
          </div>
        </div>

        <div className={styles.calActions}>
          {event.joinUrl && (
            <a href={event.joinUrl} target="_blank" rel="noopener noreferrer" className={styles.joinBtn} onClick={e => e.stopPropagation()}>
              <ExternalLink size={12} /> Join
            </a>
          )}
          <button className={styles.expandBtn} aria-label="Toggle details">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className={styles.calExpanded}>
          {event.description && <p className={styles.calDesc}>{event.description}</p>}
          {event.organizer && <p className={styles.calMeta2}>Organizer: {event.organizer}</p>}
          {event.attendees?.length > 0 && (
            <div className={styles.attendeeList}>
              {event.attendees.map((a, i) => (
                <span key={i} className={styles.attendeeChip}>{a}</span>
              ))}
            </div>
          )}
          {event.categories?.length > 0 && (
            <div className={styles.calMeta2}>
              Categories: {event.categories.join(', ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const TodayEventRow = ({ event, formatTime }) => (
  <div className={`${styles.todayRow} ${event.isTeamsMeeting ? styles.todayRowTeams : ''}`}>
    <div className={styles.todayTime}>
      <div className={styles.todayTimeStart}>{formatTime(event.startTime)}</div>
      {event.endTime && <div className={styles.todayTimeEnd}>{formatTime(event.endTime)}</div>}
    </div>
    <div className={styles.todayBar} style={{ background: event.isTeamsMeeting ? '#6366f1' : '#3b82f6' }} />
    <div className={styles.todayInfo}>
      <div className={styles.todayTitle}>
        {event.isTeamsMeeting && <span className={styles.teamsBadge}>🎥</span>}
        {event.title}
      </div>
      {event.location && <div className={styles.todayLocation}><MapPin size={11} /> {event.location}</div>}
    </div>
    {event.joinUrl && (
      <a href={event.joinUrl} target="_blank" rel="noopener noreferrer" className={styles.joinBtn}>
        <ExternalLink size={12} /> Join
      </a>
    )}
  </div>
);

const TasksList = ({ tasks }) => {
  const grouped = tasks.reduce((acc, t) => {
    const list = t.listName || 'Tasks';
    if (!acc[list]) acc[list] = [];
    acc[list].push(t);
    return acc;
  }, {});

  return (
    <div className={styles.tasksList}>
      {Object.entries(grouped).map(([listName, listTasks]) => (
        <div key={listName} className={styles.tasksGroup}>
          <div className={styles.tasksGroupTitle}>{listName} · {listTasks.length}</div>
          {listTasks.map(task => {
            const imp = IMPORTANCE[task.importance] || IMPORTANCE.normal;
            const isOverdue = task.dueDate && task.dueDate < new Date().toISOString().split('T')[0];
            return (
              <div key={task.id} className={`${styles.taskRow} ${isOverdue ? styles.taskRowOverdue : ''}`}>
                <div className={styles.taskCheck}>
                  <div className={styles.taskCheckBox} />
                </div>
                <div className={styles.taskInfo}>
                  <div className={styles.taskTitle}>{task.title}</div>
                  {task.dueDate && (
                    <div className={`${styles.taskDue} ${isOverdue ? styles.taskDueOverdue : ''}`}>
                      📅 Due: {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {isOverdue && ' · Overdue'}
                    </div>
                  )}
                </div>
                <span className={styles.impBadge} style={{ background: imp.bg, color: imp.color }}>
                  {imp.label}
                </span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
};

const DirectorConnectionStatus = ({ directors, onConnect, connectingId }) => (
  <div className={styles.directorConnections}>
    <h3 className={styles.dirConnTitle}>All Directors — Teams Connection Status</h3>
    <div className={styles.dirConnGrid}>
      {directors.map(d => (
        <DirectorConnCard key={d.id} director={d} onConnect={onConnect} connectingId={connectingId} />
      ))}
    </div>
  </div>
);

const DirectorConnCard = ({ director, onConnect, connectingId }) => {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    api.get('/teams/status', { params: { userId: director.id } })
      .then(r => setStatus(r.data))
      .catch(() => setStatus({ connected: false }));
  }, [director.id]);

  return (
    <div className={styles.dirConnCard}>
      <div className={styles.dirConnAvatar}>{director.avatar}</div>
      <div className={styles.dirConnInfo}>
        <div className={styles.dirConnName}>{director.name}</div>
        <div className={styles.dirConnStatus}>
          {status === null ? '...' : status.connected
            ? <span style={{ color: '#15803d' }}>✓ Connected · {status.msUserEmail}</span>
            : <span style={{ color: '#94a3b8' }}>Not connected</span>
          }
        </div>
      </div>
      {status && !status.connected && (
        <button
          className={styles.dirConnBtn}
          onClick={() => onConnect(director.id)}
          disabled={connectingId === director.id}
        >
          {connectingId === director.id ? '...' : <><Link size={12} /> Connect</>}
        </button>
      )}
    </div>
  );
};

const SetupGuide = () => (
  <div className={styles.setupGuide}>
    <div className={styles.setupHeader}>
      <AlertCircle size={20} color="#d97706" />
      <h3>Teams Integration Setup Required</h3>
    </div>
    <p className={styles.setupIntro}>
      To connect Microsoft Teams, you need to register an Azure AD app and add the credentials to your backend <code>.env</code> file.
    </p>
    <ol className={styles.setupSteps}>
      <li>
        <strong>Go to Azure Portal</strong> →{' '}
        <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer">portal.azure.com</a>
        {' '}→ Azure Active Directory → App Registrations → New Registration
      </li>
      <li>
        <strong>Set Redirect URI:</strong> <code>http://localhost:5000/api/teams/auth/callback</code>
        <br />(Web platform, not SPA)
      </li>
      <li>
        <strong>Add API Permissions</strong> (Delegated):
        <ul className={styles.permList}>
          <li><code>Calendars.Read</code> — Read calendar events</li>
          <li><code>OnlineMeetings.Read</code> — Read Teams meetings</li>
          <li><code>Tasks.Read</code> — Read Microsoft To Do tasks</li>
          <li><code>Presence.Read</code> — Read user presence</li>
          <li><code>Chat.Read</code> — Read Teams chats</li>
          <li><code>MailboxSettings.Read</code> — Read out-of-office status</li>
          <li><code>User.Read</code> — Read user profile</li>
          <li><code>offline_access</code> — Refresh tokens</li>
        </ul>
      </li>
      <li>
        <strong>Create a Client Secret</strong> → Certificates &amp; Secrets → New client secret
      </li>
      <li>
        <strong>Update <code>backend/.env</code></strong>:
        <pre className={styles.codeBlock}>{`AZURE_CLIENT_ID=your_app_client_id
AZURE_CLIENT_SECRET=your_client_secret
AZURE_TENANT_ID=your_tenant_id
AZURE_REDIRECT_URI=http://localhost:5000/api/teams/auth/callback`}</pre>
      </li>
      <li><strong>Restart the backend</strong> and come back to this page.</li>
    </ol>
  </div>
);

export default Teams;
