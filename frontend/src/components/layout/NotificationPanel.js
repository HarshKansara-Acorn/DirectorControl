import React, { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNotifications } from '../../context/NotificationContext';
import { RefreshCw } from 'lucide-react';
import styles from './NotificationPanel.module.css';

const PRIORITY_STYLES = {
  high:   { bar: '#ef4444', bg: '#fef2f2' },
  medium: { bar: '#f59e0b', bg: '#fffbeb' },
  low:    { bar: '#3b82f6', bg: '#eff6ff' },
};

const timeAgo = (isoString) => {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000);
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

const NotificationPanel = ({ onClose }) => {
  const { notifications, loading, refresh } = useNotifications();
  const navigate = useNavigate();
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleClick = (notif) => {
    navigate(notif.link);
    onClose();
  };

  const high   = notifications.filter(n => n.priority === 'high');
  const medium = notifications.filter(n => n.priority === 'medium');
  const low    = notifications.filter(n => n.priority === 'low');

  const groups = [
    { label: 'Urgent', items: high,   color: '#ef4444' },
    { label: 'Important', items: medium, color: '#f59e0b' },
    { label: 'Info', items: low,    color: '#3b82f6' },
  ].filter(g => g.items.length > 0);

  return (
    <div className={styles.panel} ref={panelRef} role="dialog" aria-label="Notifications">
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.title}>Notifications</span>
          {notifications.length > 0 && (
            <span className={styles.countBadge}>{notifications.length}</span>
          )}
        </div>
        <button
          className={styles.refreshBtn}
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh notifications"
        >
          <RefreshCw size={14} className={loading ? styles.spinning : ''} />
        </button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {loading && notifications.length === 0 ? (
          <div className={styles.loadingState}>
            {[...Array(3)].map((_, i) => (
              <div key={i} className={styles.skeletonItem} />
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon}>🎉</span>
            <p className={styles.emptyTitle}>All caught up!</p>
            <p className={styles.emptyText}>No pending notifications right now.</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={group.label} className={styles.group}>
              <div className={styles.groupLabel} style={{ color: group.color }}>
                {group.label} · {group.items.length}
              </div>
              {group.items.map(notif => {
                const ps = PRIORITY_STYLES[notif.priority];
                return (
                  <button
                    key={notif.id}
                    className={styles.notifItem}
                    style={{ background: ps.bg }}
                    onClick={() => handleClick(notif)}
                    aria-label={notif.title}
                  >
                    <div
                      className={styles.priorityBar}
                      style={{ background: ps.bar }}
                    />
                    <div className={styles.notifIcon}>{notif.icon}</div>
                    <div className={styles.notifContent}>
                      <div className={styles.notifTitle}>{notif.title}</div>
                      <div className={styles.notifMessage}>{notif.message}</div>
                    </div>
                    <div className={styles.notifTime}>{timeAgo(notif.time)}</div>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 0 && (
        <div className={styles.footer}>
          <span className={styles.footerText}>
            Notifications refresh every 2 minutes
          </span>
        </div>
      )}
    </div>
  );
};

export default NotificationPanel;
