import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddTravelModal from '../modals/AddTravelModal';
import { useAuth } from '../../context/AuthContext';
import styles from './CardItems.module.css';

const TravelCard = ({ travel, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showModal, setShowModal] = useState(false);
  const upcoming = travel.filter(t => t.status === 'upcoming').length;

  return (
    <>
      <DashboardCard
        icon="✈️"
        title="Travel Reminders"
        badge={`${upcoming} upcoming`}
        badgeColor={upcoming > 0 ? 'blue' : 'gray'}
        onAdd={isAdmin ? () => setShowModal(true) : null}
        addLabel="Add Travel"
      >
        {travel.length === 0 ? (
          <EmptyState message="No upcoming travel" />
        ) : (
          <div className={styles.list}>
            {travel.map(t => (
              <div key={t.id} className={styles.item}>
                <div className={styles.itemLeft}>
                  <div className={styles.travelFlag}>✈️</div>
                  <div>
                    <div className={styles.itemTitle}>{t.destination}</div>
                    <div className={styles.itemSub}>{t.purpose}</div>
                    <div className={styles.itemSub}>
                      {new Date(t.departureDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      {t.returnDate && ` → ${new Date(t.returnDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                    </div>
                  </div>
                </div>
                <span className={styles.statusBadge}>{t.status}</span>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      {showModal && (
        <AddTravelModal
          directorId={activeDirectorId}
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); onRefresh(); }}
        />
      )}
    </>
  );
};

export default TravelCard;
