import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import styles from './TaskSummaryCard.module.css';

const TaskSummaryCard = ({ tasks = [], reminders = [], meetings = [] }) => {
  const today = new Date().toISOString().split('T')[0];
  const [showInProgress, setShowInProgress] = useState(false);

  // ── Stat calculations ─────────────────────────────────────────────────────
  const overdue    = tasks.filter(t => t.dueDate && t.dueDate < today && t.status !== 'done').length;
  const dueToday   = tasks.filter(t => t.dueDate === today && t.status !== 'done').length;
  const completed  = tasks.filter(t => t.status === 'done').length;

  // In Progress = tasks in progress + active reminders due today or earlier + today's meetings
  const inProgressTasks    = tasks.filter(t => t.status === 'inprogress');
  const activeReminders    = reminders.filter(r => r.isActive && r.dueDate && r.dueDate <= today);
  const todayMeetings      = meetings.filter(m => m.date === today);
  const inProgressTotal    = inProgressTasks.length + activeReminders.length + todayMeetings.length;

  // ── In Progress detail items ──────────────────────────────────────────────
  const inProgressItems = [
    ...inProgressTasks.map(t => ({
      icon: '📋',
      label: t.title,
      sub: `Task · ${t.priority || 'medium'} priority`,
      color: '#7c3aed',
      bg: '#faf5ff',
    })),
    ...activeReminders.map(r => ({
      icon: '🔔',
      label: r.title,
      sub: `Reminder · due ${r.dueDate === today ? 'today' : r.dueDate}`,
      color: '#d97706',
      bg: '#fffbeb',
    })),
    ...todayMeetings.map(m => ({
      icon: '🤝',
      label: m.title,
      sub: `Meeting${m.time ? ` · ${m.time}` : ''}${m.location ? ` · ${m.location}` : ''}`,
      color: '#15803d',
      bg: '#f0fdf4',
    })),
  ];

  const stats = [
    {
      icon: '🔴',
      label: 'Overdue',
      value: overdue,
      color: overdue > 0 ? '#dc2626' : 'var(--text-primary)',
      bg: overdue > 0 ? '#fef2f2' : 'var(--bg-subtle)',
      border: overdue > 0 ? '#fecaca' : 'var(--border-subtle)',
    },
    {
      icon: '🔄',
      label: 'In Progress',
      value: inProgressTotal,
      color: inProgressTotal > 0 ? '#7c3aed' : 'var(--text-primary)',
      bg: inProgressTotal > 0 ? '#faf5ff' : 'var(--bg-subtle)',
      border: inProgressTotal > 0 ? '#ddd6fe' : 'var(--border-subtle)',
      clickable: inProgressTotal > 0,
      onClick: () => setShowInProgress(v => !v),
    },
    {
      icon: '🟡',
      label: 'Due Today',
      value: dueToday,
      color: dueToday > 0 ? '#d97706' : 'var(--text-primary)',
      bg: dueToday > 0 ? '#fffbeb' : 'var(--bg-subtle)',
      border: dueToday > 0 ? '#fde68a' : 'var(--border-subtle)',
    },
    {
      icon: '🟢',
      label: 'Completed',
      value: completed,
      color: completed > 0 ? '#15803d' : 'var(--text-primary)',
      bg: completed > 0 ? '#f0fdf4' : 'var(--bg-subtle)',
      border: completed > 0 ? '#bbf7d0' : 'var(--border-subtle)',
    },
  ];

  return (
    <DashboardCard icon="📋" title="Task Summary" badgeColor="gray">
      {/* ── 4 stat tiles ── */}
      <div className={styles.summary}>
        {stats.map((s) => (
          <button
            key={s.label}
            className={`${styles.summaryItem} ${s.clickable ? styles.summaryItemClickable : ''} ${s.label === 'In Progress' && showInProgress ? styles.summaryItemActive : ''}`}
            style={{ background: s.bg, borderColor: s.border }}
            onClick={s.onClick}
            disabled={!s.clickable}
            title={s.clickable ? `Click to see ${s.label} details` : undefined}
          >
            <div className={styles.summaryIcon}>{s.icon}</div>
            <div>
              <div className={styles.summaryLabel}>{s.label}</div>
              <div className={styles.summaryValue} style={{ color: s.color }}>{s.value}</div>
            </div>
          </button>
        ))}
      </div>

      {/* ── In Progress detail panel ── */}
      {showInProgress && inProgressItems.length > 0 && (
        <div className={styles.inProgressPanel}>
          <div className={styles.inProgressTitle}>
            Currently In Progress
            <span className={styles.inProgressCount}>{inProgressItems.length}</span>
          </div>
          <ul className={styles.inProgressList}>
            {inProgressItems.map((item, i) => (
              <li key={i} className={styles.inProgressItem}>
                <span
                  className={styles.inProgressDot}
                  style={{ background: item.color }}
                />
                <div className={styles.inProgressInfo}>
                  <span className={styles.inProgressLabel}>{item.icon} {item.label}</span>
                  <span className={styles.inProgressSub}>{item.sub}</span>
                </div>
                <span
                  className={styles.inProgressBadge}
                  style={{ background: item.bg, color: item.color }}
                >
                  {item.icon === '📋' ? 'Task' : item.icon === '🔔' ? 'Reminder' : 'Meeting'}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </DashboardCard>
  );
};

export default TaskSummaryCard;
