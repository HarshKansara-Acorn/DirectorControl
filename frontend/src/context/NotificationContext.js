import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from './AuthContext';
import { useDirector } from './DirectorContext';

const NotificationContext = createContext(null);

/**
 * Aggregates notifications from:
 *  - Pending approvals
 *  - Unread urgent emails
 *  - Overdue bills
 *  - Key reminders due within 7 days
 *  - Warranty / document expiry within 30 days
 *  - Upcoming events today or tomorrow
 */
export const NotificationProvider = ({ children }) => {
  const { user } = useAuth();
  const { activeDirectorId } = useDirector();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const buildNotifications = useCallback(async () => {
    if (!user || !activeDirectorId) return;
    setLoading(true);

    try {
      const params = { directorId: activeDirectorId };
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [approvalsRes, emailsRes, billsRes, remindersRes, documentsRes, assetsRes, eventsRes] =
        await Promise.allSettled([
          api.get('/approvals', { params }),
          api.get('/emails', { params }),
          api.get('/bills', { params }),
          api.get('/reminders', { params }),
          api.get('/documents', { params }),
          api.get('/assets', { params }),
          api.get('/events', { params }),
        ]);

      const notifs = [];

      // Pending approvals
      if (approvalsRes.status === 'fulfilled') {
        approvalsRes.value.data
          .filter(a => a.status === 'pending')
          .forEach(a => notifs.push({
            id: `approval-${a.id}`,
            type: 'approval',
            icon: '✅',
            title: 'Pending Approval',
            message: `${a.title} — from ${a.fromName}`,
            priority: 'high',
            time: a.createdAt,
            link: '/dashboard',
          }));
      }

      // Unread urgent emails
      if (emailsRes.status === 'fulfilled') {
        emailsRes.value.data
          .filter(e => !e.isRead)
          .forEach(e => notifs.push({
            id: `email-${e.id}`,
            type: 'email',
            icon: '📧',
            title: 'Urgent Email',
            message: e.subject,
            priority: 'high',
            time: e.createdAt,
            link: '/dashboard',
          }));
      }

      // Overdue bills
      if (billsRes.status === 'fulfilled') {
        billsRes.value.data
          .filter(b => b.status === 'overdue' || (b.status === 'pending' && b.dueDate && b.dueDate < todayStr))
          .forEach(b => notifs.push({
            id: `bill-${b.id}`,
            type: 'bill',
            icon: '🧾',
            title: 'Overdue Bill',
            message: `${b.title} — ${b.currency}${Number(b.amount).toLocaleString('en-IN')}`,
            priority: 'high',
            time: b.createdAt,
            link: '/bills',
          }));
      }

      // Reminders due within 7 days
      if (remindersRes.status === 'fulfilled') {
        remindersRes.value.data
          .filter(r => r.isActive && r.dueDate && r.dueDate >= todayStr && r.dueDate <= in7Days)
          .forEach(r => notifs.push({
            id: `reminder-${r.id}`,
            type: 'reminder',
            icon: '🔔',
            title: 'Key Reminder',
            message: `${r.title} — due ${new Date(r.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
            priority: r.priority === 'high' ? 'high' : 'medium',
            time: r.createdAt,
            link: '/dashboard',
          }));
      }

      // Documents expiring within 30 days
      if (documentsRes.status === 'fulfilled') {
        documentsRes.value.data
          .filter(d => d.expiryDate && d.expiryDate >= todayStr && d.expiryDate <= in30Days)
          .forEach(d => notifs.push({
            id: `doc-${d.id}`,
            type: 'document',
            icon: '📄',
            title: 'Document Expiring',
            message: `${d.title} expires ${new Date(d.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
            priority: 'medium',
            time: d.createdAt,
            link: '/documents',
          }));
      }

      // Assets with warranty expiring within 30 days
      if (assetsRes.status === 'fulfilled') {
        assetsRes.value.data
          .filter(a => a.warrantyExpiry && a.warrantyExpiry >= todayStr && a.warrantyExpiry <= in30Days)
          .forEach(a => notifs.push({
            id: `asset-${a.id}`,
            type: 'asset',
            icon: '📦',
            title: 'Warranty Expiring',
            message: `${a.name} warranty expires ${new Date(a.warrantyExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
            priority: 'medium',
            time: a.createdAt,
            link: '/assets',
          }));
      }

      // Events today or tomorrow
      if (eventsRes.status === 'fulfilled') {
        eventsRes.value.data
          .filter(e => e.startDate === todayStr || e.startDate === tomorrow)
          .forEach(e => notifs.push({
            id: `event-${e.id}`,
            type: 'event',
            icon: '📅',
            title: e.startDate === todayStr ? 'Event Today' : 'Event Tomorrow',
            message: `${e.title}${e.startTime ? ` at ${e.startTime}` : ''}${e.location ? ` · ${e.location}` : ''}`,
            priority: e.priority === 'high' ? 'high' : 'low',
            time: e.createdAt,
            link: '/events',
          }));
      }

      // Teams: today's meetings & overdue To Do tasks
      try {
        const teamsStatus = await api.get('/teams/status', { params });
        if (teamsStatus.data?.connected) {
          const [teamsTodayRes, teamsTasksRes, teamsMailboxRes] = await Promise.allSettled([
            api.get('/teams/today', { params }),
            api.get('/teams/tasks', { params }),
            api.get('/teams/summary', { params }),
          ]);

          // Teams meetings today
          if (teamsTodayRes.status === 'fulfilled') {
            teamsTodayRes.value.data.forEach(e => {
              notifs.push({
                id: `teams-today-${e.id}`,
                type: 'teams_meeting',
                icon: '🎥',
                title: e.isTeamsMeeting ? 'Teams Meeting Today' : 'Meeting Today',
                message: `${e.title}${e.startTime ? ` at ${e.startTime}` : ''}`,
                priority: e.importance === 'high' ? 'high' : 'medium',
                time: new Date().toISOString(),
                link: '/teams',
              });
            });
          }

          // Teams To Do tasks overdue
          if (teamsTasksRes.status === 'fulfilled') {
            teamsTasksRes.value.data
              .filter(t => t.dueDate && t.dueDate < todayStr)
              .forEach(t => notifs.push({
                id: `teams-task-${t.id}`,
                type: 'teams_task',
                icon: '✔️',
                title: 'Overdue To Do Task',
                message: `${t.title} (${t.listName})`,
                priority: t.importance === 'high' ? 'high' : 'medium',
                time: t.createdAt || new Date().toISOString(),
                link: '/teams',
              }));
          }

          // Out of office active
          if (teamsMailboxRes.status === 'fulfilled') {
            const mb = teamsMailboxRes.value.data?.mailboxSettings;
            if (mb?.autoReplyStatus === 'alwaysEnabled' || mb?.autoReplyStatus === 'scheduled') {
              notifs.push({
                id: 'teams-ooo',
                type: 'teams_ooo',
                icon: '🏖️',
                title: 'Out of Office Active',
                message: 'Automatic replies are currently enabled',
                priority: 'medium',
                time: new Date().toISOString(),
                link: '/teams',
              });
            }
          }
        }
      } catch {
        // Teams not configured — skip silently
      }

      // Sort: high priority first, then by time descending
      notifs.sort((a, b) => {
        const pOrder = { high: 0, medium: 1, low: 2 };
        if (pOrder[a.priority] !== pOrder[b.priority]) return pOrder[a.priority] - pOrder[b.priority];
        return new Date(b.time) - new Date(a.time);
      });

      setNotifications(notifs);
    } catch (err) {
      console.error('Failed to build notifications:', err);
    } finally {
      setLoading(false);
    }
  }, [user, activeDirectorId]);

  useEffect(() => {
    buildNotifications();
    // Refresh every 2 minutes
    const interval = setInterval(buildNotifications, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [buildNotifications]);

  return (
    <NotificationContext.Provider value={{ notifications, loading, refresh: buildNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};
