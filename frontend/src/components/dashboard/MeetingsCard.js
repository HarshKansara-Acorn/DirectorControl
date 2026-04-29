import React, { useState, useEffect, useCallback } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddMeetingModal from '../modals/AddMeetingModal';
import ItemDetailModal from './ItemDetailModal';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import styles from './CardItems.module.css';

const MeetingsCard = ({ meetings, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showAddModal, setShowAddModal]   = useState(false);
  const [selectedItem, setSelectedItem]   = useState(null);
  const [showHistory, setShowHistory]     = useState(false);
  const [pastMeetings, setPastMeetings]   = useState([]);
  const [loadingPast, setLoadingPast]     = useState(false);

  const today = new Date().toISOString().split('T')[0];

  // Fetch past meetings when History tab is opened
  const fetchPastMeetings = useCallback(async () => {
    if (!activeDirectorId) return;
    setLoadingPast(true);
    try {
      // Fetch all meetings (no date filter) and filter client-side for past
      const res = await api.get('/meetings', { params: { directorId: activeDirectorId } });
      const past = res.data.filter(m => m.date && m.date < today);
      // Sort most recent first
      past.sort((a, b) => b.date.localeCompare(a.date));
      setPastMeetings(past);
    } catch (err) { console.error(err); }
    finally { setLoadingPast(false); }
  }, [activeDirectorId, today]);

  useEffect(() => {
    if (showHistory) fetchPastMeetings();
  }, [showHistory, fetchPastMeetings]);

  const displayed = showHistory ? pastMeetings : meetings;

  return (
    <>
      <DashboardCard
        icon="📅"
        title="Meetings"
        badge={showHistory ? `${pastMeetings.length} past` : `${meetings.length} today`}
        badgeColor={showHistory ? 'gray' : (meetings.length > 0 ? 'blue' : 'gray')}
        onAdd={isAdmin && !showHistory ? () => setShowAddModal(true) : null}
        addLabel="Add Meeting"
      >
        {/* Today / History toggle */}
        <div className={styles.historyToggle}>
          <button
            className={`${styles.toggleBtn} ${!showHistory ? styles.toggleBtnActive : ''}`}
            onClick={() => setShowHistory(false)}
          >
            Today {meetings.length > 0 && <span className={styles.toggleCount}>{meetings.length}</span>}
          </button>
          <button
            className={`${styles.toggleBtn} ${showHistory ? styles.toggleBtnActive : ''}`}
            onClick={() => setShowHistory(true)}
          >
            History {pastMeetings.length > 0 && <span className={styles.toggleCount}>{pastMeetings.length}</span>}
          </button>
        </div>

        {loadingPast ? (
          <div className={styles.historyLoading}>Loading past meetings...</div>
        ) : displayed.length === 0 ? (
          <EmptyState message={showHistory ? 'No past meetings' : 'No meetings today'} />
        ) : (
          <div className={styles.list}>
            {displayed.map(m => (
              <div
                key={m.id}
                className={`${styles.item} ${styles.itemClickable} ${showHistory ? styles.itemDone : ''}`}
                onClick={() => setSelectedItem(m)}
                role="button" tabIndex={0}
                onKeyDown={e => e.key === 'Enter' && setSelectedItem(m)}
              >
                <div className={styles.itemLeft}>
                  <div className={styles.timeTag} style={{ opacity: showHistory ? 0.7 : 1 }}>
                    {showHistory
                      ? new Date(m.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                      : m.time
                    }
                  </div>
                  <div>
                    <div className={styles.itemTitle} style={{ opacity: showHistory ? 0.7 : 1 }}>
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
