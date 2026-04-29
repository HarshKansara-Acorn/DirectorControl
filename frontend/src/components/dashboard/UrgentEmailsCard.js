import React, { useState } from 'react';
import DashboardCard from './DashboardCard';
import EmptyState from './EmptyState';
import AddEmailModal from '../modals/AddEmailModal';
import EditEmailModal from '../modals/EditEmailModal';
import ItemDetailModal from './ItemDetailModal';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import styles from './CardItems.module.css';

// ── Email detail content (used inside ItemDetailModal via type='email') ───────
// We add 'email' as a supported type in ItemDetailModal below.
// For now UrgentEmailsCard manages its own detail inline.

const UrgentEmailsCard = ({ emails, onRefresh, activeDirectorId }) => {
  const { isAdmin } = useAuth();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editItem, setEditItem]         = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);
  const unread = emails.filter(e => !e.isRead).length;

  const handleMarkRead = async (id) => {
    try {
      await api.patch(`/emails/${id}/read`);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <>
      <DashboardCard
        icon="📧"
        title="Urgent Emails"
        badge={unread > 0 ? `${unread} unread` : '0 unread'}
        badgeColor={unread > 0 ? 'red' : 'gray'}
        onAdd={isAdmin ? () => setShowAddModal(true) : null}
        addLabel="Add Urgent Email"
      >
        {emails.length === 0 ? (
          <EmptyState message="No urgent emails" />
        ) : (
          <div className={styles.list}>
            {emails.map(e => (
              <div
                key={e.id}
                className={`${styles.item} ${styles.itemClickable} ${!e.isRead ? styles.itemUnread : ''}`}
                onClick={() => setSelectedItem(e)}
                role="button"
                tabIndex={0}
                onKeyDown={ev => ev.key === 'Enter' && setSelectedItem(e)}
                title="Click to view details"
              >
                <div className={styles.itemLeft}>
                  {!e.isRead && <div className={styles.emailDot} />}
                  <div>
                    <div className={styles.itemTitle}>{e.subject}</div>
                    <div className={styles.itemSub}>From: {e.fromName || e.from}</div>
                  </div>
                </div>
                <div className={styles.itemActions} onClick={ev => ev.stopPropagation()}>
                  {isAdmin && (
                    <button
                      className={styles.editIconBtn}
                      onClick={() => setEditItem(e)}
                      title="Edit email"
                    >
                      ✏️
                    </button>
                  )}
                  {!e.isRead && (
                    <button
                      className={styles.readBtn}
                      onClick={() => handleMarkRead(e.id)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardCard>

      {showAddModal && (
        <AddEmailModal
          directorId={activeDirectorId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); onRefresh(); }}
        />
      )}

      {editItem && (
        <EditEmailModal
          email={editItem}
          onClose={() => setEditItem(null)}
          onSuccess={() => { setEditItem(null); onRefresh(); }}
        />
      )}

      {selectedItem && !editItem && (
        <EmailDetailPopup
          email={selectedItem}
          onClose={() => setSelectedItem(null)}
          onEdit={isAdmin ? () => { setEditItem(selectedItem); setSelectedItem(null); } : null}
          onMarkRead={handleMarkRead}
        />
      )}
    </>
  );
};

// ── Inline email detail popup ─────────────────────────────────────────────────
// (Emails aren't in ItemDetailModal yet — simpler to keep inline here)
import { X } from 'lucide-react';
import detailStyles from './ItemDetailModal.module.css';

const EmailDetailPopup = ({ email, onClose, onEdit, onMarkRead }) => {
  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <div
      className={detailStyles.overlay}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={detailStyles.modal} role="dialog" aria-modal="true">
        <button className={detailStyles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>

        {/* Header */}
        <div className={detailStyles.typeHeader} style={{ background: '#fef2f2', borderColor: '#fecaca' }}>
          <span className={detailStyles.typeIcon}>📧</span>
          <div>
            <div className={detailStyles.typeLabel} style={{ color: '#dc2626' }}>Urgent Email</div>
            <h2 className={detailStyles.itemTitle}>{email.subject}</h2>
          </div>
        </div>

        {/* Fields */}
        <div className={detailStyles.fields}>
          {email.fromName && (
            <div className={detailStyles.field}>
              <span className={detailStyles.fieldLabel}>From</span>
              <span className={detailStyles.fieldValue}>{email.fromName}</span>
            </div>
          )}
          {email.from && (
            <div className={detailStyles.field}>
              <span className={detailStyles.fieldLabel}>Email</span>
              <span className={detailStyles.fieldValue}>{email.from}</span>
            </div>
          )}
          <div className={detailStyles.field}>
            <span className={detailStyles.fieldLabel}>Priority</span>
            <span className={detailStyles.fieldValue}>
              <span
                className={detailStyles.badge}
                style={{ color: '#dc2626', background: '#fef2f2' }}
              >
                {email.priority?.toUpperCase() || 'URGENT'}
              </span>
            </span>
          </div>
          <div className={detailStyles.field}>
            <span className={detailStyles.fieldLabel}>Status</span>
            <span className={detailStyles.fieldValue}>
              <span
                className={detailStyles.badge}
                style={{
                  color: email.isRead ? '#64748b' : '#dc2626',
                  background: email.isRead ? '#f8fafc' : '#fef2f2',
                }}
              >
                {email.isRead ? 'Read' : 'Unread'}
              </span>
            </span>
          </div>
          {email.createdAt && (
            <div className={detailStyles.field}>
              <span className={detailStyles.fieldLabel}>Received</span>
              <span className={detailStyles.fieldValue}>{fmtDate(email.createdAt?.split('T')[0])}</span>
            </div>
          )}
          {email.preview && (
            <div className={detailStyles.field}>
              <span className={detailStyles.fieldLabel}>Preview</span>
              <span className={detailStyles.fieldValue}>{email.preview}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className={detailStyles.actionRow} style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {!email.isRead && (
              <button
                className={detailStyles.approveBtn}
                onClick={() => { onMarkRead(email.id); onClose(); }}
              >
                ✓ Mark as Read
              </button>
            )}
          </div>
          {onEdit && (
            <button className={detailStyles.editFooterBtn} onClick={onEdit}>
              ✏️ Edit
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default UrgentEmailsCard;
