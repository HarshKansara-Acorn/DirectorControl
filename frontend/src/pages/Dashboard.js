import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDirector } from '../context/DirectorContext';
import api from '../services/api';
import MeetingsCard from '../components/dashboard/MeetingsCard';
import UrgentEmailsCard from '../components/dashboard/UrgentEmailsCard';
import RemindersCard from '../components/dashboard/RemindersCard';
import ApprovalsCard from '../components/dashboard/ApprovalsCard';
import TravelCard from '../components/dashboard/TravelCard';
import TaskSummaryCard from '../components/dashboard/TaskSummaryCard';
import styles from './Dashboard.module.css';

const Dashboard = () => {
  const { user } = useAuth();
  const { activeDirectorId, selectedDirector } = useDirector();

  const [data, setData] = useState({
    meetings: [],
    emails: [],
    reminders: [],
    approvals: [],
    travel: [],
    tasks: [],
  });
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!activeDirectorId) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      const params = { directorId: activeDirectorId };

      const [meetings, emails, reminders, approvals, travel, tasks] = await Promise.all([
        api.get('/meetings', { params: { ...params, date: today } }),
        api.get('/emails', { params }),
        api.get('/reminders', { params }),
        api.get('/approvals', { params }),
        api.get('/travel', { params }),
        api.get('/tasks', { params }),
      ]);

      setData({
        meetings: meetings.data,
        emails: emails.data,
        reminders: reminders.data,
        approvals: approvals.data,
        travel: travel.data,
        tasks: tasks.data,
      });
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [activeDirectorId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  }).toUpperCase();

  const displayName = selectedDirector?.name?.split(' ')[0] || user?.name?.split(' ')[0] || 'there';
  const pendingApprovals = data.approvals.filter(a => a.status === 'pending').length;
  const unreadEmails = data.emails.filter(e => !e.isRead).length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <p className={styles.dateStr}>{dateStr}</p>
          <h1 className={styles.greeting}>{greeting()}, {displayName}</h1>
          <p className={styles.summary}>
            You have{' '}
            <strong>{data.meetings.length}</strong> meeting{data.meetings.length !== 1 ? 's' : ''},{' '}
            <strong>{unreadEmails}</strong> urgent email{unreadEmails !== 1 ? 's' : ''}, and{' '}
            <strong>{pendingApprovals}</strong> pending approval{pendingApprovals !== 1 ? 's' : ''} today.
          </p>
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className={styles.loadingGrid}>
          {[...Array(6)].map((_, i) => (
            <div key={i} className={styles.skeletonCard} />
          ))}
        </div>
      ) : (
        <div className={styles.grid}>
          <MeetingsCard meetings={data.meetings} onRefresh={fetchAll} activeDirectorId={activeDirectorId} />
          <UrgentEmailsCard emails={data.emails} onRefresh={fetchAll} activeDirectorId={activeDirectorId} />
          <RemindersCard reminders={data.reminders} onRefresh={fetchAll} activeDirectorId={activeDirectorId} />
          <ApprovalsCard approvals={data.approvals} onRefresh={fetchAll} activeDirectorId={activeDirectorId} />
          <TravelCard travel={data.travel} onRefresh={fetchAll} activeDirectorId={activeDirectorId} />
          <TaskSummaryCard tasks={data.tasks} reminders={data.reminders} meetings={data.meetings} />
        </div>
      )}
    </div>
  );
};

export default Dashboard;
