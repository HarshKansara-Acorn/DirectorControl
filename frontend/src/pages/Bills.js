import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDirector } from '../context/DirectorContext';
import api from '../services/api';
import Modal from '../components/modals/Modal';
import FormField, { Input, Textarea, Select, FormActions } from '../components/modals/FormField';
import { Receipt, Edit2, Trash2, Plus, CheckCircle } from 'lucide-react';
import styles from './PageLayout.module.css';

const STATUS_STYLES = {
  pending: { bg: '#fff7ed', color: '#c2410c', label: 'Pending' },
  paid: { bg: '#f0fdf4', color: '#15803d', label: 'Paid' },
  overdue: { bg: '#fef2f2', color: '#dc2626', label: 'Overdue' },
  cancelled: { bg: '#f8fafc', color: '#64748b', label: 'Cancelled' },
};

const EMPTY_FORM = { title: '', vendor: '', category: 'General', amount: '', currency: '₹', dueDate: '', invoiceNumber: '', notes: '' };

const Bills = () => {
  const { isAdmin } = useAuth();
  const { activeDirectorId, selectedDirector } = useDirector();
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchBills = useCallback(async () => {
    if (!activeDirectorId) return;
    setLoading(true);
    try {
      const res = await api.get('/bills', { params: { directorId: activeDirectorId } });
      setBills(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [activeDirectorId]);

  useEffect(() => { fetchBills(); }, [fetchBills]);

  const openAdd = () => { setEditItem(null); setForm(EMPTY_FORM); setError(''); setShowModal(true); };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({ title: item.title, vendor: item.vendor || '', category: item.category, amount: item.amount, currency: item.currency || '₹', dueDate: item.dueDate || '', invoiceNumber: item.invoiceNumber || '', notes: item.notes || '' });
    setError(''); setShowModal(true);
  };

  const handleMarkPaid = async (id) => {
    try { await api.patch(`/bills/${id}/status`, { status: 'paid' }); fetchBills(); }
    catch (err) { console.error(err); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      if (editItem) { await api.put(`/bills/${editItem.id}`, { ...form, directorId: activeDirectorId, amount: Number(form.amount) }); }
      else { await api.post('/bills', { ...form, directorId: activeDirectorId, amount: Number(form.amount) }); }
      setShowModal(false); fetchBills();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bill?')) return;
    try { await api.delete(`/bills/${id}`); fetchBills(); }
    catch (err) { console.error(err); }
  };

  const filtered = bills.filter(b => filterStatus === 'all' || b.status === filterStatus);
  const totalPending = bills.filter(b => b.status === 'pending').reduce((sum, b) => sum + b.amount, 0);
  const totalOverdue = bills.filter(b => b.status === 'overdue').reduce((sum, b) => sum + b.amount, 0);

  const formatAmount = (amount, currency = '₹') => `${currency}${Number(amount).toLocaleString('en-IN')}`;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Bills</h1>
          <p className={styles.subtitle}>{selectedDirector?.name} — {bills.filter(b => b.status === 'pending').length} pending bills</p>
        </div>
        <div className={styles.headerActions}>
          <select className={styles.filterSelect} value={filterStatus} onChange={e => setFilterStatus(e.target.value)} aria-label="Filter by status">
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="overdue">Overdue</option>
            <option value="cancelled">Cancelled</option>
          </select>
          {isAdmin && <button className={styles.addBtn} onClick={openAdd}><Plus size={15} /> Add Bill</button>}
        </div>
      </div>

      {/* Summary Stats */}
      {!loading && (
        <div className={styles.statsRow}>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Pending Amount</span>
            <span className={styles.statValue} style={{ color: '#c2410c' }}>{formatAmount(totalPending)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Overdue Amount</span>
            <span className={styles.statValue} style={{ color: '#dc2626' }}>{formatAmount(totalOverdue)}</span>
          </div>
          <div className={styles.statCard}>
            <span className={styles.statLabel}>Total Bills</span>
            <span className={styles.statValue}>{bills.length}</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className={styles.skeletonGrid}>{[...Array(4)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <Receipt size={40} className={styles.emptyIcon} />
          <p className={styles.emptyText}>No bills found</p>
          {isAdmin && <button className={styles.emptyAddBtn} onClick={openAdd}>Add Bill</button>}
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Bill</th>
                <th>Vendor</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Invoice #</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const s = STATUS_STYLES[item.status] || STATUS_STYLES.pending;
                return (
                  <tr key={item.id}>
                    <td>
                      <div className={styles.tableTitle}>{item.title}</div>
                      {item.notes && <div className={styles.tableSub}>{item.notes}</div>}
                    </td>
                    <td className={styles.tableCell}>{item.vendor || '—'}</td>
                    <td className={styles.tableCell}>{item.category}</td>
                    <td className={styles.tableCell} style={{ fontWeight: 600, color: '#1e293b' }}>{formatAmount(item.amount, item.currency)}</td>
                    <td className={styles.tableCell}>{item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className={styles.tableCell}>{item.invoiceNumber || '—'}</td>
                    <td>
                      <span className={styles.statusBadge} style={{ background: s.bg, color: s.color }}>{s.label}</span>
                    </td>
                    <td>
                      <div className={styles.tableActions}>
                        {item.status === 'pending' && (
                          <button className={styles.payBtn} onClick={() => handleMarkPaid(item.id)} title="Mark as Paid">
                            <CheckCircle size={13} /> Paid
                          </button>
                        )}
                        {isAdmin && <>
                          <button className={styles.iconEditBtn} onClick={() => openEdit(item)} title="Edit"><Edit2 size={13} /></button>
                          <button className={styles.iconDeleteBtn} onClick={() => handleDelete(item.id)} title="Delete"><Trash2 size={13} /></button>
                        </>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <Modal title={editItem ? 'Edit Bill' : 'Add Bill'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit}>
            <FormField label="Title" required>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Bill title" required />
            </FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Vendor">
                <Input value={form.vendor} onChange={e => setForm(f => ({ ...f, vendor: e.target.value }))} placeholder="Vendor name" />
              </FormField>
              <FormField label="Category">
                <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {['Rent', 'IT', 'Legal', 'Admin', 'Utilities', 'Marketing', 'General'].map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <FormField label="Amount" required>
                <Input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" required min="0" />
              </FormField>
              <FormField label="Currency">
                <Select value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                  <option value="₹">₹ INR</option>
                  <option value="$">$ USD</option>
                  <option value="£">£ GBP</option>
                  <option value="€">€ EUR</option>
                </Select>
              </FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Due Date">
                <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </FormField>
              <FormField label="Invoice Number">
                <Input value={form.invoiceNumber} onChange={e => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} placeholder="INV-2026-001" />
              </FormField>
            </div>
            <FormField label="Notes">
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." />
            </FormField>
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <FormActions onCancel={() => setShowModal(false)} submitLabel={editItem ? 'Save Changes' : 'Add Bill'} loading={saving} />
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Bills;
