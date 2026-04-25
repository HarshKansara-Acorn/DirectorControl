import React, { useState } from 'react';
import Modal from './Modal';
import FormField, { Input, Textarea, Select, FormActions } from './FormField';
import DirectorSelector from './DirectorSelector';
import api from '../../services/api';

const AddTaskModal = ({ directorId, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium',
    status: 'todo', dueDate: '', tags: '',
  });
  // Pre-select the currently viewed director
  const [selectedDirectors, setSelectedDirectors] = useState(directorId ? [directorId] : []);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [result, setResult]   = useState('');

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDirectors.length) return setError('Please select at least one director');
    setError(''); setLoading(true);

    const payload = {
      ...form,
      tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };

    try {
      if (selectedDirectors.length === 1) {
        // Single director — use standard endpoint
        await api.post('/tasks', { ...payload, assignedTo: selectedDirectors[0] });
        setResult('Task created successfully!');
      } else {
        // Multiple directors — use broadcast endpoint
        const res = await api.post('/tasks/broadcast', { ...payload, directorIds: selectedDirectors });
        setResult(res.data.message);
      }
      setTimeout(() => onSuccess(), 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create task');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add New Task" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>

        {/* Director Selector */}
        <DirectorSelector
          selected={selectedDirectors}
          onChange={setSelectedDirectors}
        />

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
        <FormField label="Due Date">
          <Input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} />
        </FormField>
        <FormField label="Tags (comma separated)">
          <Input name="tags" value={form.tags} onChange={handleChange} placeholder="Finance, HR, Legal" />
        </FormField>

        {error  && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {result && <p style={{ color: '#15803d', fontSize: 13, marginBottom: 12 }}>✅ {result}</p>}

        <FormActions
          onCancel={onClose}
          submitLabel={selectedDirectors.length > 1 ? `Send to ${selectedDirectors.length} Directors` : 'Create Task'}
          loading={loading}
        />
      </form>
    </Modal>
  );
};

export default AddTaskModal;
