import React, { useState } from 'react';
import Modal from './Modal';
import FormField, { Input, Textarea, FormActions } from './FormField';
import api from '../../services/api';

const AddTravelModal = ({ directorId, onClose, onSuccess }) => {
  const [form, setForm] = useState({ destination: '', purpose: '', departureDate: '', returnDate: '', notes: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/travel', { ...form, directorId });
      onSuccess();
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add travel reminder');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal title="Add Travel Reminder" onClose={onClose}>
      <form onSubmit={handleSubmit}>
        <FormField label="Destination" required>
          <Input name="destination" value={form.destination} onChange={handleChange} placeholder="e.g. Dubai, London" required />
        </FormField>
        <FormField label="Purpose">
          <Input name="purpose" value={form.purpose} onChange={handleChange} placeholder="Business Conference, Partner Meeting..." />
        </FormField>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <FormField label="Departure Date" required>
            <Input type="date" name="departureDate" value={form.departureDate} onChange={handleChange} required />
          </FormField>
          <FormField label="Return Date">
            <Input type="date" name="returnDate" value={form.returnDate} onChange={handleChange} />
          </FormField>
        </div>
        <FormField label="Notes">
          <Textarea name="notes" value={form.notes} onChange={handleChange} placeholder="Visa status, hotel booking, etc." />
        </FormField>
        {error && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <FormActions onCancel={onClose} submitLabel="Add Travel" loading={loading} />
      </form>
    </Modal>
  );
};

export default AddTravelModal;
