import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDirector } from '../context/DirectorContext';
import api from '../services/api';
import Modal from '../components/modals/Modal';
import FormField, { Input, Textarea, Select, FormActions } from '../components/modals/FormField';
import { Package, Edit2, Trash2, Plus, AlertTriangle } from 'lucide-react';
import styles from './PageLayout.module.css';

const STATUS_STYLES = {
  active: { bg: '#f0fdf4', color: '#15803d', label: 'Active' },
  maintenance: { bg: '#fff7ed', color: '#c2410c', label: 'Maintenance' },
  retired: { bg: '#f8fafc', color: '#64748b', label: 'Retired' },
  lost: { bg: '#fef2f2', color: '#dc2626', label: 'Lost' },
};

const CATEGORY_ICONS = { Electronics: '💻', Furniture: '🪑', Vehicle: '🚗', Equipment: '⚙️', General: '📦' };

const EMPTY_FORM = { name: '', description: '', category: 'Electronics', serialNumber: '', purchaseDate: '', purchaseValue: '', currency: '₹', location: '', warrantyExpiry: '', assignedTo: '' };

const Assets = () => {
  const { isAdmin } = useAuth();
  const { activeDirectorId, selectedDirector } = useDirector();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchAssets = useCallback(async () => {
    if (!activeDirectorId) return;
    setLoading(true);
    try {
      const res = await api.get('/assets', { params: { directorId: activeDirectorId } });
      setAssets(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [activeDirectorId]);

  useEffect(() => { fetchAssets(); }, [fetchAssets]);

  const openAdd = () => { setEditItem(null); setForm(EMPTY_FORM); setError(''); setShowModal(true); };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({ name: item.name, description: item.description || '', category: item.category, serialNumber: item.serialNumber || '', purchaseDate: item.purchaseDate || '', purchaseValue: item.purchaseValue || '', currency: item.currency || '₹', location: item.location || '', warrantyExpiry: item.warrantyExpiry || '', assignedTo: item.assignedTo || '' });
    setError(''); setShowModal(true);
  };

  const handleStatusChange = async (id, status) => {
    try { await api.patch(`/assets/${id}/status`, { status }); fetchAssets(); }
    catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, directorId: activeDirectorId, purchaseValue: Number(form.purchaseValue) };
      if (editItem) { await api.put(`/assets/${editItem.id}`, payload); }
      else { await api.post('/assets', payload); }
      setShowModal(false); fetchAssets();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this asset?')) return;
    try { await api.delete(`/assets/${id}`); fetchAssets(); }
    catch (err) { console.error(err); }
  };

  const filtered = assets.filter(a =>
    (filterCategory === 'all' || a.category === filterCategory) &&
    (filterStatus === 'all' || a.status === filterStatus)
  );

  const categories = [...new Set(assets.map(a => a.category))];
  const totalValue = assets.filter(a => a.status === 'active').reduce((sum, a) => sum + (a.currentValue || 0), 0);
  const isWarrantyExpiringSoon = (date) => { if (!date) return false; const diff = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24); return diff <= 30 && diff >= 0; };

  const formatAmount = (amount, currency = '₹') => `${currency}${Number(amount).toLocaleString('en-IN')}`;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Assets</h1>
          <p className={styles.subtitle}>{selectedDirector?.name} — {assets.filter(a => a.status === 'active').length} active assets</p>
        </div>
        <div className={styles.headerActions}>
          <select className={styles.filterSelect} value={filterCategory} onChange={e => setFilterCategory(e.target.value)} aria-label="Filter by category">
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className={styles.filterSelect} value={filterStatus} onChange={e => setFilterStatus(e.target.value)} aria-label="Filter by status">
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="maintenance">Maintenance</option>
            <option value="retired">Retired</option>
            <option value="lost">Lost</option>
          </select>
          {isAdmin && <button className={styles.addBtn} onClick={openAdd}><Plus size={15} /> Add Asset</button>}
        </div>
      </div>

      {/* Summary */}
      {!loading && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Asset Value</span>
            <span className={styles.statValue} style={{ color: '#1e40af' }}>{formatAmount(totalValue)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Active Assets</span>
            <span className={styles.statValue}>{assets.filter(a => a.status === 'active').length}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>In Maintenance</span>
            <span className={styles.statValue} style={{ color: '#c2410c' }}>{assets.filter(a => a.status === 'maintenance').length}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.skeletonGrid}>{[...Array(4)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <Package size={40} className={styles.emptyIcon} />
          <p className={styles.emptyText}>No assets found</p>
          {isAdmin && <button className={styles.emptyAddBtn} onClick={openAdd}>Add Asset</button>}
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {filtered.map(item => {
            const s = STATUS_STYLES[item.status] || STATUS_STYLES.active;
            const warrantyAlert = isWarrantyExpiringSoon(item.warrantyExpiry);
            return (
              <div key={item.id} className={`${styles.card} ${warrantyAlert ? styles.cardWarning : ''}`}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIconWrap} style={{ background: '#f1f5f9', fontSize: 22 }}>
                    {CATEGORY_ICONS[item.category] || CATEGORY_ICONS.General}
                  </div>
                  <div className={styles.cardTitleGroup}>
                    <h3 className={styles.cardTitle}>{item.name}</h3>
                    <p className={styles.cardSub}>{item.category} · {item.serialNumber || 'No S/N'}</p>
                  </div>
                  <span className={styles.statusBadge} style={{ background: s.bg, color: s.color }}>{s.label}</span>
                </div>
                <div className={styles.cardBody}>
                  {item.description && <p className={styles.cardDesc}>{item.description}</p>}
                  <div className={styles.metaGrid2}>
                    <div className={styles.metaItem2}>
                      <span className={styles.metaLabel2}>Value</span>
                      <span className={styles.metaValue2}>{formatAmount(item.currentValue || item.purchaseValue, item.currency)}</span>
                    </div>
                    <div className={styles.metaItem2}>
                      <span className={styles.metaLabel2}>Location</span>
                      <span className={styles.metaValue2}>{item.location || '—'}</span>
                    </div>
                    <div className={styles.metaItem2}>
                      <span className={styles.metaLabel2}>Assigned To</span>
                      <span className={styles.metaValue2}>{item.assignedTo || '—'}</span>
                    </div>
                    <div className={styles.metaItem2}>
                      <span className={styles.metaLabel2} style={{ color: warrantyAlert ? '#dc2626' : undefined }}>
                        {warrantyAlert && <AlertTriangle size={10} style={{ marginRight: 3 }} />}
                        Warranty
                      </span>
                      <span className={styles.metaValue2} style={{ color: warrantyAlert ? '#dc2626' : undefined }}>
                        {item.warrantyExpiry ? new Date(item.warrantyExpiry).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <div className={styles.cardActions}>
                    {item.status === 'active' && <button className={styles.editBtn} onClick={() => handleStatusChange(item.id, 'maintenance')}>⚙️ Maintenance</button>}
                    {item.status === 'maintenance' && <button className={styles.viewBtn} onClick={() => handleStatusChange(item.id, 'active')}>✓ Mark Active</button>}
                    <button className={styles.editBtn} onClick={() => openEdit(item)}><Edit2 size={13} /> Edit</button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(item.id)}><Trash2 size={13} /> Delete</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editItem ? 'Edit Asset' : 'Add Asset'} onClose={() => setShowModal(false)} size="lg">
          <form onSubmit={handleSubmit}>
            <FormField label="Asset Name" required>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. MacBook Pro 16&quot;" required />
            </FormField>
            <FormField label="Description">
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Asset description..." />
            </FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Category">
                <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {['Electronics', 'Furniture', 'Vehicle', 'Equipment', 'General'].map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FormField>
              <FormField label="Serial Number">
                <Input value={form.serialNumber} onChange={e => setForm(f => ({ ...f, serialNumber: e.target.value }))} placeholder="SN-2024-001" />
              </FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <FormField label="Purchase Value">
                <Input type="number" value={form.purchaseValue} onChange={e => setForm(f => ({ ...f, purchaseValue: e.target.value }))} placeholder="0" min="0" />
              </FormField>
              <FormField label="Currency">
                <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  <option value="₹">₹ INR</option>
                  <option value="$">$ USD</option>
                </Select>
              </FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Purchase Date">
                <Input type="date" value={form.purchaseDate} onChange={e => setForm(f => ({ ...f, purchaseDate: e.target.value }))} />
              </FormField>
              <FormField label="Warranty Expiry">
                <Input type="date" value={form.warrantyExpiry} onChange={e => setForm(f => ({ ...f, warrantyExpiry: e.target.value }))} />
              </FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Location">
                <Input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="Office Floor 3" />
              </FormField>
              <FormField label="Assigned To">
                <Input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Director name" />
              </FormField>
            </div>
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <FormActions onCancel={() => setShowModal(false)} submitLabel={editItem ? 'Save Changes' : 'Add Asset'} loading={saving} />
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Assets;
