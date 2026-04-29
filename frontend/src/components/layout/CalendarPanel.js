import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X, Loader } from 'lucide-react';
import styles from './CalendarPanel.module.css';

const DAYS   = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ── Item type config ──────────────────────────────────────────────────────────
const TYPE_CONFIG = {
  event:       { label: 'Event',          color: '#1e40af', bg: '#eff6ff' },
  task:        { label: 'Task',           color: '#7c3aed', bg: '#faf5ff' },
  reminder:    { label: 'Reminder',       color: '#d97706', bg: '#fffbeb' },
  travel:      { label: 'Travel',         color: '#0891b2', bg: '#ecfeff' },
  approval:    { label: 'Approval',       color: '#dc2626', bg: '#fef2f2' },
  email:       { label: 'Urgent Email',   color: '#c2410c', bg: '#fff7ed' },
  meeting:     { label: 'Meeting',        color: '#15803d', bg: '#f0fdf4' },
};

// ── Normalise all data sources into a flat list of calendar items ─────────────
// Each item: { date, title, time, type, subLabel }
const normalise = (data) => {
  const items = [];

  // Events
  (data.events || []).forEach(e => {
    if (e.startDate) items.push({
      date: e.startDate,
      title: e.title,
      time: e.startTime || '',
      type: 'event',
      subLabel: e.type || 'event',
    });
  });

  // Tasks — use dueDate
  (data.tasks || []).forEach(t => {
    if (t.dueDate) items.push({
      date: t.dueDate,
      title: t.title,
      time: t.dueTime || '',
      type: 'task',
      subLabel: t.priority || 'medium',
    });
  });

  // Reminders — use dueDate
  (data.reminders || []).forEach(r => {
    if (r.dueDate) items.push({
      date: r.dueDate,
      title: r.title,
      time: r.dueTime || '',
      type: 'reminder',
      subLabel: r.priority || 'medium',
    });
  });

  // Travel — departure date AND return date
  (data.travel || []).forEach(t => {
    if (t.departureDate) items.push({
      date: t.departureDate,
      title: `✈ ${t.destination} (Departure)`,
      time: t.departureTime || '',
      type: 'travel',
      subLabel: t.status || 'upcoming',
    });
    if (t.returnDate) items.push({
      date: t.returnDate,
      title: `✈ ${t.destination} (Return)`,
      time: t.returnTime || '',
      type: 'travel',
      subLabel: t.status || 'upcoming',
    });
  });

  // Approvals — use dueDate
  (data.approvals || []).forEach(a => {
    if (a.dueDate) items.push({
      date: a.dueDate,
      title: a.title,
      time: a.dueTime || '',
      type: 'approval',
      subLabel: a.status || 'pending',
    });
  });

  // Urgent Emails — use createdAt date
  (data.emails || []).forEach(e => {
    const d = e.createdAt ? e.createdAt.split('T')[0] : null;
    if (d) items.push({
      date: d,
      title: e.subject,
      time: '',
      type: 'email',
      subLabel: e.fromName || '',
    });
  });

  // Meetings — use date field
  (data.meetings || []).forEach(m => {
    if (m.date) items.push({
      date: m.date,
      title: m.title,
      time: m.time || '',
      type: 'meeting',
      subLabel: m.location || '',
    });
  });

  return items;
};

