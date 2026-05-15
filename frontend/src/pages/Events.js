import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDirector } from '../context/DirectorContext';
import api from '../services/api';
import Modal from '../components/modals/Modal';
import FormField, { Input, Textarea, Select, FormActions } from '../components/modals/FormField';
import { Calendar, MapPin, Users, Clock, Edit2, Trash2, Plus } from 'lucide-react';
import DirectorSelector from '../components/modals/DirectorSelector';
import FileUploadButton from '../components/common/FileUploadButton';
import styles from './PageLayout.module.css';

const TYPE_STYLES = {
  meeting: { bg: '#eff6ff', color: '#1e40af', icon: '🤝', label: 'Meeting' },
  conference: { bg: '#faf5ff', color: '#7c3aed', icon: '🎤', label: 'Conference' },
  presentation: { bg: '#fff7ed', color: '#c2410c', icon: '📊', label: 'Presentation' },
  company: { bg: '#f0fdf4', color: '#15803d', icon: '🏢', label: 'Company' },
  personal: { bg: '#f8fafc', color: '#64748b', icon: '👤', label: 'Personal' },
  other: { bg: '#f8fafc', color: '#64748b', icon: '📅', label: 'Other' },
};

const PRIORITY_COLORS = {
  high: { bg: '#fef2f2', color: '#dc2626' },
  medium: { bg: '#fff7ed', color: '#d97706' },
  low: { bg: '#f0fdf4', color: '#15803d' },
};

const EMPTY_FORM = { title: '', description: '', type: 'meeting', startDate: '', endDate: '', startTime: '09:00', endTime: '10:00', location: '', attendees: '', isAllDay: false, priority: 'medium', notes: '' };

