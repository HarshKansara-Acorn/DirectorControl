import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddReminderModal from '../modals/AddReminderModal';
import ItemDetailModal from './ItemDetailModal';
import { useAuth } from '../../context/AuthContext';
import styles from './CardItems.module.css';

const priorityLabels = { high: '🔴', medium: '🟡', low: '🟢' };

const RemindersCard = ({ reminders, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const active = reminders.filter(r => r.isActive).length;

  return (
    <>
      <DashboardCard
        icon="🔔"
        title="Key Reminders"
        badge={`${active} active`}
        badgeColor={active > 0 ? 'orange' : 'gray'}
        onAdd={isAdmin ? () => setShowAddModal(true) : null}
        addLabel="Add Reminder"
      >
        {reminders.length === 0 ? (
          <EmptyState message="No reminders" />
        ) : (
          <div className={styles.list}>
            {reminders.map(r => (
              <div
                key={r.id}
                className={`${styles.item} ${styles.itemClickable}`}
                onClick={() => setSelectedItem(r)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelectedItem(r)}
                title="Click to view details"
              >
                <div className={styles.itemLeft}>
                  <span className={styles.priorityIcon}>{priorityLabels[r.priority] || '🟡'}</span>
                  <div>
                    <div className={styles.itemTitle}>{r.title}</div>
                    {r.dueDate && (
                      <div className={styles.itemSub}>
                        Due: {new Date(r.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                  </div>
                </div>
                <span className={styles.chevron}>›</span>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      {showAddModal && (
        <AddReminderModal
          directorId={activeDirectorId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); onRefresh(); }}
        />
      )}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          type="reminder"
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
};

export default RemindersCard;
