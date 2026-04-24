import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Sun, Moon, Monitor, ChevronDown } from 'lucide-react';
import styles from './ThemeToggle.module.css';

const OPTIONS = [
  { value: 'light', label: 'Light',  icon: Sun },
  { value: 'dark',  label: 'Dark',   icon: Moon },
  { value: 'auto',  label: 'System', icon: Monitor },
];

const ThemeToggle = () => {
  const { theme, setLight, setDark, setAuto } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Determine which option is "active" (auto = system)
  const savedPref = localStorage.getItem('dc-theme');
  const activeValue = savedPref ? theme : 'auto';

  const handlers = { light: setLight, dark: setDark, auto: setAuto };

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const ActiveIcon = theme === 'dark' ? Moon : Sun;

  return (
    <div className={styles.wrapper} ref={ref}>
      <button
        className={`${styles.btn} ${open ? styles.btnActive : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-label="Toggle appearance"
        title="Appearance"
      >
        <ActiveIcon size={16} />
      </button>

      {open && (
        <div className={styles.dropdown} role="menu">
          <div className={styles.dropdownTitle}>Appearance</div>
          {OPTIONS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              className={`${styles.option} ${activeValue === value ? styles.optionActive : ''}`}
              onClick={() => { handlers[value](); setOpen(false); }}
              role="menuitem"
            >
              <Icon size={14} />
              <span>{label}</span>
              {activeValue === value && <span className={styles.check}>✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default ThemeToggle;
