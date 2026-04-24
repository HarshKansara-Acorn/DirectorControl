import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearch } from '../../context/SearchContext';
import { Search, X, ArrowRight, Loader } from 'lucide-react';
import styles from './SearchPanel.module.css';

// Group labels for display
const GROUP_ORDER = [
  'tasks', 'events', 'meetings', 'approvals', 'reminders',
  'emails', 'travel', 'documents', 'bills', 'assets',
];

const GROUP_LABELS = {
  tasks:     'Tasks',
  events:    'Events',
  meetings:  'Meetings',
  approvals: 'Approvals',
  reminders: 'Reminders',
  emails:    'Urgent Emails',
  travel:    'Travel',
  documents: 'Documents',
  bills:     'Bills',
  assets:    'Assets',
};

// Highlight matching text
const Highlight = ({ text, query }) => {
  if (!query || !text) return <span>{text}</span>;
  const idx = String(text).toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return <span>{text}</span>;
  return (
    <span>
      {text.slice(0, idx)}
      <mark className={styles.highlight}>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </span>
  );
};

const SearchPanel = ({ onClose }) => {
  const { query, results, loading, searched, search, clear } = useSearch();
  const navigate = useNavigate();
  const inputRef  = useRef(null);
  const panelRef  = useRef(null);
  const [activeIdx, setActiveIdx] = useState(-1);

  // Auto-focus input on open
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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

  // Debounced search
  const debounceRef = useRef(null);
  const handleInput = (e) => {
    const val = e.target.value;
    setActiveIdx(-1);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 220);
  };

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      handleSelect(results[activeIdx]);
    }
  };

  const handleSelect = (result) => {
    navigate(result.link);
    clear();
    onClose();
  };

  const handleClear = () => {
    clear();
    inputRef.current?.focus();
  };

  // Group results by type
  const grouped = GROUP_ORDER.reduce((acc, type) => {
    const items = results.filter(r => r.type === type);
    if (items.length) acc[type] = items;
    return acc;
  }, {});

  // Flat list for keyboard nav index tracking
  const flatResults = GROUP_ORDER.flatMap(type => grouped[type] || []);

  return (
    <div className={styles.overlay} role="dialog" aria-label="Search">
      <div className={styles.panel} ref={panelRef}>

        {/* Search Input */}
        <div className={styles.inputRow}>
          <Search size={18} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search tasks, events, documents, bills, assets…"
            defaultValue={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            aria-label="Search"
            autoComplete="off"
          />
          {loading && <Loader size={16} className={styles.spinner} />}
          {!loading && query && (
            <button className={styles.clearBtn} onClick={handleClear} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className={styles.body}>

          {/* Empty / initial state */}
          {!searched && !query && (
            <div className={styles.hintState}>
              <div className={styles.hintGrid}>
                {[
                  { icon: '✅', label: 'Tasks' },
                  { icon: '📅', label: 'Events' },
                  { icon: '📄', label: 'Documents' },
                  { icon: '🧾', label: 'Bills' },
                  { icon: '📦', label: 'Assets' },
                  { icon: '✈️', label: 'Travel' },
                  { icon: '🔔', label: 'Reminders' },
                  { icon: '📋', label: 'Approvals' },
                  { icon: '📧', label: 'Emails' },
                  { icon: '🗓️', label: 'Meetings' },
                ].map(({ icon, label }) => (
                  <div key={label} className={styles.hintChip}>
                    <span>{icon}</span> {label}
                  </div>
                ))}
              </div>
              <p className={styles.hintText}>Type at least 2 characters to search across all modules</p>
            </div>
          )}

          {/* No results */}
          {searched && !loading && results.length === 0 && (
            <div className={styles.emptyState}>
              <Search size={32} className={styles.emptyIcon} />
              <p className={styles.emptyTitle}>No results for "{query}"</p>
              <p className={styles.emptyText}>Try a different keyword or check the spelling</p>
            </div>
          )}

          {/* Results grouped by module */}
          {results.length > 0 && (
            <div className={styles.results}>
              <div className={styles.resultsCount}>
                {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
              </div>

              {Object.entries(grouped).map(([type, items]) => (
                <div key={type} className={styles.group}>
                  <div className={styles.groupLabel}>
                    {GROUP_LABELS[type] || type} · {items.length}
                  </div>
                  {items.map((result) => {
                    const flatIdx = flatResults.indexOf(result);
                    const isActive = flatIdx === activeIdx;
                    return (
                      <button
                        key={result.id}
                        className={`${styles.resultItem} ${isActive ? styles.resultItemActive : ''}`}
                        onClick={() => handleSelect(result)}
                        onMouseEnter={() => setActiveIdx(flatIdx)}
                      >
                        <span className={styles.resultIcon}>{result.icon}</span>
                        <div className={styles.resultContent}>
                          <div className={styles.resultTitle}>
                            <Highlight text={result.title} query={query} />
                          </div>
                          {result.subtitle && (
                            <div className={styles.resultSub}>
                              <Highlight text={result.subtitle} query={query} />
                            </div>
                          )}
                          {result.meta && (
                            <div className={styles.resultMeta}>{result.meta}</div>
                          )}
                        </div>
                        <div className={styles.resultRight}>
                          <span className={styles.resultLabel}>{result.label}</span>
                          <ArrowRight size={13} className={styles.resultArrow} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <span className={styles.footerHint}><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
          <span className={styles.footerHint}><kbd>↵</kbd> open</span>
          <span className={styles.footerHint}><kbd>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
};

export default SearchPanel;
