import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDirector } from '../context/DirectorContext';
import api from '../services/api';
import Modal from '../components/modals/Modal';
import FormField, { Input, Textarea, Select, FormActions } from '../components/modals/FormField';
import { Users, Edit2, Trash2, Plus, Upload, Camera, X, Download } from 'lucide-react';
import styles from './FamilyTree.module.css';

// ── Relationship groups for visual grouping ───────────────────────────────────
const RELATIONSHIP_GROUPS = {
  'Spouse':       { color: '#dc2626', bg: '#fef2f2', emoji: '💑' },
  'Child':        { color: '#1e40af', bg: '#eff6ff', emoji: '👶' },
  'Son':          { color: '#1e40af', bg: '#eff6ff', emoji: '👦' },
  'Daughter':     { color: '#7c3aed', bg: '#faf5ff', emoji: '👧' },
  'Parent':       { color: '#15803d', bg: '#f0fdf4', emoji: '👨‍👩‍👦' },
  'Father':       { color: '#15803d', bg: '#f0fdf4', emoji: '👨' },
  'Mother':       { color: '#15803d', bg: '#f0fdf4', emoji: '👩' },
  'Sibling':      { color: '#d97706', bg: '#fffbeb', emoji: '👫' },
  'Brother':      { color: '#d97706', bg: '#fffbeb', emoji: '👦' },
  'Sister':       { color: '#d97706', bg: '#fffbeb', emoji: '👧' },
  'Grandparent':  { color: '#64748b', bg: '#f8fafc', emoji: '👴' },
  'Grandchild':   { color: '#0891b2', bg: '#ecfeff', emoji: '🧒' },
  'Other':        { color: '#64748b', bg: '#f8fafc', emoji: '👤' },
};

const getRelStyle = (rel) =>
  RELATIONSHIP_GROUPS[rel] || RELATIONSHIP_GROUPS['Other'];

const EMPTY_FORM = {
  name: '', relationship: 'Spouse', dateOfBirth: '',
  phone: '', email: '', notes: '',
};

const RELATIONSHIPS = Object.keys(RELATIONSHIP_GROUPS);

// ── Age calculator ────────────────────────────────────────────────────────────
const calcAge = (dob) => {
  if (!dob) return null;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
};

// ── Photo upload component ────────────────────────────────────────────────────
const PhotoUpload = ({ memberId, photoData, photoName, onSuccess, disabled }) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setError('Max 5MB'); return; }
    setError(''); setUploading(true);
    try {
      const data = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(file);
      });
      await api.post(`/family-tree/${memberId}/photo`, { photoData: data, photoName: file.name });
      onSuccess?.();
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed');
    } finally { setUploading(false); e.target.value = ''; }
  };

  const handleRemove = async () => {
    try {
      await api.delete(`/family-tree/${memberId}/photo`);
      onSuccess?.();
    } catch { setError('Remove failed'); }
  };

  return (
    <div className={styles.photoUpload}>
      <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.gif,.webp"
        className={styles.hiddenInput} onChange={handleFile} disabled={disabled || uploading} />
      {photoData ? (
        <div className={styles.photoPreview}>
          <img src={photoData} alt={photoName || 'Photo'} className={styles.photoImg} />
          {!disabled && (
            <div className={styles.photoOverlay}>
              <button className={styles.photoChangeBtn} onClick={() => inputRef.current?.click()} title="Change photo">
                <Camera size={14} />
              </button>
              <button className={styles.photoRemoveBtn} onClick={handleRemove} title="Remove photo">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      ) : (
        <button
          className={styles.photoPlaceholder}
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          type="button"
        >
          {uploading ? '...' : <><Camera size={16} /><span>Add Photo</span></>}
        </button>
      )}
      {error && <p className={styles.photoError}>{error}</p>}
    </div>
  );
};

// ── Excel import parser ───────────────────────────────────────────────────────
// Parses a CSV/Excel-exported CSV. Expected columns (case-insensitive):
// Name, Relationship, DateOfBirth, Phone, Email, Notes
const parseCSV = (text) => {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z]/g, ''));
  const members = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    const row = {};
    headers.forEach((h, idx) => { row[h] = cols[idx] || ''; });
    if (row.name) {
      members.push({
        name:         row.name,
        relationship: row.relationship || 'Other',
        dateOfBirth:  row.dateofbirth || row.dob || '',
        phone:        row.phone || row.mobile || '',
        email:        row.email || '',
        notes:        row.notes || row.note || '',
      });
    }
  }
  return members;
};

