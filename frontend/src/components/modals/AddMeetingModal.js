import React, { useState } from 'react';
import Modal from './Modal';
import FormField, { Input, Textarea, FormActions } from './FormField';
import api from '../../services/api';

const AddMeetingModal = ({ directorId, onClose, onSuccess }) => {
  const [form, setForm] = useState({ title: '', description: '', date: '', time: '09:00', duration: 60, location: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/meetings', { ...form, directorId, duration: Number(form.duration) });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add meeting');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add Meeting" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <FormField label="Title" required>
          <Input name="title" value={form.title} onChange={handleChange} placeholder="Meeting title" required />
        </FormField>
        <FormField label="Description">
          <Textarea name="description" value={form.description} onChange={handleChange} placeholder="Meeting agenda..." />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Date" required>
            <Input type="date" name="date" value={form.date} onChange={handleChange} required />
          </FormField>
          <FormField label="Time">
            <Input type="time" name="time" value={form.time} onChange={handleChange} />
          </FormField>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Duration (minutes)">
            <Input type="number" name="duration" value={form.duration} onChange={handleChange} min={15} max={480} />
          </FormField>
          <FormField label="Location">
            <Input name="location" value={form.location} onChange={handleChange} placeholder="Conference Room A" />
          </FormField>
        </div>
        {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <FormActions onCancel={onClose} submitLabel="Add Meeting" loading={loading} />
      </form>
    </Modal>
  );
};

export default AddMeetingModal;
