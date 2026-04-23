import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddReminderModal from '../modals/AddReminderModal';
import { useAuth } from '../../context/AuthContext';
import styles from './CardItems.module.css';

const priorityColors = { high: 'red', medium: 'orange', low: 'green' };
const priorityLabels = { high: '🔴', medium: '🟡', low: '🟢' };

const RemindersCard = ({ reminders, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const active = reminders.filter(r => r.isActive).length;

  return (
    <>
      <DashboardCard
        icon="🔔"
        title="Key Reminders"
        badge={`${active} active`}
        badgeColor={active > 0 ? 'orange' : 'gray'}
        onAdd={isAdmin ? () => setShowModal(true) : null}
        addLabel="Add Reminder"
      >
        {reminders.length === 0 ? (
          <EmptyState message="No reminders" />
        ) : (
          <div className={styles.list}>
            {reminders.map(r => (
              <div key={r.id} className={styles.item}>
                <div className={styles.itemLeft}>
                  <span className={styles.priorityIcon}>{priorityLabels[r.priority] || '🟡'}</span>
                  <div>
                    <div className={styles.itemTitle}>{r.title}</div>
                    {r.dueDate && (
                      <div className={styles.itemSub}>Due: {new Date(r.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      {showModal && (
        <AddReminderModal
          directorId={activeDirectorId}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); onRefresh(); }}
        />
      )}
    </>
  );
};

export default RemindersCard;
