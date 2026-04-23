import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddEmailModal from '../modals/AddEmailModal';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import styles from './CardItems.module.css';

const UrgentEmailsCard = ({ emails, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/emails/${id}/read`);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const unread = emails.filter(e => !e.isRead).length;

  return (
    <>
      <DashboardCard
        icon="📧"
        title="Urgent Emails"
        badge={unread > 0 ? `${unread} unread` : '0 unread'}
        badgeColor={unread > 0 ? 'red' : 'gray'}
        onAdd={isAdmin ? () => setShowModal(true) : null}
        addLabel="Add Urgent Email"
      >
        {emails.length === 0 ? (
          <EmptyState message="No urgent emails" />
        ) : (
          <div className={styles.list}>
            {emails.map(e => (
              <div key={e.id} className={`${styles.item} ${!e.isRead ? styles.itemUnread : ''}`}>
                <div className={styles.itemLeft}>
                  <div className={styles.emailDot} />
                  <div>
                    <div className={styles.itemTitle}>{e.subject}</div>
                    <div className={styles.itemSub}>From: {e.fromName || e.from}</div>
                  </div>
                </div>
                {!e.isRead && (
                  <button className={styles.readBtn} onClick={() => handleMarkRead(e.id)}>
                    Mark read
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      {showModal && (
        <AddEmailModal
          directorId={activeDirectorId}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); onRefresh(); }}
        />
      )}
    </>
  );
};

export default UrgentEmailsCard;
