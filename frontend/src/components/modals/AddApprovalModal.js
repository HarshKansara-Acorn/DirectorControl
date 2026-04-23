import React, { useState } from 'react';
import Modal from './Modal';
import FormField, { Input, Textarea, Select, FormActions } from './FormField';
import api from '../../services/api';

const AddApprovalModal = ({ directorId, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    type: 'leave', title: '', description: '',
    fromName: '', fromEmail: '', priority: 'normal', dueDate: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/approvals', { ...form, directorId });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add approval');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add Pending Approval" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Type">
            <Select name="type" value={form.type} onChange={handleChange}>
              <option value="leave">Leave</option>
              <option value="expense">Expense</option>
              <option value="document">Document</option>
              <option value="general">General</option>
            </Select>
          </FormField>
          <FormField label="Priority">
            <Select name="priority" value={form.priority} onChange={handleChange}>
              <option value="urgent">Urgent</option>
              <option value="high">High</option>
              <option value="normal">Normal</option>
            </Select>
          </FormField>
        </div>
        <FormField label="Title" required>
          <Input name="title" value={form.title} onChange={handleChange} placeholder="Approval title" required />
        </FormField>
        <FormField label="Description">
          <Textarea name="description" value={form.description} onChange={handleChange} placeholder="Details..." />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="From (Name)">
            <Input name="fromName" value={form.fromName} onChange={handleChange} placeholder="Employee name" />
          </FormField>
          <FormField label="From (Email)">
            <Input type="email" name="fromEmail" value={form.fromEmail} onChange={handleChange} placeholder="email@company.com" />
          </FormField>
        </div>
        <FormField label="Due Date">
          <Input type="date" name="dueDate" value={form.dueDate} onChange={handleChange} />
        </FormField>
        {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <FormActions onCancel={onClose} submitLabel="Add Approval" loading={loading} />
      </form>
    </Modal>
  );
};

export default AddApprovalModal;
