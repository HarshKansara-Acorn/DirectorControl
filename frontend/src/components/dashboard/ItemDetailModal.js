/**
 * ItemDetailModal — generic detail popup for dashboard card items.
 * Supports: meeting | reminder | approval | travel
 */
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import styles from './ItemDetailModal.module.css';

// ── Field row helper ──────────────────────────────────────────────────────────
const Field = ({ label, value, children }) => {
  if (!value && !children) return null;
  return (
    <div className={styles.field}>
      <span className={styles.fieldLabel}>{label}</span>
      <span className={styles.fieldValue}>{children || value}</span>
    </div>
  );
};

// ── Badge helper ──────────────────────────────────────────────────────────────
const Badge = ({ text, color, bg }) => (
  <span className={styles.badge} style={{ color, background: bg }}>{text}</span>
);

const PRIORITY_COLORS = {
  high:   { color: '#dc2626', bg: '#fef2f2' },
  medium: { color: '#d97706', bg: '#fffbeb' },
  low:    { color: '#15803d', bg: '#f0fdf4' },
  normal: { color: '#64748b', bg: '#f8fafc' },
  urgent: { color: '#dc2626', bg: '#fef2f2' },
};

const STATUS_COLORS = {
  upcoming:  { color: '#1e40af', bg: '#eff6ff' },
  ongoing:   { color: '#15803d', bg: '#f0fdf4' },
  completed: { color: '#64748b', bg: '#f8fafc' },
  cancelled: { color: '#dc2626', bg: '#fef2f2' },
  pending:   { color: '#c2410c', bg: '#fff7ed' },
  approved:  { color: '#15803d', bg: '#f0fdf4' },
  rejected:  { color: '#dc2626', bg: '#fef2f2' },
  active:    { color: '#15803d', bg: '#f0fdf4' },
};