// ── Legend strip ──────────────────────────────────────────────────────────────
const Legend = () => (
  <div className={styles.legend}>
    {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
      <span key={key} className={styles.legendItem}>
        <span className={styles.legendDot} style={{ background: cfg.color }} />
        {cfg.label}
      </span>
    ))}
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const CalendarPanel = ({ onClose, data = {}, loading = false, directorName = '' }) => {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selected,  setSelected]  = useState(null);
  const [showLegend, setShowLegend] = useState(false);
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Normalise all data into flat items
  const allItems = normalise(data);

  // Build dot map: { 'YYYY-MM-DD': { type: count } }
  const dotMap = {};
  allItems.forEach(item => {
    if (!dotMap[item.date]) dotMap[item.date] = {};
    dotMap[item.date][item.type] = (dotMap[item.date][item.type] || 0) + 1;
  });

  // Build calendar grid
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--)
    cells.push({ day: daysInPrev - i, current: false, date: null });
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push({ day: d, current: true, date: `${viewYear}-${mm}-${dd}` });
  }
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++)
    cells.push({ day: d, current: false, date: null });

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };
  const goToday = () => {
    setViewYear(today.getFullYear());
    setViewMonth(today.getMonth());
    setSelected(today.toISOString().split('T')[0]);
  };

  const todayStr = today.toISOString().split('T')[0];

  // Items for selected day, sorted by time
  const selectedItems = selected
    ? allItems
        .filter(item => item.date === selected)
        .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'))
    : [];

  // Total items this month (for subtitle)
  const monthStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}`;
  const monthCount = allItems.filter(i => i.date?.startsWith(monthStr)).length;

  return (
    <div className={styles.panel} ref={panelRef} role="dialog" aria-label="Calendar">

      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.monthNav}>
          <button className={styles.navBtn} onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft size={15} />
          </button>
          <div className={styles.monthInfo}>
            <span className={styles.monthLabel}>{MONTHS[viewMonth]} {viewYear}</span>
            {directorName && (
              <span className={styles.directorTag}>{directorName}</span>
            )}
          </div>
          <button className={styles.navBtn} onClick={nextMonth} aria-label="Next month">
            <ChevronRight size={15} />
          </button>
        </div>
        <div className={styles.headerActions}>
          {monthCount > 0 && (
            <span className={styles.monthCount}>{monthCount}</span>
          )}
          <button className={styles.todayBtn} onClick={goToday}>Today</button>
          <button
            className={`${styles.legendToggle} ${showLegend ? styles.legendToggleActive : ''}`}
            onClick={() => setShowLegend(v => !v)}
            title="Show legend"
          >
            ●
          </button>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Legend (toggleable) ── */}
      {showLegend && <Legend />}

      {/* ── Loading ── */}
      {loading && (
        <div className={styles.loadingRow}>
          <Loader size={14} className={styles.spin} /> Loading...
        </div>
      )}

      {/* ── Day labels ── */}
      <div className={styles.dayLabels}>
        {DAYS.map(d => <span key={d} className={styles.dayLabel}>{d}</span>)}
      </div>

      {/* ── Grid ── */}
      <div className={styles.grid}>
        {cells.map((cell, i) => {
          const isToday    = cell.current && cell.date === todayStr;
          const isSelected = cell.current && cell.date === selected;
          const typesOnDay = cell.date ? Object.keys(dotMap[cell.date] || {}) : [];

          return (
            <button
              key={i}
              className={[
                styles.cell,
                !cell.current          ? styles.cellOther    : '',
                isToday                ? styles.cellToday    : '',
                isSelected && !isToday ? styles.cellSelected : '',
              ].filter(Boolean).join(' ')}
              onClick={() => cell.current && setSelected(cell.date)}
              tabIndex={cell.current ? 0 : -1}
              aria-label={cell.date || undefined}
            >
              <span className={styles.cellNum}>{cell.day}</span>
              {typesOnDay.length > 0 && (
                <span className={styles.dots}>
                  {typesOnDay.slice(0, 3).map(type => (
                    <span
                      key={type}
                      className={styles.dot}
                      style={{ background: isToday ? 'rgba(255,255,255,0.8)' : TYPE_CONFIG[type]?.color || '#94a3b8' }}
                    />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Selected day detail ── */}
      {selected && (
        <div className={styles.dayDetail}>
          <div className={styles.dayDetailTitle}>
            {new Date(selected + 'T00:00:00').toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
            <span className={styles.dayDetailCount}>
              {selectedItems.length} item{selectedItems.length !== 1 ? 's' : ''}
            </span>
          </div>

          {selectedItems.length === 0 ? (
            <p className={styles.noEvents}>Nothing scheduled</p>
          ) : (
            <ul className={styles.eventList}>
              {selectedItems.map((item, idx) => {
                const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.event;
                return (
                  <li key={idx} className={styles.eventItem}>
                    <span className={styles.eventDot} style={{ background: cfg.color }} />
                    <div className={styles.eventInfo}>
                      <div className={styles.eventTitleRow}>
                        <span className={styles.eventTitle}>{item.title}</span>
                        <span
                          className={styles.typeBadge}
                          style={{ background: cfg.bg, color: cfg.color }}
                        >
                          {cfg.label}
                        </span>
                      </div>
                      <div className={styles.eventMeta}>
                        {item.time && <span className={styles.eventTime}>🕐 {item.time}</span>}
                        {item.subLabel && <span className={styles.eventSub}>{item.subLabel}</span>}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarPanel;
