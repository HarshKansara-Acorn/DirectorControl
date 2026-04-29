import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddTravelModal from '../modals/AddTravelModal';
import ItemDetailModal from './ItemDetailModal';
import { useAuth } from '../../context/AuthContext';
import styles from './CardItems.module.css';

const STATUS_STYLES = {
  upcoming:  { bg: '#eff6ff', color: '#1e40af', label: 'Upcoming' },
  ongoing:   { bg: '#f0fdf4', color: '#15803d', label: 'Ongoing' },
  completed: { bg: '#f8fafc', color: '#64748b', label: 'Completed' },
  cancelled: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelled' },
};

const ACTIVE_STATUSES   = ['upcoming', 'ongoing'];
const HISTORY_STATUSES  = ['completed', 'cancelled'];

const TravelCard = ({ travel, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [showHistory, setShowHistory]   = useState(false);

  const active  = travel.filter(t => ACTIVE_STATUSES.includes(t.status));
  const history = travel.filter(t => HISTORY_STATUSES.includes(t.status));
  const displayed = showHistory ? history : active;

  return (
    <>
      <DashboardCard
        icon="✈️"
        title="Travel Reminders"
        badge={showHistory ? `${history.length} past` : `${active.length} upcoming`}
        badgeColor={showHistory ? 'gray' : (active.length > 0 ? 'blue' : 'gray')}
        onAdd={isAdmin && !showHistory ? () => setShowAddModal(true) : null}
        addLabel="Add Travel"
      >
        {/* Active / History toggle */}
        <div className={styles.historyToggle}>
          <button
            className={`${styles.toggleBtn} ${!showHistory ? styles.toggleBtnActive : ''}`}
            onClick={() => setShowHistory(false)}
          >
            Upcoming {active.length > 0 && <span className={styles.toggleCount}>{active.length}</span>}
          </button>
          <button
            className={`${styles.toggleBtn} ${showHistory ? styles.toggleBtnActive : ''}`}
            onClick={() => setShowHistory(true)}
          >
            History {history.length > 0 && <span className={styles.toggleCount}>{history.length}</span>}
          </button>
        </div>

        {displayed.length === 0 ? (
          <EmptyState message={showHistory ? 'No past travel' : 'No upcoming travel'} />
        ) : (
          <div className={styles.list}>
            {displayed.map(t => {
              const ss = STATUS_STYLES[t.status] || STATUS_STYLES.upcoming;
              return (
                <div
                  key={t.id}
                  className={`${styles.item} ${styles.itemClickable} ${HISTORY_STATUSES.includes(t.status) ? styles.itemDone : ''}`}
                  onClick={() => setSelectedItem(t)}
                  role="button" tabIndex={0}
                  onKeyDown={e => e.key === 'Enter' && setSelectedItem(t)}
                >
                  <div className={styles.itemLeft}>
                    <div className={styles.travelFlag}>✈️</div>
                    <div>
                      <div className={styles.itemTitle} style={{ opacity: HISTORY_STATUSES.includes(t.status) ? 0.7 : 1 }}>
                        {t.destination}
                      </div>
                      {t.purpose && <div className={styles.itemSub}>{t.purpose}</div>}
                      <div className={styles.itemSub}>
                        {new Date(t.departureDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {t.returnDate && ` → ${new Date(t.returnDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`}
                      </div>
                    </div>
                  </div>
                  <span className={styles.statusPill} style={{ background: ss.bg, color: ss.color }}>
                    {ss.label}
                  </span>
                </div>
              );
            })}
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