// ── Main page ─────────────────────────────────────────────────────────────────
const FamilyTree = () => {
  const { isAdmin } = useAuth();
  const { activeDirectorId, selectedDirector } = useDirector();

  const [members, setMembers]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [showModal, setShowModal]   = useState(false);
  const [editItem, setEditItem]     = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [filterRel, setFilterRel]   = useState('all');
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState([]);
  const [importing, setImporting]   = useState(false);
  const [importError, setImportError] = useState('');
  const importInputRef = useRef(null);

  const fetchMembers = useCallback(async () => {
    if (!activeDirectorId) return;
    setLoading(true);
    try {
      const res = await api.get('/family-tree', { params: { directorId: activeDirectorId } });
      setMembers(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [activeDirectorId]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const openAdd = () => {
    setEditItem(null); setForm(EMPTY_FORM); setError(''); setShowModal(true);
  };
  const openEdit = (item) => {
    setEditItem(item);
    setForm({
      name: item.name, relationship: item.relationship,
      dateOfBirth: item.dateOfBirth || '', phone: item.phone || '',
      email: item.email || '', notes: item.notes || '',
    });
    setError(''); setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true); setError('');
    try {
      const payload = { ...form, directorId: activeDirectorId };
      if (editItem) { await api.put(`/family-tree/${editItem.id}`, payload); }
      else { await api.post('/family-tree', payload); }
      setShowModal(false); fetchMembers();
    } catch (err) { setError(err.response?.data?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Remove this family member?')) return;
    try { await api.delete(`/family-tree/${id}`); fetchMembers(); }
    catch (err) { console.error(err); }
  };

  // ── Excel/CSV import ────────────────────────────────────────────────────────
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCSV(ev.target.result);
        if (parsed.length === 0) {
          setImportError('No valid rows found. Make sure the file has Name and Relationship columns.');
          return;
        }
        setImportData(parsed);
        setShowImport(true);
      } catch {
        setImportError('Failed to parse file. Please use CSV format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportConfirm = async () => {
    setImporting(true);
    try {
      const res = await api.post('/family-tree/bulk', {
        directorId: activeDirectorId,
        members: importData,
      });
      setShowImport(false);
      setImportData([]);
      fetchMembers();
      alert(`✅ ${res.data.message}`);
    } catch (err) {
      setImportError(err.response?.data?.message || 'Import failed');
    } finally { setImporting(false); }
  };

  // ── Download CSV template ───────────────────────────────────────────────────
  const downloadTemplate = () => {
    const csv = 'Name,Relationship,DateOfBirth,Phone,Email,Notes\n' +
      'John Smith,Son,1995-06-15,+44 7700 900000,john@example.com,Lives in London\n' +
      'Mary Smith,Daughter,1998-03-22,+44 7700 900001,mary@example.com,\n';
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'family_tree_template.csv';
    a.click(); URL.revokeObjectURL(url);
  };

  // ── Filtered & grouped members ──────────────────────────────────────────────
  const filtered = members.filter(m =>
    filterRel === 'all' || m.relationship === filterRel
  );

  const grouped = filtered.reduce((acc, m) => {
    const g = m.relationship;
    if (!acc[g]) acc[g] = [];
    acc[g].push(m);
    return acc;
  }, {});

  const relationships = [...new Set(members.map(m => m.relationship))];

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Family Tree</h1>
          <p className={styles.subtitle}>
            {selectedDirector?.name} — {members.length} family member{members.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className={styles.headerActions}>
          {/* Relationship filter */}
          <select
            className={styles.filterSelect}
            value={filterRel}
            onChange={e => setFilterRel(e.target.value)}
            aria-label="Filter by relationship"
          >
            <option value="all">All Relationships</option>
            {relationships.map(r => <option key={r} value={r}>{r}</option>)}
          </select>

          {isAdmin && (
            <>
              {/* CSV template download */}
              <button className={styles.templateBtn} onClick={downloadTemplate} title="Download CSV template">
                <Download size={14} /> Template
              </button>

              {/* Import from CSV/Excel */}
              <input
                ref={importInputRef}
                type="file"
                accept=".csv,.txt"
                className={styles.hiddenInput}
                onChange={handleImportFile}
              />
              <button className={styles.importBtn} onClick={() => importInputRef.current?.click()}>
                <Upload size={14} /> Import CSV
              </button>

              {/* Add member */}
              <button className={styles.addBtn} onClick={openAdd}>
                <Plus size={15} /> Add Member
              </button>
            </>
          )}
        </div>
      </div>

      {importError && (
        <div className={styles.importError}>{importError}</div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className={styles.skeletonGrid}>
          {[...Array(6)].map((_, i) => <div key={i} className={styles.skeletonCard} />)}
        </div>
      ) : members.length === 0 ? (
        <div className={styles.emptyState}>
          <Users size={48} className={styles.emptyIcon} />
          <h3 className={styles.emptyTitle}>No family members yet</h3>
          <p className={styles.emptyText}>
            Add family members manually or import from a CSV file.
          </p>
          {isAdmin && (
            <div className={styles.emptyActions}>
              <button className={styles.addBtn} onClick={openAdd}><Plus size={15} /> Add Member</button>
              <button className={styles.importBtn} onClick={() => importInputRef.current?.click()}>
                <Upload size={14} /> Import CSV
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.groups}>
          {Object.entries(grouped).map(([rel, groupMembers]) => {
            const rs = getRelStyle(rel);
            return (
              <div key={rel} className={styles.group}>
                <div className={styles.groupHeader}>
                  <span className={styles.groupEmoji}>{rs.emoji}</span>
                  <span className={styles.groupLabel} style={{ color: rs.color }}>{rel}</span>
                  <span className={styles.groupCount} style={{ background: rs.bg, color: rs.color }}>
                    {groupMembers.length}
                  </span>
                </div>
                <div className={styles.cardGrid}>
                  {groupMembers.map(m => {
                    const age = calcAge(m.dateOfBirth);
                    return (
                      <div key={m.id} className={styles.card}>
                        {/* Photo */}
                        <div className={styles.cardPhoto}>
                          {m.photoData ? (
                            <img src={m.photoData} alt={m.name} className={styles.cardPhotoImg} />
                          ) : (
                            <div className={styles.cardPhotoPlaceholder} style={{ background: rs.bg }}>
                              <span style={{ fontSize: 28 }}>{rs.emoji}</span>
                            </div>
                          )}
                          {isAdmin && (
                            <PhotoUpload
                              memberId={m.id}
                              photoData={m.photoData}
                              photoName={m.photoName}
                              onSuccess={fetchMembers}
                            />
                          )}
                        </div>

                        {/* Info */}
                        <div className={styles.cardBody}>
                          <h3 className={styles.cardName}>{m.name}</h3>
                          <span
                            className={styles.relBadge}
                            style={{ background: rs.bg, color: rs.color }}
                          >
                            {rs.emoji} {m.relationship}
                          </span>

                          <div className={styles.cardMeta}>
                            {m.dateOfBirth && (
                              <div className={styles.metaRow}>
                                <span className={styles.metaLabel}>🎂</span>
                                <span>
                                  {new Date(m.dateOfBirth).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                  {age !== null && <span className={styles.age}> · {age} yrs</span>}
                                </span>
                              </div>
                            )}
                            {m.phone && (
                              <div className={styles.metaRow}>
                                <span className={styles.metaLabel}>📞</span>
                                <span>{m.phone}</span>
                              </div>
                            )}
                            {m.email && (
                              <div className={styles.metaRow}>
                                <span className={styles.metaLabel}>📧</span>
                                <span className={styles.metaEmail}>{m.email}</span>
                              </div>
                            )}
                            {m.notes && (
                              <div className={styles.metaRow}>
                                <span className={styles.metaLabel}>📝</span>
                                <span className={styles.metaNotes}>{m.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions */}
                        {isAdmin && (
                          <div className={styles.cardActions}>
                            <button className={styles.editBtn} onClick={() => openEdit(m)}>
                              <Edit2 size={13} /> Edit
                            </button>
                            <button className={styles.deleteBtn} onClick={() => handleDelete(m.id)}>
                              <Trash2 size={13} /> Remove
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {showModal && (
        <Modal
          title={editItem ? `Edit — ${editItem.name}` : 'Add Family Member'}
          onClose={() => setShowModal(false)}
          size="lg"
        >
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Full Name" required>
                <Input
                  name="name" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Sarah Smith" required
                />
              </FormField>
              <FormField label="Relationship" required>
                <Select
                  name="relationship" value={form.relationship}
                  onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))}
                >
                  {RELATIONSHIPS.map(r => <option key={r} value={r}>{r}</option>)}
                </Select>
              </FormField>
            </div>
            <FormField label="Date of Birth">
              <Input
                type="date" name="dateOfBirth" value={form.dateOfBirth}
                onChange={e => setForm(f => ({ ...f, dateOfBirth: e.target.value }))}
              />
            </FormField>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <FormField label="Phone">
                <Input
                  name="phone" value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+44 7700 900000"
                />
              </FormField>
              <FormField label="Email">
                <Input
                  type="email" name="email" value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="name@example.com"
                />
              </FormField>
            </div>
            <FormField label="Notes">
              <Textarea
                name="notes" value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any additional notes..."
              />
            </FormField>
            {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
            <FormActions
              onCancel={() => setShowModal(false)}
              submitLabel={editItem ? 'Save Changes' : 'Add Member'}
              loading={saving}
            />
          </form>
        </Modal>
      )}

      {/* ── Import Preview Modal ── */}
      {showImport && (
        <Modal title={`Import ${importData.length} Family Members`} onClose={() => setShowImport(false)} size="lg">
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
              Review the data below before importing. All members will be added to{' '}
              <strong>{selectedDirector?.name}</strong>'s family tree.
            </p>
            <div className={styles.importTable}>
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Relationship</th>
                    <th>Date of Birth</th>
                    <th>Phone</th>
                    <th>Email</th>
                  </tr>
                </thead>
                <tbody>
                  {importData.map((m, i) => (
                    <tr key={i}>
                      <td>{m.name}</td>
                      <td>{m.relationship}</td>
                      <td>{m.dateOfBirth || '—'}</td>
                      <td>{m.phone || '—'}</td>
                      <td>{m.email || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {importError && <p style={{ color: '#ef4444', fontSize: 13, margin: '8px 0' }}>{importError}</p>}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 16 }}>
              <button
                style={{ padding: '8px 20px', background: 'var(--bg-muted)', border: '1.5px solid var(--border)', borderRadius: 8, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
                onClick={() => setShowImport(false)}
              >
                Cancel
              </button>
              <button
                style={{ padding: '8px 24px', background: 'linear-gradient(135deg,#1e40af,#3b82f6)', border: 'none', borderRadius: 8, color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                onClick={handleImportConfirm}
                disabled={importing}
              >
                {importing ? 'Importing...' : `Import ${importData.length} Members`}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default FamilyTree;
