import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddApprovalModal from '../modals/AddApprovalModal';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import styles from './CardItems.module.css';

const ApprovalsCard = ({ approvals, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const pending = approvals.filter(a => a.status === 'pending');

  const handleAction = async (id, action) => {
    try {
      await api.patch(`/approvals/${id}/action`, { action });
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
        onAdd={isAdmin ? () => setShowModal(true) : null}
        addLabel="Add Approval"
      >
        {pending.length === 0 ? (
          <EmptyState message="No pending approvals" />
        ) : (
          <div className={styles.list}>
            {pending.map(a => (
              <div key={a.id} className={styles.approvalItem}>
                <div className={styles.approvalHeader}>
                  <div className={styles.approvalIcon}>📋</div>
                  <div className={styles.approvalInfo}>
                    <div className={styles.itemTitle}>{a.title}</div>
                    <div className={styles.itemSub}>From: {a.fromName}</div>
                    {a.dueDate && (
                      <div className={styles.itemSub}>
                        Due: {new Date(a.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </div>
                    )}
                  </div>
                  <span className={styles.priorityBadge}>{a.priority}</span>
                </div>
                <div className={styles.approvalActions}>
                  <button
                    className={styles.approveBtn}
                    onClick={() => handleAction(a.id, 'approved')}
                  >
                    ✓ Approve
                  </button>
                  <button
                    className={styles.rejectBtn}
                    onClick={() => handleAction(a.id, 'rejected')}
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      {showModal && (
        <AddApprovalModal
          directorId={activeDirectorId}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); onRefresh(); }}
        />
      )}
    </>
  );
};

export default ApprovalsCard;
