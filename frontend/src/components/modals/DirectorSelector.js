import React from 'react';
import { useDirector } from '../../context/DirectorContext';
import styles from './DirectorSelector.module.css';

/**
 * Reusable director multi-select for broadcast modals.
 * Shows checkboxes for each director + an "All Directors" toggle.
 *
 * Props:
 *   selected   — array of selected director IDs
 *   onChange   — (ids: string[]) => void
 *   singleMode — if true, renders radio buttons (single select only)
 */
const DirectorSelector = ({ selected, onChange, singleMode = false }) => {
  const { directors } = useDirector();

  if (!directors.length) return null;

  const allSelected = directors.every(d => selected.includes(d.id));

  const toggleAll = () => {
    if (allSelected) {
      onChange([]);
    } else {
      onChange(directors.map(d => d.id));
    }
  };

  const toggleOne = (id) => {
    if (singleMode) {
      onChange([id]);
      return;
    }
    if (selected.includes(id)) {
      onChange(selected.filter(s => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.label}>
        Send to
        {!singleMode && (
          <button
            type="button"
            className={`${styles.allBtn} ${allSelected ? styles.allBtnActive : ''}`}
            onClick={toggleAll}
          >
            {allSelected ? '✓ All Directors' : 'Select All'}
          </button>
        )}
      </div>

      <div className={styles.grid}>
        {directors.map(d => {
          const isSelected = selected.includes(d.id);
          return (
            <button
              key={d.id}
              type="button"
              className={`${styles.dirCard} ${isSelected ? styles.dirCardSelected : ''}`}
              onClick={() => toggleOne(d.id)}
              aria-pressed={isSelected}
            >
              <div
                className={styles.avatar}
                style={{ background: isSelected ? '#1e40af' : 'var(--bg-muted)' }}
              >
                {d.avatar || d.name?.[0]}
              </div>
              <div className={styles.info}>
                <div className={styles.name}>{d.name}</div>
                <div className={styles.title}>{d.title || 'Director'}</div>
              </div>
              <div className={`${styles.check} ${isSelected ? styles.checkActive : ''}`}>
                {isSelected ? '✓' : ''}
              </div>
            </button>
          );
        })}
      </div>

      {selected.length === 0 && (
        <p className={styles.hint}>Select at least one director</p>
      )}
      {!singleMode && selected.length > 1 && (
        <p className={styles.broadcastNote}>
          📢 This will create <strong>{selected.length} separate records</strong> — one for each selected director
        </p>
      )}
    </div>
  );
};

export default DirectorSelector;
