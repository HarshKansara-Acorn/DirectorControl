import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddApprovalModal from '../modals/AddApprovalModal';
import EditApprovalModal from '../modals/EditApprovalModal';
import ItemDetailModal from './ItemDetailModal';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import styles from './CardItems.module.css';

const STATUS_STYLES = {
  pending:  { bg: '#fff7ed', color: '#c2410c', label: 'Pending',  icon: '⏳' },
  approved: { bg: '#f0fdf4', color: '#15803d', label: 'Approved', icon: '✅' },
  rejected: { bg: '#fef2f2', color: '#dc2626', label: 'Rejected', icon: '❌' },
};

const ApprovalsCard = ({ approvals, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem]         = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showHistory, setShowHistory]   = useState(false);

  const pending  = approvals.filter(a => a.status === 'pending');
  const history  = approvals.filter(a => a.status !== 'pending');
  const displayed = showHistory ? history : pending;

  const handleAction = async (id, action) => {
    try {
      await api.patch(`/approvals/${id}/action`, { action });
      setSelectedItem(null);
      onRefresh();
    } catch (err) { console.error(err); }
  };

  return (
    <>
      <DashboardCard
        icon="✅"
        title="Pending Approvals"
        badge={showHistory ? `${history.length} resolved` : `${pending.length} pending`}
        badgeColor={showHistory ? 'gray' : (pending.length > 0 ? 'orange' : 'gray')}
        onAdd={isAdmin && !showHistory ? () => setShowAddModal(true) : null}
        addLabel="Add Approval"
      >
        {/* Active / History toggle */}
        <div className={styles.historyToggle}>
          <button
            className={`${styles.toggleBtn} ${!showHistory ? styles.toggleBtnActive : ''}`}
            onClick={() => setShowHistory(false)}
          >
            Active {pending.length > 0 && <span className={styles.toggleCount}>{pending.length}</span>}
          </button>
          <button
            className={`${styles.toggleBtn} ${showHistory ? styles.toggleBtnActive : ''}`}
            onClick={() => setShowHistory(true)}
          >
            History {history.length > 0 && <span className={styles.toggleCount}>{history.length}</span>}
          </button>
        </div>

        {displayed.length === 0 ? (
          <EmptyState message={showHistory ? 'No resolved approvals yet' : 'No pending approvals'} />
        ) : (
          <div className={styles.list}>
            {displayed.map(a => {
              const ss = STATUS_STYLES[a.status] || STATUS_STYLES.pending;
              return (
                <div
                  key={a.id}
                  className={`${styles.approvalItem} ${styles.approvalItemClickable}`}
                  onClick={() => setSelectedItem(a)}
                  role="button" tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setSelectedItem(a)}
                >
                  <div className={styles.approvalHeader}>
                    <div className={styles.approvalIcon}>{ss.icon}</div>
                    <div className={styles.approvalInfo}>
                      <div className={styles.itemTitle}>{a.title}</div>
                      {a.fromName && <div className={styles.itemSub}>From: {a.fromName}</div>}
                      {a.dueDate && (
                        <div className={styles.itemSub}>
                          Due: {new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        </div>
                      )}
                    </div>
                    <div className={styles.itemActions} onClick={e => e.stopPropagation()}>
                      {isAdmin && a.status === 'pending' && (
                        <button className={styles.editIconBtn} onClick={() => setEditItem(a)} title="Edit">✏️</button>
                      )}
                      <span
                        className={styles.statusPill}
                        style={{ background: ss.bg, color: ss.color }}
                      >
                        {ss.label}
                      </span>
                    </div>
                  </div>

                  {/* Approve/Reject only for pending */}
                  {a.status === 'pending' && (
                    <div className={styles.approvalActions} onClick={e => e.stopPropagation()}>
                      <button className={styles.approveBtn} onClick={() => handleAction(a.id, 'approved')}>
                        ✓ Approve
                      </button>
                      <button className={styles.rejectBtn} onClick={() => handleAction(a.id, 'rejected')}>
                        ✕ Reject
                      </button>
                    </div>
                  )}

                  {/* Resolved: show action date */}
                  {a.status !== 'pending' && a.actionAt && (
                    <div className={styles.resolvedRow}>
                      {ss.icon} {ss.label} on {new Date(a.actionAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {a.remarks && <span className={styles.remarks}> · {a.remarks}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </DashboardCard>

      {showAddModal && (
        <AddApprovalModal
          directorId={activeDirectorId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); onRefresh(); }}
        />
      )}
      {editItem && (
        <EditApprovalModal
          approval={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => { setEditItem(null); onRefresh(); }}
        />
      )}
      {selectedItem && !editItem && (
        <ItemDetailModal
          item={selectedItem}
          type="approval"
          onClose={() => setSelectedItem(null)}
          onAction={selectedItem.status === 'pending' ? handleAction : null}
          onEdit={isAdmin && selectedItem.status === 'pending' ? () => { setEditItem(selectedItem); setSelectedItem(null); } : null}
        />
      )}
    </>
  );
};

export default ApprovalsCard;