const fmtDate = (d) => d
  ? new Date(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  : null;

const fmtTime = (t) => {
  if (!t) return null;
  const [h, m] = t.split(':');
  const hour = parseInt(h);
  return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

// ── Meeting detail ────────────────────────────────────────────────────────────
const MeetingDetail = ({ item }) => {
  const pc = PRIORITY_COLORS.normal;
  return (
    <>
      <div className={styles.typeHeader} style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
        <span className={styles.typeIcon}>📅</span>
        <div>
          <div className={styles.typeLabel} style={{ color: '#1e40af' }}>Meeting</div>
          <h2 className={styles.itemTitle}>{item.title}</h2>
        </div>
      </div>
      <div className={styles.fields}>
        <Field label="Date">{fmtDate(item.date)}</Field>
        <Field label="Time">
          {item.time ? fmtTime(item.time) : '—'}
          {item.duration ? <span className={styles.duration}> · {item.duration} min</span> : ''}
        </Field>
        <Field label="Location" value={item.location || 'No location specified'} />
        {item.description && <Field label="Description" value={item.description} />}
        {item.attendees && item.attendees.length > 0 && (
          <Field label="Attendees">
            <div className={styles.attendeeList}>
              {item.attendees.map((a, i) => (
                <span key={i} className={styles.attendeeChip}>{a}</span>
              ))}
            </div>
          </Field>
        )}
        {item.isShared && (
          <Field label="Shared">
            <Badge text="👥 Shared with all directors" color="#1e40af" bg="#eff6ff" />
          </Field>
        )}
      </div>
    </>
  );
};

// ── Reminder detail ───────────────────────────────────────────────────────────
const ReminderDetail = ({ item }) => {
  const today = new Date().toISOString().split('T')[0];
  const isOverdue = item.dueDate && item.dueDate < today;
  const pc = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium;
  return (
    <>
      <div className={styles.typeHeader} style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
        <span className={styles.typeIcon}>🔔</span>
        <div>
          <div className={styles.typeLabel} style={{ color: '#d97706' }}>Key Reminder</div>
          <h2 className={styles.itemTitle}>{item.title}</h2>
        </div>
      </div>
      <div className={styles.fields}>
        <Field label="Priority">
          <Badge text={item.priority?.toUpperCase() || 'MEDIUM'} color={pc.color} bg={pc.bg} />
        </Field>
        <Field label="Status">
          <Badge
            text={item.isActive ? 'Active' : 'Inactive'}
            color={item.isActive ? '#15803d' : '#64748b'}
            bg={item.isActive ? '#f0fdf4' : '#f8fafc'}
          />
        </Field>
        {item.dueDate && (
          <Field label="Due Date">
            <span style={{ color: isOverdue ? '#dc2626' : 'inherit' }}>
              {isOverdue && '⚠️ Overdue · '}
              {fmtDate(item.dueDate)}
              {item.dueTime ? ` at ${fmtTime(item.dueTime)}` : ''}
            </span>
          </Field>
        )}
        {item.description && <Field label="Description" value={item.description} />}
      </div>
    </>
  );
};

// ── Approval detail ───────────────────────────────────────────────────────────
const ApprovalDetail = ({ item, onAction }) => {
  const pc = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.normal;
  const sc = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
  return (
    <>
      <div className={styles.typeHeader} style={{ background: '#fff7ed', borderColor: '#fed7aa' }}>
        <span className={styles.typeIcon}>✅</span>
        <div>
          <div className={styles.typeLabel} style={{ color: '#c2410c' }}>Pending Approval</div>
          <h2 className={styles.itemTitle}>{item.title}</h2>
        </div>
      </div>
      <div className={styles.fields}>
        <Field label="Type">
          <Badge text={item.type?.toUpperCase() || 'GENERAL'} color="#64748b" bg="#f8fafc" />
        </Field>
        <Field label="Priority">
          <Badge text={item.priority?.toUpperCase() || 'NORMAL'} color={pc.color} bg={pc.bg} />
        </Field>
        <Field label="Status">
          <Badge text={item.status?.toUpperCase() || 'PENDING'} color={sc.color} bg={sc.bg} />
        </Field>
        {item.fromName && <Field label="From" value={item.fromName} />}
        {item.fromEmail && <Field label="Email" value={item.fromEmail} />}
        {item.dueDate && (
          <Field label="Due Date">
            {fmtDate(item.dueDate)}
            {item.dueTime ? ` at ${fmtTime(item.dueTime)}` : ''}
          </Field>
        )}
        {item.description && <Field label="Description" value={item.description} />}
        {item.remarks && <Field label="Remarks" value={item.remarks} />}
      </div>

      {/* Action buttons for pending approvals */}
      {item.status === 'pending' && onAction && (
        <div className={styles.actionRow}>
          <button className={styles.approveBtn} onClick={() => onAction(item.id, 'approved')}>
            ✓ Approve
          </button>
          <button className={styles.rejectBtn} onClick={() => onAction(item.id, 'rejected')}>
            ✕ Reject
          </button>
        </div>
      )}
    </>
  );
};

// ── Travel detail ─────────────────────────────────────────────────────────────
const TravelDetail = ({ item }) => {
  const sc = STATUS_COLORS[item.status] || STATUS_COLORS.upcoming;
  return (
    <>
      <div className={styles.typeHeader} style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
        <span className={styles.typeIcon}>✈️</span>
        <div>
          <div className={styles.typeLabel} style={{ color: '#1e40af' }}>Travel Reminder</div>
          <h2 className={styles.itemTitle}>{item.destination}</h2>
        </div>
      </div>
      <div className={styles.fields}>
        <Field label="Status">
          <Badge text={item.status?.toUpperCase() || 'UPCOMING'} color={sc.color} bg={sc.bg} />
        </Field>
        {item.purpose && <Field label="Purpose" value={item.purpose} />}
        <Field label="Departure">
          {fmtDate(item.departureDate)}
          {item.departureTime ? ` at ${fmtTime(item.departureTime)}` : ''}
        </Field>
        {item.returnDate && (
          <Field label="Return">
            {fmtDate(item.returnDate)}
            {item.returnTime ? ` at ${fmtTime(item.returnTime)}` : ''}
          </Field>
        )}
        {item.notes && <Field label="Notes" value={item.notes} />}
        {item.hasAttachment && item.attachmentName && (
          <Field label="Attachment">
            <a
              href={item.attachmentData}
              download={item.attachmentName}
              className={styles.attachLink}
            >
              📎 {item.attachmentName}
            </a>
          </Field>
        )}
      </div>
    </>
  );
};

// ── Main modal ────────────────────────────────────────────────────────────────
const ItemDetailModal = ({ item, type, onClose, onAction, onEdit }) => {
  const overlayRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleOverlayClick = (e) => {
    if (e.target === overlayRef.current) onClose();
  };

  const renderContent = () => {
    switch (type) {
      case 'meeting':  return <MeetingDetail  item={item} />;
      case 'reminder': return <ReminderDetail item={item} />;
      case 'approval': return <ApprovalDetail item={item} onAction={onAction} />;
      case 'travel':   return <TravelDetail   item={item} />;
      default:         return null;
    }
  };

  // Show edit footer for types that support editing (not meetings/travel from detail)
  const showEditFooter = onEdit && ['reminder', 'approval', 'email'].includes(type);

  return (
    <div className={styles.overlay} ref={overlayRef} onClick={handleOverlayClick}>
      <div className={styles.modal} role="dialog" aria-modal="true">
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
          <X size={16} />
        </button>
        {renderContent()}
        {showEditFooter && (
          <div className={styles.editFooter}>
            <button className={styles.editFooterBtn} onClick={onEdit}>
              ✏️ Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemDetailModal;
