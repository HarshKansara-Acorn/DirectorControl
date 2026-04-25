import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { CheckCircle2, XCircle, Clock, Filter } from 'lucide-react';
import styles from './DirectorApprovals.module.css';

const STATUS_STYLES = {
  pending:  { bg: '#fff7ed', color: '#c2410c', icon: '⏳', label: 'Pending' },
  approved: { bg: '#f0fdf4', color: '#15803d', icon: '✅', label: 'Approved' },
  rejected: { bg: '#fef2f2', color: '#dc2626', icon: '❌', label: 'Rejected' },
};

const TYPE_LABELS = {
  leave:    '🏖️ Leave',
  expense:  '💰 Expense',
  document: '📄 Document',
  general:  '📋 General',
};

const DirectorApprovals = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [filter, setFilter]       = useState('pending');
  const [acting, setActing]       = useState(null); // id being acted on

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/approvals');
      setApprovals(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  const handleAction = async (id, action) => {
    setActing(id);
    try {
      await api.patch(`/approvals/${id}/action`, { action });
      fetchApprovals();
    } catch (err) { console.error(err); }
    finally { setActing(null); }
  };

  const filtered = approvals.filter(a => filter === 'all' || a.status === filter);
  const pendingCount  = approvals.filter(a => a.status === 'pending').length;
  const approvedCount = approvals.filter(a => a.status === 'approved').length;
  const rejectedCount = approvals.filter(a => a.status === 'rejected').length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Approvals</h1>
          <p className={styles.subtitle}>
            {pendingCount} pending · {approvedCount} approved · {rejectedCount} rejected
          </p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className={styles.tabs}>
        {[
          { key: 'pending',  label: 'Pending',  count: pendingCount },
          { key: 'approved', label: 'Approved', count: approvedCount },
          { key: 'rejected', label: 'Rejected', count: rejectedCount },
          { key: 'all',      label: 'All',      count: approvals.length },
        ].map(({ key, label, count }) => (
          <button
            key={key}
            className={`${styles.tab} ${filter === key ? styles.tabActive : ''}`}
            onClick={() => setFilter(key)}
          >
            {label}
            <span className={`${styles.tabCount} ${filter === key ? styles.tabCountActive : ''}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className={styles.skeletonList}>
          {[...Array(3)].map((_, i) => <div key={i} className={styles.skeletonItem} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.empty}>
          <CheckCircle2 size={40} color="var(--text-disabled)" />
          <p className={styles.emptyTitle}>
            {filter === 'pending' ? 'No pending approvals' : `No ${filter} approvals`}
          </p>
          <p className={styles.emptyText}>
            {filter === 'pending' ? 'Your PA will submit approvals here when needed' : 'Nothing to show here'}
          </p>
        </div>
      ) : (
        <div className={styles.list}>
          {filtered.map(a => {
            const s = STATUS_STYLES[a.status] || STATUS_STYLES.pending;
            return (
              <div key={a.id} className={`${styles.card} ${a.status === 'pending' ? styles.cardPending : ''}`}>
                {/* Card Header */}
                <div className={styles.cardTop}>
                  <div className={styles.cardLeft}>
                    <span className={styles.typeLabel}>{TYPE_LABELS[a.type] || '📋 ' + a.type}</span>
                    <h3 className={styles.cardTitle}>{a.title}</h3>
                  </div>
                  <span className={styles.statusBadge} style={{ background: s.bg, color: s.color }}>
                    {s.icon} {s.label}
                  </span>
                </div>

                {/* Meta */}
                <div className={styles.cardMeta}>
                  {a.fromName && (
                    <span className={styles.metaChip}>👤 {a.fromName}</span>
                  )}
                  {a.fromEmail && (
                    <span className={styles.metaChip}>✉️ {a.fromEmail}</span>
                  )}
                  {a.dueDate && (
                    <span className={styles.metaChip}>
                      📅 Due {new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  )}
                  <span className={styles.metaChip}>
                    🕐 {new Date(a.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </div>

                {/* Description */}
                {a.description && (
                  <p className={styles.cardDesc}>{a.description}</p>
                )}

                {/* Remarks (if actioned) */}
                {a.remarks && (
                  <div className={styles.remarks}>
                    <span className={styles.remarksLabel}>Remarks:</span> {a.remarks}
                  </div>
                )}

                {/* Action Buttons — only for pending */}
                {a.status === 'pending' && (
                  <div className={styles.actions}>
                    <button
                      className={styles.approveBtn}
                      onClick={() => handleAction(a.id, 'approved')}
                      disabled={acting === a.id}
                    >
                      <CheckCircle2 size={15} />
                      {acting === a.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button
                      className={styles.rejectBtn}
                      onClick={() => handleAction(a.id, 'rejected')}
                      disabled={acting === a.id}
                    >
                      <XCircle size={15} />
                      Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DirectorApprovals;
