import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddMeetingModal from '../modals/AddMeetingModal';
import ItemDetailModal from './ItemDetailModal';
import { useAuth } from '../../context/AuthContext';
import styles from './CardItems.module.css';

const MeetingsCard = ({ meetings, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);

  return (
    <>
      <DashboardCard
        icon="📅"
        title="Today's Meetings"
        badge={`${meetings.length} today`}
        badgeColor={meetings.length > 0 ? 'blue' : 'gray'}
        onAdd={isAdmin ? () => setShowAddModal(true) : null}
        addLabel="Add Meeting"
      >
        {meetings.length === 0 ? (
          <EmptyState message="No meetings today" />
        ) : (
          <div className={styles.list}>
            {meetings.map(m => (
              <div
                key={m.id}
                className={`${styles.item} ${styles.itemClickable}`}
                onClick={() => setSelectedItem(m)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelectedItem(m)}
                title="Click to view details"
              >
                <div className={styles.itemLeft}>
                  <div className={styles.timeTag}>{m.time}</div>
                  <div>
                    <div className={styles.itemTitle}>
                      {m.isShared && (
                        <span style={{ fontSize: 10, background: '#eff6ff', color: '#1e40af', padding: '1px 5px', borderRadius: 6, marginRight: 5, fontWeight: 700 }}>
                          👥 All
                        </span>
                      )}
                      {m.title}
                    </div>
                    <div className={styles.itemSub}>{m.location || 'No location'}</div>
                  </div>
                </div>
                <div className={styles.durationTag}>{m.duration}m</div>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      {showAddModal && (
        <AddMeetingModal
          directorId={activeDirectorId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); onRefresh(); }}
        />
      )}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          type="meeting"
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
};

export default MeetingsCard;
