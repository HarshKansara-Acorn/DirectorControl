import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import { CheckSquare, Bell, Clock, AlertCircle, ChevronRight, CheckCircle2 } from 'lucide-react';
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

const DirectorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [tasks, setTasks]         = useState([]);
  const [reminders, setReminders] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading]     = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, r, a] = await Promise.all([
        api.get('/tasks'),
        api.get('/reminders'),
        api.get('/approvals'),
      ]);
      setTasks(t.data);
      setReminders(r.data);
      setApprovals(a.data);
    } catch (err) {
      console.error('Failed to load director dashboard:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = new Date().toISOString().split('T')[0];
  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Derived counts
  const pendingTasks    = tasks.filter(t => t.status !== 'done');
  const overdueTasks    = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done');
  const dueTodayTasks   = tasks.filter(t => t.dueDate === today && t.status !== 'done');
  const activeReminders = reminders.filter(r => r.isActive);
  const pendingApprovals = approvals.filter(a => a.status === 'pending');
  const recentApprovals  = approvals.filter(a => a.status !== 'pending').slice(0, 3);

  const handleApprovalAction = async (id, action) => {
    try {
      await api.patch(`/approvals/${id}/action`, { action });
      fetchData();
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
          {[...Array(3)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <p className={styles.dateStr}>{dateStr}</p>
          <h1 className={styles.greeting}>{greeting()}, {user?.name?.split(' ')[0]}</h1>
          <p className={styles.summary}>
            You have{' '}
            <strong>{pendingTasks.length}</strong> pending task{pendingTasks.length !== 1 ? 's' : ''},{' '}
            <strong>{activeReminders.length}</strong> active reminder{activeReminders.length !== 1 ? 's' : ''}, and{' '}
            <strong>{pendingApprovals.length}</strong> approval{pendingApprovals.length !== 1 ? 's' : ''} waiting.
          </p>
        </div>
      </div>

      {/* Stats Row */}
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
      </div>

      {/* Main Grid */}
      <div className={styles.grid}>

        {/* Pending Approvals */}
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
              {pendingApprovals.map(a => (
                <div key={a.id} className={styles.approvalCard}>
                  <div className={styles.approvalInfo}>
                    <div className={styles.approvalTitle}>{a.title}</div>
                    <div className={styles.approvalMeta}>
                      {a.fromName && <span>From: {a.fromName}</span>}
                      {a.dueDate && <span>Due: {new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>}
                      <span className={styles.approvalType}>{a.type}</span>
                    </div>
                    {a.description && <p className={styles.approvalDesc}>{a.description}</p>}
                  </div>
                  <div className={styles.approvalActions}>
                    <button className={styles.approveBtn} onClick={() => handleApprovalAction(a.id, 'approved')}>
                      ✓ Approve
                    </button>
                    <button className={styles.rejectBtn} onClick={() => handleApprovalAction(a.id, 'rejected')}>
                      ✕ Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Reminders */}
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
                      {r.description && <div className={styles.reminderDesc}>{r.description}</div>}
                      {r.dueDate && (
                        <div className={`${styles.reminderDue} ${isOverdue ? styles.reminderDueOverdue : ''}`}>
                          📅 {isOverdue ? 'Overdue · ' : ''}
                          {new Date(r.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                    <span className={styles.priorityBadge} style={{ background: p.bg, color: p.color }}>
                      {p.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* My Tasks — Priority view */}
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
                <span>Task</span>
                <span>Priority</span>
                <span>Status</span>
                <span>Due Date</span>
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
                    <span className={styles.priorityBadge} style={{ background: p.bg, color: p.color }}>
                      {p.label}
                    </span>
                    <span className={styles.statusBadge} style={{ background: s.bg, color: s.color }}>
                      {s.label}
                    </span>
                    <span className={`${styles.dueDate} ${isOverdue ? styles.dueDateOverdue : ''}`}>
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
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
