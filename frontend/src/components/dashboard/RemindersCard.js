import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddReminderModal from '../modals/AddReminderModal';
import EditReminderModal from '../modals/EditReminderModal';
import ItemDetailModal from './ItemDetailModal';
import { useAuth } from '../../context/AuthContext';
import styles from './CardItems.module.css';

const priorityLabels = { high: '🔴', medium: '🟡', low: '🟢' };

const RemindersCard = ({ reminders, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem]         = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showHistory, setShowHistory]   = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Active: isActive=true AND (no dueDate OR dueDate >= today)
  // History: isActive=false OR dueDate < today (already passed)
  const active  = reminders.filter(r => r.isActive && (!r.dueDate || r.dueDate >= today));
  const history = reminders.filter(r => !r.isActive || (r.dueDate && r.dueDate < today));
  const displayed = showHistory ? history : active;

  return (
    <>
      <DashboardCard
        icon="🔔"
        title="Key Reminders"
        badge={showHistory ? `${history.length} past` : `${active.length} active`}
        badgeColor={showHistory ? 'gray' : (active.length > 0 ? 'orange' : 'gray')}
        onAdd={isAdmin && !showHistory ? () => setShowAddModal(true) : null}
        addLabel="Add Reminder"
      >
        {/* Active / History toggle */}
        <div className={styles.historyToggle}>
          <button
            className={`${styles.toggleBtn} ${!showHistory ? styles.toggleBtnActive : ''}`}
            onClick={() => setShowHistory(false)}
          >
            Active {active.length > 0 && <span className={styles.toggleCount}>{active.length}</span>}
          </button>
          <button
            className={`${styles.toggleBtn} ${showHistory ? styles.toggleBtnActive : ''}`}
            onClick={() => setShowHistory(true)}
          >
            History {history.length > 0 && <span className={styles.toggleCount}>{history.length}</span>}
          </button>
        </div>

        {displayed.length === 0 ? (
          <EmptyState message={showHistory ? 'No past reminders' : 'No active reminders'} />
        ) : (
          <div className={styles.list}>
            {displayed.map(r => {
              const isOverdue = r.dueDate && r.dueDate < today;
              const isDone    = !r.isActive;
              return (
                <div
                  key={r.id}
                  className={`${styles.item} ${styles.itemClickable} ${isDone ? styles.itemDone : ''}`}
                  onClick={() => setSelectedItem(r)}
                  role="button" tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setSelectedItem(r)}
                >
                  <div className={styles.itemLeft}>
                    <span className={styles.priorityIcon}>
                      {isDone ? '✅' : (isOverdue ? '⚠️' : (priorityLabels[r.priority] || '🟡'))}
                    </span>
                    <div>
                      <div className={styles.itemTitle} style={{ textDecoration: isDone ? 'line-through' : 'none', opacity: isDone ? 0.6 : 1 }}>
                        {r.title}
                      </div>
                      {r.dueDate && (
                        <div className={styles.itemSub} style={{ color: isOverdue && !isDone ? '#dc2626' : undefined }}>
                          {isOverdue && !isDone ? '⚠️ Overdue · ' : 'Due: '}
                          {new Date(r.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={styles.itemActions} onClick={e => e.stopPropagation()}>
                    {isAdmin && r.isActive && (
                      <button className={styles.editIconBtn} onClick={() => setEditItem(r)} title="Edit">✏️</button>
                    )}
                    <span className={styles.chevron}>›</span>
                  </div>
                </div>
              );
            })}
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
      {editItem && (
        <EditReminderModal
          reminder={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => { setEditItem(null); onRefresh(); }}
        />
      )}
      {selectedItem && !editItem && (
        <ItemDetailModal
          item={selectedItem}
          type="reminder"
          onClose={() => setSelectedItem(null)}
          onEdit={isAdmin && selectedItem.isActive ? () => { setEditItem(selectedItem); setSelectedItem(null); } : null}
        />
      )}
    </>
  );
};

export default RemindersCard;