const Events = () => {
  const { isAdmin, user } = useAuth();
  const { activeDirectorId, selectedDirector } = useDirector();

  // For directors: use their own ID. For admin: use the selected director ID.
  const effectiveDirectorId = activeDirectorId || user?.id;
  const displayName = selectedDirector?.name || user?.name || 'My';
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedDirectors, setSelectedDirectors] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState(null);
  const syncIntervalRef = useRef(null);

  const fetchEvents = useCallback(async () => {
    if (!effectiveDirectorId) return;
    setLoading(true);
    try {
      const res = await api.get('/events', { params: { directorId: effectiveDirectorId } });
      setEvents(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [effectiveDirectorId]);

  // Auto-sync Outlook calendar silently, then refresh events
  const autoSync = useCallback(async () => {
    if (!effectiveDirectorId) return;
    try {
      await api.get('/teams/auto-sync', { params: { directorId: effectiveDirectorId } });
      setLastSynced(new Date());
      // Refresh events list after sync
      const res = await api.get('/events', { params: { directorId: effectiveDirectorId } });
      setEvents(res.data);
    } catch {
      // Silent — don't show errors for background sync
    }
  }, [effectiveDirectorId]);

  // On mount: sync immediately then every 30 seconds
  useEffect(() => {
    if (!effectiveDirectorId) return;
    autoSync(); // immediate sync on load
    syncIntervalRef.current = setInterval(autoSync, 30000);
    return () => clearInterval(syncIntervalRef.current);
  }, [autoSync, effectiveDirectorId]);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);

  const openAdd = () => {
    setEditItem(null);
    setForm(EMPTY_FORM);
    setSelectedDirectors(effectiveDirectorId ? [effectiveDirectorId] : []);
    setError('');
    setShowModal(true);
  };
  const openEdit = (item) => {
    setEditItem(item);
    setSelectedDirectors(item.directorIds?.length ? item.directorIds : (item.directorId ? [item.directorId] : []));
    setForm({ title: item.title, description: item.description || '', type: item.type, startDate: item.startDate, endDate: item.endDate || item.startDate, startTime: item.startTime || '09:00', endTime: item.endTime || '10:00', location: item.location || '', attendees: (item.attendees || []).join(', '), isAllDay: item.isAllDay || false, priority: item.priority || 'medium', notes: item.notes || '' });
    setError(''); setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDirectors.length) return setError('Please select at least one director');
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        directorId: selectedDirectors[0],
        directorIds: selectedDirectors,
        attendees: form.attendees ? form.attendees.split(',').map(a => a.trim()).filter(Boolean) : [],
      };
      if (editItem) { await api.put(`/events/${editItem.id}`, payload); }
      else { await api.post('/events', payload); }
      setShowModal(false); fetchEvents();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this event?')) return;
    try { await api.delete(`/events/${id}`); fetchEvents(); }
    catch (err) { console.error(err); }
  };

  const filtered = events.filter(e => filterType === 'all' || e.type === filterType);
  const upcoming = events.filter(e => e.status === 'upcoming').length;

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '—';
  const isToday = (d) => d === new Date().toISOString().split('T')[0];
  const isThisWeek = (d) => { const diff = (new Date(d) - new Date()) / (1000 * 60 * 60 * 24); return diff >= 0 && diff <= 7; };

  // Group events by month
  const grouped = filtered.reduce((acc, event) => {
    const month = new Date(event.startDate).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    if (!acc[month]) acc[month] = [];
    acc[month].push(event);
    return acc;
  }, {});

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Events</h1>
          <p className={styles.subtitle}>
            {displayName} — {upcoming} upcoming event{upcoming !== 1 ? 's' : ''}
            {lastSynced && (
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 10 }}>
                · Outlook synced {lastSynced.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className={styles.headerActions}>
          <select className={styles.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)} aria-label="Filter by type">
            <option value="all">All Types</option>
            {Object.entries(TYPE_STYLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          {isAdmin && (
            <button className={styles.addBtn} onClick={openAdd}><Plus size={15} /> Add Event</button>
          )}
        </div>
      </div>

      {/* No sync message needed — auto-sync is silent */}

      {loading ? (
        <div className={styles.skeletonGrid}>{[...Array(3)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <Calendar size={40} className={styles.emptyIcon} />
          <p className={styles.emptyText}>No events found</p>
          {isAdmin && <button className={styles.emptyAddBtn} onClick={openAdd}>Add Event</button>}
        </div>
      ) : (
        <div className={styles.eventsList}>
          {Object.entries(grouped).map(([month, monthEvents]) => (
            <div key={month} className={styles.eventGroup}>
              <h2 className={styles.eventGroupTitle}>{month}</h2>
              <div className={styles.eventsTimeline}>
                {monthEvents.map(item => {
                  const t = TYPE_STYLES[item.type] || TYPE_STYLES.other;
                  const p = PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.medium;
                  const today = isToday(item.startDate);
                  const thisWeek = isThisWeek(item.startDate);
                  return (
                    <div key={item.id} className={`${styles.eventCard} ${today ? styles.eventCardToday : ''}`}>
                      {/* Date column */}
                      <div className={styles.eventDateCol}>
                        <div className={styles.eventDay}>{new Date(item.startDate).getDate()}</div>
                        <div className={styles.eventDayName}>{new Date(item.startDate).toLocaleDateString('en-GB', { weekday: 'short' })}</div>
                        {today && <div className={styles.todayDot} />}
                      </div>

                      {/* Content */}
                      <div className={styles.eventContent}>
                        <div className={styles.eventContentHeader}>
                          <div className={styles.eventTypeIcon} style={{ background: t.bg }}>{t.icon}</div>
                          <div className={styles.eventTitleGroup}>
                            <div className={styles.eventTitle}>{item.title}</div>
                            <div className={styles.eventMeta}>
                              {!item.isAllDay && (
                                <span className={styles.eventMetaItem}><Clock size={11} />{item.startTime}{item.endTime ? ` – ${item.endTime}` : ''}</span>
                              )}
                              {item.isAllDay && <span className={styles.eventMetaItem}>All Day</span>}
                              {item.location && <span className={styles.eventMetaItem}><MapPin size={11} />{item.location}</span>}
                              {item.attendees && item.attendees.length > 0 && (
                                <span className={styles.eventMetaItem}><Users size={11} />{item.attendees.length} attendee{item.attendees.length !== 1 ? 's' : ''}</span>
                              )}
                            </div>
                          </div>
                          <div className={styles.eventBadges}>
                            {item.isShared && (
                              <span className={styles.statusBadge} style={{ background: '#eff6ff', color: '#1e40af' }}>
                                👥 Shared
                              </span>
                            )}
                            <span className={styles.statusBadge} style={{ background: t.bg, color: t.color }}>{t.label}</span>
                            <span className={styles.statusBadge} style={{ background: p.bg, color: p.color }}>{item.priority}</span>
                          </div>
                        </div>
                        {item.description && <p className={styles.eventDesc}>{item.description}</p>}
                        {item.notes && <p className={styles.eventNotes}>📝 {item.notes}</p>}
                      </div>

                      {/* Actions */}
                      {isAdmin && (
                        <div className={styles.eventCardActions}>
                          <FileUploadButton
                            itemId={item.id}
                            endpoint="/events"
                            hasFile={item.hasAttachment}
                            fileName={item.attachmentName}
                            fileData={item.attachmentData}
                            fileType={item.attachmentType}
                            onSuccess={fetchEvents}
                            label="Attach"
                          />
                          <button className={styles.iconEditBtn} onClick={() => openEdit(item)} title="Edit"><Edit2 size={13} /></button>
                          <button className={styles.iconDeleteBtn} onClick={() => handleDelete(item.id)} title="Delete"><Trash2 size={13} /></button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title={editItem ? 'Edit Event' : 'Add Event'} onClose={() => setShowModal(false)} size="lg">
          <form onSubmit={handleSubmit}>
            {/* Director selector — only show for new events or when admin */}
            {isAdmin && !editItem && (
              <DirectorSelector
                selected={selectedDirectors}
                onChange={setSelectedDirectors}
              />
            )}
            <FormField label="Title" required>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Event title" required />
            </FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Type">
                <Select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                  {Object.entries(TYPE_STYLES).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
                </Select>
              </FormField>
              <FormField label="Priority">
                <Select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">🟢 Low</option>
                </Select>
              </FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Start Date" required>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} required />
              </FormField>
              <FormField label="End Date">
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Start Time">
                <Input type="time" value={form.startTime} onChange={e => setForm(f => ({ ...f, startTime: e.target.value }))} />
              </FormField>
              <FormField label="End Time">
                <Input type="time" value={form.endTime} onChange={e => setForm(f => ({ ...f, endTime: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Location">
              <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Conference Room, Zoom link, etc." />
            </FormField>
            <FormField label="Attendees (comma separated)">
              <Input value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))} placeholder="Board Members, CFO, HR Manager" />
            </FormField>
            <FormField label="Description">
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Event description..." />
            </FormField>
            <FormField label="Notes">
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." />
            </FormField>
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <FormActions
              onCancel={() => setShowModal(false)}
              submitLabel={editItem ? 'Save Changes' : selectedDirectors.length > 1 ? `Share with ${selectedDirectors.length} Directors` : 'Add Event'}
              loading={saving}
            />
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Events;
