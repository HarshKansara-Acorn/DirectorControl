import React, { useState } from 'react';
import Modal from './Modal';
import FormField, { Input, Textarea, Select, FormActions } from './FormField';
import api from '../../services/api';

const EditEmailModal = ({ email, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    subject:  email.subject  || '',
    fromName: email.fromName || '',
    from:     email.from     || '',
    preview:  email.preview  || '',
    priority: email.priority || 'urgent',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await api.put(`/emails/${email.id}`, form);
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Edit Urgent Email" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <FormField label="Subject" required>
          <Input name="subject" value={form.subject} onChange={handleChange} placeholder="Email subject" required />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="From (Name)">
            <Input name="fromName" value={form.fromName} onChange={handleChange} placeholder="Sender name" />
          </FormField>
          <FormField label="From (Email)">
            <Input type="email" name="from" value={form.from} onChange={handleChange} placeholder="sender@company.com" />
          </FormField>
        </div>
        <FormField label="Preview">
          <Textarea name="preview" value={form.preview} onChange={handleChange} placeholder="Email preview text..." />
        </FormField>
        <FormField label="Priority">
          <Select name="priority" value={form.priority} onChange={handleChange}>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
          </Select>
        </FormField>
        {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <FormActions onCancel={onClose} submitLabel="Save Changes" loading={loading} />
      </form>
    </Modal>
  );
};

export default EditEmailModal;
