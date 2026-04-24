import React, { createContext, useContext, useState, useCallback } from 'react';
import api from '../services/api';
import { useDirector } from './DirectorContext';

const SearchContext = createContext(null);

/**
 * Searches across all modules:
 * Tasks, Reminders, Approvals, Meetings, Emails, Travel,
 * Documents, Bills, Assets, Events
 *
 * Each result has: id, type, title, subtitle, meta, link, icon
 */

const MODULE_CONFIG = [
  {
    key: 'tasks',
    endpoint: '/tasks',
    icon: '✅',
    label: 'Task',
    link: '/tasks',
    getTitle: r => r.title,
    getSub:   r => r.description || '',
    getMeta:  r => [r.status, r.priority, r.dueDate].filter(Boolean).join(' · '),
    match:    (r, q) => matches(q, r.title, r.description, r.tags?.join(' ')),
  },
  {
    key: 'reminders',
    endpoint: '/reminders',
    icon: '🔔',
    label: 'Reminder',
    link: '/dashboard',
    getTitle: r => r.title,
    getSub:   r => r.description || '',
    getMeta:  r => r.dueDate ? `Due ${fmtDate(r.dueDate)}` : '',
    match:    (r, q) => matches(q, r.title, r.description),
  },
  {
    key: 'approvals',
    endpoint: '/approvals',
    icon: '📋',
    label: 'Approval',
    link: '/dashboard',
    getTitle: r => r.title,
    getSub:   r => `From: ${r.fromName}`,
    getMeta:  r => r.status,
    match:    (r, q) => matches(q, r.title, r.fromName, r.description),
  },
  {
    key: 'meetings',
    endpoint: '/meetings',
    icon: '📅',
    label: 'Meeting',
    link: '/dashboard',
    getTitle: r => r.title,
    getSub:   r => r.location || '',
    getMeta:  r => [r.date, r.time].filter(Boolean).join(' at '),
    match:    (r, q) => matches(q, r.title, r.location, r.description),
  },
  {
    key: 'emails',
    endpoint: '/emails',
    icon: '📧',
    label: 'Urgent Email',
    link: '/dashboard',
    getTitle: r => r.subject,
    getSub:   r => `From: ${r.fromName || r.from}`,
    getMeta:  r => r.isRead ? 'Read' : 'Unread',
    match:    (r, q) => matches(q, r.subject, r.fromName, r.preview),
  },
  {
    key: 'travel',
    endpoint: '/travel',
    icon: '✈️',
    label: 'Travel',
    link: '/travel',
    getTitle: r => r.destination,
    getSub:   r => r.purpose || '',
    getMeta:  r => r.departureDate ? `Departs ${fmtDate(r.departureDate)}` : '',
    match:    (r, q) => matches(q, r.destination, r.purpose, r.notes),
  },
  {
    key: 'documents',
    endpoint: '/documents',
    icon: '📄',
    label: 'Document',
    link: '/documents',
    getTitle: r => r.title,
    getSub:   r => r.category,
    getMeta:  r => r.fileName || '',
    match:    (r, q) => matches(q, r.title, r.description, r.category, r.tags?.join(' ')),
  },
  {
    key: 'bills',
    endpoint: '/bills',
    icon: '🧾',
    label: 'Bill',
    link: '/bills',
    getTitle: r => r.title,
    getSub:   r => r.vendor || '',
    getMeta:  r => `${r.currency}${Number(r.amount).toLocaleString('en-IN')} · ${r.status}`,
    match:    (r, q) => matches(q, r.title, r.vendor, r.category, r.invoiceNumber),
  },
  {
    key: 'assets',
    endpoint: '/assets',
    icon: '📦',
    label: 'Asset',
    link: '/assets',
    getTitle: r => r.name,
    getSub:   r => r.category,
    getMeta:  r => [r.serialNumber, r.assignedTo].filter(Boolean).join(' · '),
    match:    (r, q) => matches(q, r.name, r.description, r.category, r.serialNumber, r.assignedTo),
  },
  {
    key: 'events',
    endpoint: '/events',
    icon: '🗓️',
    label: 'Event',
    link: '/events',
    getTitle: r => r.title,
    getSub:   r => r.location || '',
    getMeta:  r => r.startDate ? fmtDate(r.startDate) : '',
    match:    (r, q) => matches(q, r.title, r.description, r.location, r.notes),
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

const fmtDate = (d) => {
  try {
    return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch { return d; }
};

const matches = (query, ...fields) => {
  const q = query.toLowerCase().trim();
  return fields.some(f => f && String(f).toLowerCase().includes(q));
};

// ── Provider ─────────────────────────────────────────────────────────────────

export const SearchProvider = ({ children }) => {
  const { activeDirectorId } = useDirector();
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);

  const search = useCallback(async (q) => {
    const trimmed = q.trim();
    setQuery(q);

    if (trimmed.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setSearched(true);

    try {
      const params = { directorId: activeDirectorId };

      // Fetch all modules in parallel
      const responses = await Promise.allSettled(
        MODULE_CONFIG.map(m => api.get(m.endpoint, { params }))
      );

      const allResults = [];

      responses.forEach((res, idx) => {
        if (res.status !== 'fulfilled') return;
        const config = MODULE_CONFIG[idx];
        const items = Array.isArray(res.value.data) ? res.value.data : [];

        items
          .filter(item => config.match(item, trimmed))
          .forEach(item => {
            allResults.push({
              id:       `${config.key}-${item.id}`,
              type:     config.key,
              label:    config.label,
              icon:     config.icon,
              title:    config.getTitle(item),
              subtitle: config.getSub(item),
              meta:     config.getMeta(item),
              link:     config.link,
            });
          });
      });

      setResults(allResults);
    } catch (err) {
      console.error('Search failed:', err);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [activeDirectorId]);

  const clear = useCallback(() => {
    setQuery('');
    setResults([]);
    setSearched(false);
  }, []);

  return (
    <SearchContext.Provider value={{ query, results, loading, searched, search, clear }}>
      {children}
    </SearchContext.Provider>
  );
};

export const useSearch = () => {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used within SearchProvider');
  return ctx;
};
