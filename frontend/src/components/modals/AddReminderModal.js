import React, { useState } from 'react';
import Modal from './Modal';
import FormField, { Input, Textarea, Select, FormActions } from './FormField';
import api from '../../services/api';

const AddReminderModal = ({ directorId, onClose, onSuccess }) => {
  const [form, setForm] = useState({ title: '', description: '', dueDate: '', priority: 'medium' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/reminders', { ...form, directorId });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add reminder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add Key Reminder" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <FormField label="Title" required>
          <Input name="title" value={form.title} onChange={handleChange} placeholder="Reminder title" required />
        </FormField>
        <FormField label="Description">
          <Textarea name="description" value={form.description} onChange={handleChange} placeholder="Details..." />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Due Date">
            <Input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} />
          </FormField>
          <FormField label="Priority">
            <Select name="priority" value={form.priority} onChange={handleChange}>
              <option value="high">🔴 High</option>
              <option value="medium">🟡 Medium</option>
              <option value="low">🟢 Low</option>
            </Select>
          </FormField>
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <FormActions onCancel={onClose} submitLabel="Add Reminder" loading={loading} />
      </form>
    </Modal>
  );
};

export default AddReminderModal;
