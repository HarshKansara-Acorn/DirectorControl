import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import {
  CheckSquare, Bell, Clock, AlertCircle, ChevronRight,
  CheckCircle2, Calendar, Mail, RefreshCw, MapPin,
} from 'lucide-react';
import styles from './DirectorDashboard.module.css';

const PRIORITY_STYLES = {
  high:   { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444', label: 'High' },
  medium: { bg: '#fff7ed', color: '#d97706', dot: '#f59e0b', label: 'Medium' },
  low:    { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e', label: 'Low' },
};

const STATUS_LABELS = {
  todo:       { label: 'To Do',       bg: '#f8fafc', color: '#64748b' },
  inprogress: { label: 'In Progress', bg: '#fffbeb', color: '#d97706' },
  review:     { label: 'Review',      bg: '#faf5ff', color: '#7c3aed' },
  done:       { label: 'Done',        bg: '#f0fdf4', color: '#15803d' },
};

const IMPORTANCE_COLORS = {
  high:   { color: '#dc2626', bg: '#fef2f2' },
  normal: { color: '#64748b', bg: '#f8fafc' },
  low:    { color: '#94a3b8', bg: '#f8fafc' },
};

const EVENT_TYPE_STYLES = {
  meeting:       { icon: '🤝', color: '#1e40af', bg: '#eff6ff' },
  online_meeting:{ icon: '💻', color: '#7c3aed', bg: '#faf5ff' },
  conference:    { icon: '🎤', color: '#7c3aed', bg: '#faf5ff' },
  presentation:  { icon: '📊', color: '#c2410c', bg: '#fff7ed' },
  company:       { icon: '🏢', color: '#15803d', bg: '#f0fdf4' },
  personal:      { icon: '👤', color: '#64748b', bg: '#f8fafc' },
  all_day:       { icon: '📅', color: '#64748b', bg: '#f8fafc' },
  other:         { icon: '📅', color: '#64748b', bg: '#f8fafc' },
};

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  : '—';

const DirectorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const syncIntervalRef = useRef(null);

  const [tasks, setTasks]         = useState([]);
  const [reminders, setReminders] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [meetings, setMeetings]   = useState([]);
  const [mails, setMails]         = useState([]);
  const [events, setEvents]       = useState([]);
  const [outlookConnected, setOutlookConnected] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);

  // Auto-sync Outlook then refresh events
  const syncOutlook = useCallback(async () => {
    if (!user?.id) return;
    try {
      await api.get('/teams/auto-sync', { params: { directorId: user.id } });
      const evRes = await api.get('/events');
      setEvents(evRes.data);
      setLastSynced(new Date());
    } catch { /* silent */ }
  }, [user?.id]);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const today = new Date().toISOString().split('T')[0];

    try {
      const [t, r, a, m, mailRes, evRes] = await Promise.allSettled([
        api.get('/tasks'),
        api.get('/reminders'),
        api.get('/approvals'),
        api.get('/meetings', { params: { date: today } }),
        api.get('/teams/unread-mail', { params: { userId: user?.id } }),
        api.get('/events'),
      ]);

      if (t.status === 'fulfilled') setTasks(t.value.data);
      if (r.status === 'fulfilled') setReminders(r.value.data);
      if (a.status === 'fulfilled') setApprovals(a.value.data);
      if (m.status === 'fulfilled') setMeetings(m.value.data);
      if (mailRes.status === 'fulfilled') {
        setOutlookConnected(mailRes.value.data.connected);
        setMails(mailRes.value.data.mails || []);
      }
      if (evRes.status === 'fulfilled') setEvents(evRes.value.data);

    } catch (err) {
      console.error('Failed to load director dashboard:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  // Initial load + immediate Outlook sync
  useEffect(() => {
    fetchData();
    syncOutlook();
  }, [fetchData, syncOutlook]);

  // Auto-sync Outlook every 30 seconds
  useEffect(() => {
    syncIntervalRef.current = setInterval(syncOutlook, 30000);
    return () => clearInterval(syncIntervalRef.current);
  }, [syncOutlook]);

  // Refresh dashboard data every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => fetchData(true), 60000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const today = new Date().toISOString().split('T')[0];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const pendingTasks     = tasks.filter(t => t.status !== 'done');
  const overdueTasks     = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');
  const dueTodayTasks    = tasks.filter(t => t.dueDate === today && t.status !== 'done');
  const activeReminders  = reminders.filter(r => r.isActive && (!r.dueDate || r.dueDate >= today));
  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const unreadMails      = mails.filter(m => !m.isRead);
  // Upcoming events — next 7 days, sorted by date
  const upcomingEvents   = events
    .filter(e => e.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, 6);

  const handleApprovalAction = async (id, action) => {
    try {
      await api.patch(`/approvals/${id}/action`, { action });
      fetchData(true);
    } catch (err) { console.error(err); }
  };

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).toUpperCase();

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.skeletonHeader} />
        <div className={styles.skeletonGrid}>
          {[...Array(4)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <p className={styles.dateStr}>{dateStr}</p>
          <h1 className={styles.greeting}>{greeting()}, {user?.name?.split(' ')[0]}</h1>
          <p className={styles.summary}>
            You have{' '}
            <strong>{pendingTasks.length}</strong> pending task{pendingTasks.length !== 1 ? 's' : ''},{' '}
            <strong>{activeReminders.length}</strong> active reminder{activeReminders.length !== 1 ? 's' : ''},{' '}
            <strong>{pendingApprovals.length}</strong> approval{pendingApprovals.length !== 1 ? 's' : ''} waiting
            {meetings.length > 0 && <>, and <strong>{meetings.length}</strong> meeting{meetings.length !== 1 ? 's' : ''} today</>}.
          </p>
        </div>
        <button
          className={`${styles.refreshBtn} ${refreshing ? styles.refreshBtnSpinning : ''}`}
          onClick={() => { fetchData(true); syncOutlook(); }}
          title="Refresh dashboard"
          disabled={refreshing}
        >
          <RefreshCw size={14} />
          {lastSynced && (
            <span className={styles.refreshTime}>
              Synced {lastSynced.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </button>
      </div>

      {/* ── Stats Row ── */}
      <div className={styles.statsRow}>
        <div className={`${styles.statCard} ${overdueTasks.length > 0 ? styles.statCardAlert : ''}`}
          onClick={() => navigate('/director/tasks')} role="button" tabIndex={0}>
          <div className={styles.statIcon} style={{ background: '#fef2f2' }}>
            <AlertCircle size={20} color="#dc2626" />
          </div>
          <div>
            <div className={styles.statValue} style={{ color: overdueTasks.length > 0 ? '#dc2626' : 'var(--text-primary)' }}>
              {overdueTasks.length}
            </div>
            <div className={styles.statLabel}>Overdue Tasks</div>
          </div>
        </div>

        <div className={styles.statCard} onClick={() => navigate('/director/tasks')} role="button" tabIndex={0}>
          <div className={styles.statIcon} style={{ background: '#fffbeb' }}>
            <Clock size={20} color="#d97706" />
          </div>
          <div>
            <div className={styles.statValue}>{dueTodayTasks.length}</div>
            <div className={styles.statLabel}>Due Today</div>
          </div>
        </div>

        <div className={styles.statCard} onClick={() => navigate('/director/tasks')} role="button" tabIndex={0}>
          <div className={styles.statIcon} style={{ background: '#eff6ff' }}>
            <CheckSquare size={20} color="#1e40af" />
          </div>
          <div>
            <div className={styles.statValue}>{pendingTasks.length}</div>
            <div className={styles.statLabel}>Pending Tasks</div>
          </div>
        </div>

        <div className={`${styles.statCard} ${pendingApprovals.length > 0 ? styles.statCardWarning : ''}`}
          onClick={() => navigate('/director/approvals')} role="button" tabIndex={0}>
          <div className={styles.statIcon} style={{ background: '#fff7ed' }}>
            <Bell size={20} color="#c2410c" />
          </div>
          <div>
            <div className={styles.statValue} style={{ color: pendingApprovals.length > 0 ? '#c2410c' : 'var(--text-primary)' }}>
              {pendingApprovals.length}
            </div>
            <div className={styles.statLabel}>Pending Approvals</div>
          </div>
        </div>

        <div className={`${styles.statCard} ${meetings.length > 0 ? styles.statCardInfo : ''}`}
          onClick={() => navigate('/director/events')} role="button" tabIndex={0}>
          <div className={styles.statIcon} style={{ background: '#f0fdf4' }}>
            <Calendar size={20} color="#15803d" />
          </div>
          <div>
            <div className={styles.statValue} style={{ color: meetings.length > 0 ? '#15803d' : 'var(--text-primary)' }}>
              {meetings.length}
            </div>
            <div className={styles.statLabel}>Meetings Today</div>
          </div>
        </div>

        <div className={`${styles.statCard} ${unreadMails.length > 0 ? styles.statCardMail : ''}`}>
          <div className={styles.statIcon} style={{ background: unreadMails.length > 0 ? '#fef2f2' : '#f8fafc' }}>
            <Mail size={20} color={unreadMails.length > 0 ? '#dc2626' : '#94a3b8'} />
          </div>
          <div>
            <div className={styles.statValue} style={{ color: unreadMails.length > 0 ? '#dc2626' : 'var(--text-primary)' }}>
              {outlookConnected ? unreadMails.length : '—'}
            </div>
            <div className={styles.statLabel}>Unread Mails</div>
          </div>
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div className={styles.grid}>

        {/* ── Outlook Calendar Events ── */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <Calendar size={16} />
              <span>Upcoming Events</span>
              {upcomingEvents.length > 0 && (
                <span className={styles.badge} style={{ background: '#eff6ff', color: '#1e40af' }}>
                  {upcomingEvents.length}
                </span>
              )}
              {lastSynced && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>
                  · synced {lastSynced.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <button className={styles.viewAll} onClick={() => navigate('/director/events')}>
              View all <ChevronRight size={13} />
            </button>
          </div>

          {!outlookConnected && upcomingEvents.length === 0 ? (
            <div className={styles.empty}>
              <Calendar size={28} color="var(--text-disabled)" />
              <p>Connect Outlook to sync your calendar</p>
              <button className={styles.connectBtn}
                onClick={() => navigate('/director/settings?section=linked')}>
                Connect Outlook
              </button>
            </div>
          ) : upcomingEvents.length === 0 ? (
            <div className={styles.empty}>
              <Calendar size={28} color="var(--text-disabled)" />
              <p>No upcoming events</p>
            </div>
          ) : (
            <div className={styles.eventList}>
              {upcomingEvents.map(ev => {
                const t = EVENT_TYPE_STYLES[ev.type] || EVENT_TYPE_STYLES.other;
                const isToday = ev.startDate === today;
                return (
                  <div key={ev.id} className={`${styles.eventItem} ${isToday ? styles.eventItemToday : ''}`}>
                    <div className={styles.eventDateCol}>
                      <div className={styles.eventDay}>{new Date(ev.startDate).getDate()}</div>
                      <div className={styles.eventMonth}>
                        {new Date(ev.startDate).toLocaleDateString('en-GB', { month: 'short' })}
                      </div>
                      {isToday && <div className={styles.todayPill}>Today</div>}
                    </div>
                    <div className={styles.eventTypeIcon} style={{ background: t.bg }}>{t.icon}</div>
                    <div className={styles.eventInfo}>
                      <div className={styles.eventTitle}>{ev.title}</div>
                      <div className={styles.eventMeta}>
                        {!ev.isAllDay && ev.startTime && (
                          <span>🕐 {fmtTime(ev.startTime)}{ev.endTime ? ` – ${fmtTime(ev.endTime)}` : ''}</span>
                        )}
                        {ev.isAllDay && <span>All Day</span>}
                        {ev.location && <span>📍 {ev.location}</span>}
                      </div>
                    </div>
                    {ev.source === 'outlook' && (
                      <span className={styles.outlookBadge}>📧</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Today's Meetings ── */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <Calendar size={16} />
              <span>Today's Meetings</span>
              {meetings.length > 0 && (
                <span className={styles.badge} style={{ background: '#f0fdf4', color: '#15803d' }}>
                  {meetings.length}
                </span>
              )}
            </div>
          </div>

          {meetings.length === 0 ? (
            <div className={styles.empty}>
              <Calendar size={28} color="var(--text-disabled)" />
              <p>No meetings today</p>
            </div>
          ) : (
            <div className={styles.meetingList}>
              {meetings.map(m => (
                <div key={m.id} className={styles.meetingItem}>
                  <div className={styles.meetingTime}>
                    {m.time ? fmtTime(m.time) : '—'}
                    {m.duration && <span className={styles.meetingDuration}>{m.duration}m</span>}
                  </div>
                  <div className={styles.meetingInfo}>
                    <div className={styles.meetingTitle}>
                      {m.isShared && <span className={styles.sharedBadge}>👥 All</span>}
                      {m.title}
                    </div>
                    {m.location && <div className={styles.meetingLocation}>📍 {m.location}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Unread Mails ── */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <Mail size={16} />
              <span>Unread Mails</span>
              {unreadMails.length > 0 && (
                <span className={styles.badge} style={{ background: '#fef2f2', color: '#dc2626' }}>
                  {unreadMails.length}
                </span>
              )}
            </div>
          </div>

          {!outlookConnected ? (
            <div className={styles.empty}>
              <Mail size={28} color="var(--text-disabled)" />
              <p>Connect Outlook to see unread mails</p>
              <button className={styles.connectBtn}
                onClick={() => navigate('/director/settings?section=linked')}>
                Connect Outlook
              </button>
            </div>
          ) : unreadMails.length === 0 ? (
            <div className={styles.empty}>
              <Mail size={28} color="var(--text-disabled)" />
              <p>No unread mails 🎉</p>
            </div>
          ) : (
            <div className={styles.mailList}>
              {unreadMails.slice(0, 5).map(m => {
                const imp = IMPORTANCE_COLORS[m.importance] || IMPORTANCE_COLORS.normal;
                return (
                  <div key={m.id} className={styles.mailItem}>
                    <div className={styles.mailDot} style={{ background: imp.color }} />
                    <div className={styles.mailInfo}>
                      <div className={styles.mailSubject}>{m.subject}</div>
                      <div className={styles.mailMeta}>
                        <span className={styles.mailFrom}>{m.from}</span>
                        <span className={styles.mailTime}>
                          {new Date(m.receivedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      {m.preview && <div className={styles.mailPreview}>{m.preview}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Pending Approvals ── */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <Bell size={16} />
              <span>Pending Approvals</span>
              {pendingApprovals.length > 0 && (
                <span className={styles.badge} style={{ background: '#fff7ed', color: '#c2410c' }}>
                  {pendingApprovals.length}
                </span>
              )}
            </div>
            <button className={styles.viewAll} onClick={() => navigate('/director/approvals')}>
              View all <ChevronRight size={13} />
            </button>
          </div>

          {pendingApprovals.length === 0 ? (
            <div className={styles.empty}>
              <CheckCircle2 size={28} color="var(--text-disabled)" />
              <p>No pending approvals</p>
            </div>
          ) : (
            <div className={styles.approvalList}>
              {pendingApprovals.slice(0, 3).map(a => (
                <div key={a.id} className={styles.approvalCard}>
                  <div className={styles.approvalInfo}>
                    <div className={styles.approvalTitle}>{a.title}</div>
                    <div className={styles.approvalMeta}>
                      {a.fromName && <span>From: {a.fromName}</span>}
                      {a.dueDate && <span>Due: {fmtDate(a.dueDate)}</span>}
                      <span className={styles.approvalType}>{a.type}</span>
                    </div>
                  </div>
                  <div className={styles.approvalActions}>
                    <button className={styles.approveBtn} onClick={() => handleApprovalAction(a.id, 'approved')}>✓ Approve</button>
                    <button className={styles.rejectBtn} onClick={() => handleApprovalAction(a.id, 'rejected')}>✕ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Key Reminders ── */}
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <Bell size={16} />
              <span>Key Reminders</span>
              {activeReminders.length > 0 && (
                <span className={styles.badge} style={{ background: '#eff6ff', color: '#1e40af' }}>
                  {activeReminders.length}
                </span>
              )}
            </div>
            <button className={styles.viewAll} onClick={() => navigate('/director/reminders')}>
              View all <ChevronRight size={13} />
            </button>
          </div>

          {activeReminders.length === 0 ? (
            <div className={styles.empty}>
              <Bell size={28} color="var(--text-disabled)" />
              <p>No active reminders</p>
            </div>
          ) : (
            <div className={styles.reminderList}>
              {activeReminders.slice(0, 5).map(r => {
                const p = PRIORITY_STYLES[r.priority] || PRIORITY_STYLES.medium;
                const isOverdue = r.dueDate && r.dueDate < today;
                return (
                  <div key={r.id} className={styles.reminderItem}>
                    <div className={styles.reminderDot} style={{ background: p.dot }} />
                    <div className={styles.reminderContent}>
                      <div className={styles.reminderTitle}>{r.title}</div>
                      {r.dueDate && (
                        <div className={`${styles.reminderDue} ${isOverdue ? styles.reminderDueOverdue : ''}`}>
                          📅 {isOverdue ? 'Overdue · ' : ''}{fmtDate(r.dueDate)}
                        </div>
                      )}
                    </div>
                    <span className={styles.priorityBadge} style={{ background: p.bg, color: p.color }}>{p.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── My Tasks ── */}
        <div className={`${styles.section} ${styles.sectionFull}`}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>
              <CheckSquare size={16} />
              <span>My Tasks</span>
              {pendingTasks.length > 0 && (
                <span className={styles.badge} style={{ background: '#f0fdf4', color: '#15803d' }}>
                  {pendingTasks.length} pending
                </span>
              )}
            </div>
            <button className={styles.viewAll} onClick={() => navigate('/director/tasks')}>
              View all <ChevronRight size={13} />
            </button>
          </div>

          {pendingTasks.length === 0 ? (
            <div className={styles.empty}>
              <CheckCircle2 size={28} color="var(--text-disabled)" />
              <p>All tasks completed!</p>
            </div>
          ) : (
            <div className={styles.taskTable}>
              <div className={styles.taskTableHead}>
                <span>Task</span><span>Priority</span><span>Status</span><span>Due Date</span>
              </div>
              {pendingTasks.slice(0, 8).map(t => {
                const p = PRIORITY_STYLES[t.priority] || PRIORITY_STYLES.medium;
                const s = STATUS_LABELS[t.status] || STATUS_LABELS.todo;
                const isOverdue = t.dueDate && t.dueDate < today;
                return (
                  <div key={t.id} className={`${styles.taskRow} ${isOverdue ? styles.taskRowOverdue : ''}`}>
                    <div className={styles.taskTitle}>
                      {isOverdue && <span className={styles.overdueTag}>Overdue</span>}
                      {t.title}
                    </div>
                    <span className={styles.priorityBadge} style={{ background: p.bg, color: p.color }}>{p.label}</span>
                    <span className={styles.statusBadge} style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    <span className={`${styles.dueDate} ${isOverdue ? styles.dueDateOverdue : ''}`}>
                      {t.dueDate ? fmtDate(t.dueDate) : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default DirectorDashboard;
