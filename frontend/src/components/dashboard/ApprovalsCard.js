import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddApprovalModal from '../modals/AddApprovalModal';
import ItemDetailModal from './ItemDetailModal';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import styles from './CardItems.module.css';

const ApprovalsCard = ({ approvals, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const pending = approvals.filter(a => a.status === 'pending');

  const handleAction = async (id, action) => {
    try {
      await api.patch(`/approvals/${id}/action`, { action });
      setSelectedItem(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <DashboardCard
        icon="✅"
        title="Pending Approvals"
        badge={`${pending.length} pending`}
        badgeColor={pending.length > 0 ? 'orange' : 'gray'}
        onAdd={isAdmin ? () => setShowAddModal(true) : null}
        addLabel="Add Approval"
      >
        {pending.length === 0 ? (
          <EmptyState message="No pending approvals" />
        ) : (
          <div className={styles.list}>
            {pending.map(a => (
              <div
                key={a.id}
                className={`${styles.approvalItem} ${styles.approvalItemClickable}`}
                onClick={() => setSelectedItem(a)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelectedItem(a)}
                title="Click to view details"
              >
                <div className={styles.approvalHeader}>
                  <div className={styles.approvalIcon}>📋</div>
                  <div className={styles.approvalInfo}>
                    <div className={styles.itemTitle}>{a.title}</div>
                    {a.fromName && <div className={styles.itemSub}>From: {a.fromName}</div>}
                    {a.dueDate && (
                      <div className={styles.itemSub}>
                        Due: {new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                  </div>
                  <span className={styles.priorityBadge}>{a.priority}</span>
                </div>
                <div className={styles.approvalActions} onClick={e => e.stopPropagation()}>
                  <button className={styles.approveBtn} onClick={() => handleAction(a.id, 'approved')}>
                    ✓ Approve
                  </button>
                  <button className={styles.rejectBtn} onClick={() => handleAction(a.id, 'rejected')}>
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
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

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          type="approval"
          onClose={() => setSelectedItem(null)}
          onAction={handleAction}
        />
      )}
    </>
  );
};

export default ApprovalsCard;
