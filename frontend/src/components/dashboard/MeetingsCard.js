import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddMeetingModal from '../modals/AddMeetingModal';
import { useAuth } from '../../context/AuthContext';
import styles from './CardItems.module.css';

const MeetingsCard = ({ meetings, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <DashboardCard
        icon="📅"
        title="Today's Meetings"
        badge={`${meetings.length} today`}
        badgeColor={meetings.length > 0 ? 'blue' : 'gray'}
        onAdd={isAdmin ? () => setShowModal(true) : null}
        addLabel="Add Meeting"
      >
        {meetings.length === 0 ? (
          <EmptyState message="No meetings today" />
        ) : (
          <div className={styles.list}>
            {meetings.map(m => (
              <div key={m.id} className={styles.item}>
                <div className={styles.itemLeft}>
                  <div className={styles.timeTag}>{m.time}</div>
                  <div>
                    <div className={styles.itemTitle}>{m.title}</div>
                    <div className={styles.itemSub}>{m.location || 'No location'}</div>
                  </div>
                </div>
                <div className={styles.durationTag}>{m.duration}m</div>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      {showModal && (
        <AddMeetingModal
          directorId={activeDirectorId}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); onRefresh(); }}
        />
      )}
    </>
  );
};

export default MeetingsCard;
