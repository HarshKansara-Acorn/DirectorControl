import React, { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import styles from './CalendarPanel.module.css';

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const CalendarPanel = ({ onClose, events = [] }) => {
  const today = new Date();
  const [viewYear,  setViewYear]  = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth()); // 0-indexed
  const [selected,  setSelected]  = useState(null);
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

  // Build event dot map: { 'YYYY-MM-DD': count }
  const eventMap = {};
  events.forEach(ev => {
    const d = ev.startDate || ev.date;
    if (d) eventMap[d] = (eventMap[d] || 0) + 1;
  });

  // Build calendar grid
  const firstDay = new Date(viewYear, viewMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev  = new Date(viewYear, viewMonth, 0).getDate();

  const cells = [];
  // Leading days from previous month
  for (let i = firstDay - 1; i >= 0; i--) {
    cells.push({ day: daysInPrev - i, current: false, date: null });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push({ day: d, current: true, date: `${viewYear}-${mm}-${dd}` });
  }
  // Trailing days to fill last row
  const remaining = 42 - cells.length;
  for (let d = 1; d <= remaining; d++) {
    cells.push({ day: d, current: false, date: null });
  }

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

  // Events for selected day
  const selectedEvents = selected
    ? events.filter(ev => (ev.startDate || ev.date) === selected)
    : [];

  return (
    <div className={styles.panel} ref={panelRef} role="dialog" aria-label="Calendar">
      {/* ── Header ── */}
      <div className={styles.header}>
        <div className={styles.monthNav}>
          <button className={styles.navBtn} onClick={prevMonth} aria-label="Previous month">
            <ChevronLeft size={15} />
          </button>
          <span className={styles.monthLabel}>
            {MONTHS[viewMonth]} {viewYear}
          </span>
          <button className={styles.navBtn} onClick={nextMonth} aria-label="Next month">
            <ChevronRight size={15} />
          </button>
        </div>
        <div className={styles.headerActions}>
          <button className={styles.todayBtn} onClick={goToday}>Today</button>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close calendar">
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── Day-of-week labels ── */}
      <div className={styles.dayLabels}>
        {DAYS.map(d => <span key={d} className={styles.dayLabel}>{d}</span>)}
      </div>

      {/* ── Calendar grid ── */}
      <div className={styles.grid}>
        {cells.map((cell, i) => {
          const isToday    = cell.current && cell.date === todayStr;
          const isSelected = cell.current && cell.date === selected;
          const dotCount   = cell.date ? (eventMap[cell.date] || 0) : 0;

          return (
            <button
              key={i}
              className={[
                styles.cell,
                !cell.current  ? styles.cellOther    : '',
                isToday        ? styles.cellToday    : '',
                isSelected && !isToday ? styles.cellSelected : '',
              ].join(' ')}
              onClick={() => cell.current && setSelected(cell.date)}
              tabIndex={cell.current ? 0 : -1}
              aria-label={cell.date || undefined}
              aria-pressed={isSelected}
            >
              <span className={styles.cellNum}>{cell.day}</span>
              {dotCount > 0 && (
                <span className={styles.dots}>
                  {[...Array(Math.min(dotCount, 3))].map((_, di) => (
                    <span key={di} className={styles.dot} />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Selected day events ── */}
      {selected && (
        <div className={styles.dayDetail}>
          <div className={styles.dayDetailTitle}>
            {new Date(selected + 'T00:00:00').toLocaleDateString('en-GB', {
              weekday: 'long', day: 'numeric', month: 'long',
            })}
          </div>
          {selectedEvents.length === 0 ? (
            <p className={styles.noEvents}>No events</p>
          ) : (
            <ul className={styles.eventList}>
              {selectedEvents.map((ev, i) => (
                <li key={i} className={styles.eventItem}>
                  <span
                    className={styles.eventDot}
                    style={{ background: ev.source === 'outlook' ? '#0078d4' : '#1e40af' }}
                  />
                  <div className={styles.eventInfo}>
                    <span className={styles.eventTitle}>{ev.title}</span>
                    {(ev.startTime || ev.time) && (
                      <span className={styles.eventTime}>{ev.startTime || ev.time}</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default CalendarPanel;
