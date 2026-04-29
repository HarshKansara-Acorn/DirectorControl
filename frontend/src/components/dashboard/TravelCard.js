import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddTravelModal from '../modals/AddTravelModal';
import ItemDetailModal from './ItemDetailModal';
import { useAuth } from '../../context/AuthContext';
import styles from './CardItems.module.css';

const TravelCard = ({ travel, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const upcoming = travel.filter(t => t.status === 'upcoming').length;

  return (
    <>
      <DashboardCard
        icon="✈️"
        title="Travel Reminders"
        badge={`${upcoming} upcoming`}
        badgeColor={upcoming > 0 ? 'blue' : 'gray'}
        onAdd={isAdmin ? () => setShowAddModal(true) : null}
        addLabel="Add Travel"
      >
        {travel.length === 0 ? (
          <EmptyState message="No upcoming travel" />
        ) : (
          <div className={styles.list}>
            {travel.map(t => (
              <div
                key={t.id}
                className={`${styles.item} ${styles.itemClickable}`}
                onClick={() => setSelectedItem(t)}
                role="button"
                tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelectedItem(t)}
                title="Click to view details"
              >
                <div className={styles.itemLeft}>
                  <div className={styles.travelFlag}>✈️</div>
                  <div>
                    <div className={styles.itemTitle}>{t.destination}</div>
                    {t.purpose && <div className={styles.itemSub}>{t.purpose}</div>}
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

      {showAddModal && (
        <AddTravelModal
          directorId={activeDirectorId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); onRefresh(); }}
        />
      )}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          type="travel"
          onClose={() => setSelectedItem(null)}
        />
      )}
    </>
  );
};

export default TravelCard;
