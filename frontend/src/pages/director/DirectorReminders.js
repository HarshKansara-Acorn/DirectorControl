import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { Bell, AlertTriangle } from 'lucide-react';
import styles from './DirectorReminders.module.css';

const PRIORITY = {
  high:   { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444', label: 'High' },
  medium: { bg: '#fff7ed', color: '#d97706', dot: '#f59e0b', label: 'Medium' },
  low:    { bg: '#f0fdf4', color: '#15803d', dot: '#22c55e', label: 'Low' },
};

const DirectorReminders = () => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('all'); // all | active | overdue

  const fetchReminders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/reminders');
      setReminders(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchReminders(); }, [fetchReminders]);

  const today = new Date().toISOString().split('T')[0];

  const filtered = reminders.filter(r => {
    if (filter === 'active') return r.isActive;
    if (filter === 'overdue') return r.dueDate && r.dueDate < today && r.isActive;
    return true;
  });

  const activeCount  = reminders.filter(r => r.isActive).length;
  const overdueCount = reminders.filter(r => r.dueDate && r.dueDate < today && r.isActive).length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Reminders</h1>
          <p className={styles.subtitle}>
            {activeCount} active · {overdueCount > 0 ? <span style={{ color: '#dc2626' }}>{overdueCount} overdue</span> : '0 overdue'}
          </p>
        </div>
        <div className={styles.filters}>
          {['all', 'active', 'overdue'].map(f => (
            <button
              key={f}
              className={`${styles.filterBtn} ${filter === f ? styles.filterBtnActive : ''}`}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className={styles.skeletonList}>
          {[...Array(4)].map((_, i) => <div key={i} className={styles.skeletonItem} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <Bell size={40} color="var(--text-disabled)" />
          <p className={styles.emptyTitle}>No reminders found</p>
          <p className={styles.emptyText}>Your PA will add reminders here when needed</p>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map(r => {
            const p = PRIORITY[r.priority] || PRIORITY.medium;
            const isOverdue = r.dueDate && r.dueDate < today;
            const daysUntil = r.dueDate
              ? Math.ceil((new Date(r.dueDate) - new Date()) / (1000 * 60 * 60 * 24))
              : null;

            return (
              <div
                key={r.id}
                className={`${styles.card} ${isOverdue ? styles.cardOverdue : ''} ${!r.isActive ? styles.cardInactive : ''}`}
              >
                <div className={styles.cardLeft}>
                  <div className={styles.dot} style={{ background: p.dot }} />
                </div>
                <div className={styles.cardContent}>
                  <div className={styles.cardHeader}>
                    <h3 className={styles.cardTitle}>{r.title}</h3>
                    <div className={styles.badges}>
                      <span className={styles.priorityBadge} style={{ background: p.bg, color: p.color }}>
                        {p.label}
                      </span>
                      {!r.isActive && (
                        <span className={styles.inactiveBadge}>Inactive</span>
                      )}
                    </div>
                  </div>

                  {r.description && (
                    <p className={styles.cardDesc}>{r.description}</p>
                  )}

                  {r.dueDate && (
                    <div className={`${styles.dueRow} ${isOverdue ? styles.dueRowOverdue : ''}`}>
                      {isOverdue ? (
                        <><AlertTriangle size={13} /> Overdue since {new Date(r.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</>
                      ) : daysUntil === 0 ? (
                        <><Bell size={13} /> Due today</>
                      ) : daysUntil === 1 ? (
                        <><Bell size={13} /> Due tomorrow</>
                      ) : (
                        <>📅 Due {new Date(r.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })} · {daysUntil} days</>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DirectorReminders;
