import React, { useState } from 'react';
import Modal from './Modal';
import FormField, { Input, Textarea, Select, FormActions } from './FormField';
import DirectorSelector from './DirectorSelector';
import api from '../../services/api';

const AddReminderModal = ({ directorId, onClose, onSuccess }) => {
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', dueTime: '', priority: 'medium' });
  const [selectedDirectors, setSelectedDirectors] = useState(directorId ? [directorId] : []);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [result, setResult]   = useState('');

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDirectors.length) return setError('Please select at least one director');
    setError(''); setLoading(true);

    try {
      if (selectedDirectors.length === 1) {
        await api.post('/reminders', { ...form, directorId: selectedDirectors[0] });
        setResult('Reminder added successfully!');
      } else {
        const res = await api.post('/reminders/broadcast', { ...form, directorIds: selectedDirectors });
        setResult(res.data.message);
      }
      setTimeout(() => onSuccess(), 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add reminder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add Key Reminder" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>

        <DirectorSelector
          selected={selectedDirectors}
          onChange={setSelectedDirectors}
        />

        <FormField label="Title" required>
          <Input name="title" value={form.title} onChange={handleChange} placeholder="Reminder title" required />
        </FormField>
        <FormField label="Description">
          <Textarea name="description" value={form.description} onChange={handleChange} placeholder="Details..." />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <FormField label="Due Date">
            <Input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} />
          </FormField>
          <FormField label="Due Time">
            <Input type="time" name="dueTime" value={form.dueTime} onChange={handleChange} />
          </FormField>
          <FormField label="Priority">
            <Select name="priority" value={form.priority} onChange={handleChange}>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </Select>
          </FormField>
        </div>

        {error  && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {result && <p style={{ color: '#15803d', fontSize: 13, marginBottom: 12 }}>✅ {result}</p>}

        <FormActions
          onCancel={onClose}
          submitLabel={selectedDirectors.length > 1 ? `Send to ${selectedDirectors.length} Directors` : 'Add Reminder'}
          loading={loading}
        />
      </form>
    </Modal>
  );
};

export default AddReminderModal;
