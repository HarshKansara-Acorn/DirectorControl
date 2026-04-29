import React, { useState } from 'react';
import Modal from './Modal';
import FormField, { Input, Textarea, Select, FormActions } from './FormField';
import api from '../../services/api';

const EditReminderModal = ({ reminder, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    title:       reminder.title       || '',
    description: reminder.description || '',
    dueDate:     reminder.dueDate     || '',
    dueTime:     reminder.dueTime     || '',
    priority:    reminder.priority    || 'medium',
    isActive:    reminder.isActive !== false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(f => ({ ...f, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.put(`/reminders/${reminder.id}`, form);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update reminder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Edit Reminder" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>
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
        <FormField label="Status">
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              name="isActive"
              checked={form.isActive}
              onChange={handleChange}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            Active (uncheck to deactivate this reminder)
          </label>
        </FormField>
        {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <FormActions onCancel={onClose} submitLabel="Save Changes" loading={loading} />
      </form>
    </Modal>
  );
};

export default EditReminderModal;
