import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDirector } from '../context/DirectorContext';
import api from '../services/api';
import Modal from '../components/modals/Modal';
import FormField, { Input, Textarea, Select, FormActions } from '../components/modals/FormField';
import FileUploadButton from '../components/common/FileUploadButton';
import { FileText, Edit2, Trash2, Plus, AlertTriangle } from 'lucide-react';
import styles from './PageLayout.module.css';

const FILE_ICONS = { pdf: '📄', docx: '📝', xlsx: '📊', pptx: '📋', default: '📁' };
const CATEGORY_COLORS = {
  Finance: { bg: '#f0fdf4', color: '#15803d' },
  Legal: { bg: '#faf5ff', color: '#7c3aed' },
  HR: { bg: '#fff7ed', color: '#c2410c' },
  IT: { bg: '#eff6ff', color: '#1e40af' },
  Admin: { bg: '#f8fafc', color: '#64748b' },
  General: { bg: '#f8fafc', color: '#64748b' },
};

const EMPTY_FORM = { title: '', description: '', category: 'General', fileName: '', fileSize: '', fileType: 'pdf', expiryDate: '', expiryTime: '', tags: '' };

const Documents = () => {
  const { isAdmin } = useAuth();
  const { activeDirectorId, selectedDirector } = useDirector();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('all');
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchDocuments = useCallback(async () => {
    if (!activeDirectorId) return;
    setLoading(true);
    try {
      const res = await api.get('/documents', { params: { directorId: activeDirectorId } });
      setDocuments(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [activeDirectorId]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const openAdd = () => { setEditItem(null); setForm(EMPTY_FORM); setError(''); setShowModal(true); };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({ title: item.title, description: item.description || '', category: item.category, fileName: item.fileName || '', fileSize: item.fileSize || '', fileType: item.fileType || 'pdf', expiryDate: item.expiryDate || '', expiryTime: item.expiryTime || '', tags: (item.tags || []).join(', ') });
    setError(''); setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, directorId: activeDirectorId, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] };
      if (editItem) { await api.put(`/documents/${editItem.id}`, payload); }
      else { await api.post('/documents', payload); }
      setShowModal(false); fetchDocuments();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this document?')) return;
    try { await api.delete(`/documents/${id}`); fetchDocuments(); }
    catch (err) { console.error(err); }
  };

  const filtered = documents.filter(d => filterCategory === 'all' || d.category === filterCategory);
  const categories = [...new Set(documents.map(d => d.category))];
  const isExpiringSoon = (date) => { if (!date) return false; const diff = (new Date(date) - new Date()) / (1000 * 60 * 60 * 24); return diff <= 30 && diff >= 0; };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Documents</h1>
          <p className={styles.subtitle}>{selectedDirector?.name} — {documents.length} document{documents.length !== 1 ? 's' : ''}</p>
        </div>
        <div className={styles.headerActions}>
          <select className={styles.filterSelect} value={filterCategory} onChange={e => setFilterCategory(e.target.value)} aria-label="Filter by category">
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {isAdmin && <button className={styles.addBtn} onClick={openAdd}><Plus size={15} /> Add Document</button>}
        </div>
      </div>

      {loading ? (
        <div className={styles.skeletonGrid}>{[...Array(4)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}</div>
      ) : filtered.length === 0 ? (
        <div className={styles.emptyState}>
          <FileText size={40} className={styles.emptyIcon} />
          <p className={styles.emptyText}>No documents found</p>
          {isAdmin && <button className={styles.emptyAddBtn} onClick={openAdd}>Add Document</button>}
        </div>
      ) : (
        <div className={styles.cardGrid}>
          {filtered.map(item => {
            const cat = CATEGORY_COLORS[item.category] || CATEGORY_COLORS.General;
            const expiring = isExpiringSoon(item.expiryDate);
            return (
              <div key={item.id} className={`${styles.card} ${expiring ? styles.cardWarning : ''}`}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardIconWrap} style={{ background: cat.bg, fontSize: 22 }}>
                    {FILE_ICONS[item.fileType] || FILE_ICONS.default}
                  </div>
                  <div className={styles.cardTitleGroup}>
                    <h3 className={styles.cardTitle}>{item.title}</h3>
                    <p className={styles.cardSub}>{item.fileName || 'No file attached'}</p>
                  </div>
                  <span className={styles.statusBadge} style={{ background: cat.bg, color: cat.color }}>{item.category}</span>
                </div>
                <div className={styles.cardBody}>
                  {item.description && <p className={styles.cardDesc}>{item.description}</p>}
                  <div className={styles.metaRow}>
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{item.fileSize || 'Unknown size'}</span>
                    {item.expiryDate && (
                      <span style={{ fontSize: 11, color: expiring ? '#dc2626' : '#94a3b8', display: 'flex', alignItems: 'center', gap: 4 }}>
                        {expiring && <AlertTriangle size={11} />}
                        Expires: {new Date(item.expiryDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                  {item.tags && item.tags.length > 0 && (
                    <div className={styles.tagsRow}>
                      {item.tags.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
                    </div>
                  )}
                </div>
                <div className={styles.cardActions}>
                  <FileUploadButton
                    itemId={item.id}
                    endpoint="/documents"
                    hasFile={item.hasFile}
                    fileName={item.fileName}
                    fileData={item.fileData}
                    fileType={item.fileType}
                    onSuccess={fetchDocuments}
                    disabled={!isAdmin}
                    label="Attach File"
                  />
                  {isAdmin && <>
                    <button className={styles.editBtn} onClick={() => openEdit(item)}><Edit2 size={13} /> Edit</button>
                    <button className={styles.deleteBtn} onClick={() => handleDelete(item.id)}><Trash2 size={13} /> Delete</button>
                  </>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editItem ? 'Edit Document' : 'Add Document'} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit}>
            <FormField label="Title" required>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Document title" required />
            </FormField>
            <FormField label="Description">
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description..." />
            </FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Category">
                <Select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {['Finance', 'Legal', 'HR', 'IT', 'Admin', 'General'].map(c => <option key={c} value={c}>{c}</option>)}
                </Select>
              </FormField>
              <FormField label="File Type">
                <Select value={form.fileType} onChange={e => setForm(f => ({ ...f, fileType: e.target.value }))}>
                  {['pdf', 'docx', 'xlsx', 'pptx', 'other'].map(t => <option key={t} value={t}>{t.toUpperCase()}</option>)}
                </Select>
              </FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="File Name">
                <Input value={form.fileName} onChange={e => setForm(f => ({ ...f, fileName: e.target.value }))} placeholder="filename.pdf" />
              </FormField>
              <FormField label="File Size">
                <Input value={form.fileSize} onChange={e => setForm(f => ({ ...f, fileSize: e.target.value }))} placeholder="e.g. 2.4 MB" />
              </FormField>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Expiry Date">
                <Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} />
              </FormField>
              <FormField label="Expiry Time">
                <Input type="time" value={form.expiryTime} onChange={e => setForm(f => ({ ...f, expiryTime: e.target.value }))} />
              </FormField>
            </div>
            <FormField label="Tags (comma separated)">
              <Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="Finance, Legal, Board" />
            </FormField>
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <FormActions onCancel={() => setShowModal(false)} submitLabel={editItem ? 'Save Changes' : 'Add Document'} loading={saving} />
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Documents;
