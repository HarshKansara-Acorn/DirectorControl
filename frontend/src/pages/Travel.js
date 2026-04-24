import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDirector } from '../context/DirectorContext';
import api from '../services/api';
import Modal from '../components/modals/Modal';
import FormField, { Input, Textarea, Select, FormActions } from '../components/modals/FormField';
import { Plane, MapPin, Calendar, Edit2, Trash2, Plus } from 'lucide-react';
import styles from './PageLayout.module.css';

const STATUS_STYLES = {
  upcoming: { bg: '#eff6ff', color: '#1e40af', label: 'Upcoming' },
  ongoing: { bg: '#f0fdf4', color: '#15803d', label: 'Ongoing' },
  completed: { bg: '#f8fafc', color: '#64748b', label: 'Completed' },
  cancelled: { bg: '#fef2f2', color: '#dc2626', label: 'Cancelled' },
};

const EMPTY_FORM = { destination: '', purpose: '', departureDate: '', returnDate: '', status: 'upcoming', notes: '' };

const Travel = () => {
  const { isAdmin } = useAuth();
  const { activeDirectorId, selectedDirector } = useDirector();
  const [travel, setTravel] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchTravel = useCallback(async () => {
    if (!activeDirectorId) return;
    setLoading(true);
    try {
      const res = await api.get('/travel', { params: { directorId: activeDirectorId } });
      setTravel(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [activeDirectorId]);

  useEffect(() => { fetchTravel(); }, [fetchTravel]);

  const openAdd = () => { setEditItem(null); setForm(EMPTY_FORM); setError(''); setShowModal(true); };
  const openEdit = (item) => { setEditItem(item); setForm({ destination: item.destination, purpose: item.purpose || '', departureDate: item.departureDate, returnDate: item.returnDate || '', status: item.status, notes: item.notes || '' }); setError(''); setShowModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editItem) {
        await api.put(`/travel/${editItem.id}`, { ...form, directorId: activeDirectorId });
      } else {
        await api.post('/travel', { ...form, directorId: activeDirectorId });
      }
      setShowModal(false);
      fetchTravel();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this travel record?')) return;
    try {
      await api.delete(`/travel/${id}`);
      fetchTravel();
    } catch (err) { console.error(err); }
  };

  const filtered = travel.filter(t => filterStatus === 'all' || t.status === filterStatus);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Travel</h1>
          <p className={styles.subtitle}>{selectedDirector?.name} — {travel.filter(t => t.status === 'upcoming').length} upcoming trips</p>
        </div>
        <div className={styles.headerActions}>
          <select className={styles.filterSelect} value={filterStatus} onChange={e => setFilterStatus(e.target.value)} aria-label="Filter by status">
            <option value="all">All Status</option>
            <option value="upcoming">Upcoming</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {isAdmin && (
            <button className={styles.addBtn} onClick={openAdd}>
              <Plus size={15} /> Add Travel
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className={styles.skeletonGrid}>
          {[...Array(4)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <Plane size={40} className={styles.emptyIcon} />
          <p className={styles.emptyText}>No travel records found</p>
          {isAdmin && <button className={styles.emptyAddBtn} onClick={openAdd}>Add Travel</button>}
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {filtered.map(item => {
            const s = STATUS_STYLES[item.status] || STATUS_STYLES.upcoming;
            return (
              <div key={item.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIconWrap} style={{ background: '#eff6ff' }}>
                    <Plane size={20} color="#1e40af" />
                  </div>
                  <div className={styles.cardTitleGroup}>
                    <h3 className={styles.cardTitle}>{item.destination}</h3>
                    <p className={styles.cardSub}>{item.purpose || 'Business Travel'}</p>
                  </div>
                  <span className={styles.statusBadge} style={{ background: s.bg, color: s.color }}>{s.label}</span>
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.metaRow}>
                    <Calendar size={13} color="#94a3b8" />
                    <span>{formatDate(item.departureDate)}{item.returnDate ? ` → ${formatDate(item.returnDate)}` : ''}</span>
                  </div>
                  {item.notes && (
                    <div className={styles.metaRow}>
                      <MapPin size={13} color="#94a3b8" />
                      <span>{item.notes}</span>
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <div className={styles.cardActions}>
                    <button className={styles.editBtn} onClick={() => openEdit(item)}><Edit2 size={13} /> Edit</button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(item.id)}><Trash2 size={13} /> Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <Modal title={editItem ? 'Edit Travel' : 'Add Travel'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit}>
            <FormField label="Destination" required>
              <Input name="destination" value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} placeholder="e.g. Dubai, London" required />
            </FormField>
            <FormField label="Purpose">
              <Input name="purpose" value={form.purpose} onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))} placeholder="Business Conference, Partner Meeting..." />
            </FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Departure Date" required>
                <Input type="date" value={form.departureDate} onChange={e => setForm(f => ({ ...f, departureDate: e.target.value }))} required />
              </FormField>
              <FormField label="Return Date">
                <Input type="date" value={form.returnDate} onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Status">
              <Select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </FormField>
            <FormField label="Notes">
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Visa status, hotel booking, etc." />
            </FormField>
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <FormActions onCancel={() => setShowModal(false)} submitLabel={editItem ? 'Save Changes' : 'Add Travel'} loading={saving} />
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Travel;
