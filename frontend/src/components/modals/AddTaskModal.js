import React, { useState, useEffect } from 'react';
import Modal from './Modal';
import FormField, { Input, Textarea, Select, FormActions } from './FormField';
import DirectorSelector from './DirectorSelector';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

const AddTaskModal = ({ directorId, onClose, onSuccess }) => {
  const { user, isAdmin } = useAuth();

  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium',
    status: 'todo', dueDate: '', dueTime: '', tags: '',
  });

  // Admin: assign to director(s). Director: assign to admin (PA).
  const [selectedDirectors, setSelectedDirectors] = useState(directorId ? [directorId] : []);
  const [adminUsers, setAdminUsers] = useState([]);
  const [selectedAdmin, setSelectedAdmin] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [result, setResult]   = useState('');

  // Directors need to pick which admin (PA) to assign to
  useEffect(() => {
    if (!isAdmin) {
      api.get('/users/admins').then(res => {
        setAdminUsers(res.data);
        if (res.data.length === 1) setSelectedAdmin(res.data[0].id);
      }).catch(() => {});
    }
  }, [isAdmin]);

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setLoading(true);

    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };

    try {
      if (isAdmin) {
        // Admin assigns to director(s)
        if (!selectedDirectors.length) { setError('Please select at least one director'); setLoading(false); return; }
        if (selectedDirectors.length === 1) {
          await api.post('/tasks', { ...payload, assignedTo: selectedDirectors[0] });
          setResult('Task created successfully!');
        } else {
          const res = await api.post('/tasks/broadcast', { ...payload, directorIds: selectedDirectors });
          setResult(res.data.message);
        }
      } else {
        // Director assigns to admin (PA)
        if (!selectedAdmin) { setError('Please select a PA to assign this task to'); setLoading(false); return; }
        await api.post('/tasks', { ...payload, assignedTo: selectedAdmin });
        setResult('Task sent to PA successfully!');
      }
      setTimeout(() => onSuccess(), 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title={isAdmin ? 'Assign Task to Director' : 'Send Task to PA'} onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>

        {/* Admin: pick director(s). Director: pick admin. */}
        {isAdmin ? (
          <DirectorSelector
            selected={selectedDirectors}
            onChange={setSelectedDirectors}
          />
        ) : (
          <FormField label="Assign to PA" required>
            {adminUsers.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading PA list...</p>
            ) : adminUsers.length === 1 ? (
              <div style={{
                padding: '10px 14px', background: 'var(--bg-subtle)',
                border: '1.5px solid var(--border)', borderRadius: 8,
                fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 18 }}>👤</span>
                {adminUsers[0].name}
                <span style={{ fontSize: 11, color: '#1e40af', background: '#eff6ff', padding: '2px 8px', borderRadius: 8, fontWeight: 600 }}>PA</span>
              </div>
            ) : (
              <Select value={selectedAdmin} onChange={e => setSelectedAdmin(e.target.value)} required>
                <option value="">Select PA...</option>
                {adminUsers.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
            )}
          </FormField>
        )}

        <FormField label="Task Title" required>
          <Input name="title" value={form.title} onChange={handleChange} placeholder="Enter task title" required />
        </FormField>
        <FormField label="Description">
          <Textarea name="description" value={form.description} onChange={handleChange} placeholder="Task description..." />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Priority">
            <Select name="priority" value={form.priority} onChange={handleChange}>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </Select>
          </FormField>
          <FormField label="Status">
            <Select name="status" value={form.status} onChange={handleChange}>
              <option value="todo">To Do</option>
              <option value="inprogress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Due Date &amp; Time">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <Input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} />
            <Input type="time" name="dueTime" value={form.dueTime} onChange={handleChange} />
          </div>
        </FormField>
        <FormField label="Tags (comma separated)">
          <Input name="tags" value={form.tags} onChange={handleChange} placeholder="Finance, HR, Legal" />
        </FormField>

        {error  && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {result && <p style={{ color: '#15803d', fontSize: 13, marginBottom: 12 }}>✅ {result}</p>}

        <FormActions
          onCancel={onClose}
          submitLabel={
            isAdmin
              ? (selectedDirectors.length > 1 ? `Assign to ${selectedDirectors.length} Directors` : 'Assign Task')
              : 'Send to PA'
          }
          loading={loading}
        />
      </form>
    </Modal>
  );
};

export default AddTaskModal;
