import React, { useState } from 'react';
import Modal from './Modal';
import FormField, { Input, Textarea, FormActions } from './FormField';
import DirectorSelector from './DirectorSelector';
import api from '../../services/api';

const AddMeetingModal = ({ directorId, onClose, onSuccess }) => {
  const [form, setForm] = useState({
    title: '', description: '', date: '',
    time: '09:00', duration: 60, location: '',
  });
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
      const payload = {
        ...form,
        duration: Number(form.duration),
        // Pass directorIds array — backend handles shared vs individual
        directorIds: selectedDirectors,
        directorId: selectedDirectors[0],
      };
      await api.post('/meetings', payload);

      const count = selectedDirectors.length;
      setResult(count > 1
        ? `Meeting scheduled for all ${count} directors!`
        : 'Meeting added successfully!'
      );
      setTimeout(() => onSuccess(), 800);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add meeting');
    } finally {
      setLoading(false);
    }
  };

  const isShared = selectedDirectors.length > 1;

  return (
    <Modal title="Schedule Meeting" onClose={onClose} size="lg">
      <form onSubmit={handleSubmit}>

        {/* Director Selector */}
        <DirectorSelector
          selected={selectedDirectors}
          onChange={setSelectedDirectors}
        />

        <FormField label="Meeting Title" required>
          <Input name="title" value={form.title} onChange={handleChange} placeholder="e.g. Board Strategy Meeting" required />
        </FormField>
        <FormField label="Agenda / Description">
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
          <FormField label="Location / Link">
            <Input name="location" value={form.location} onChange={handleChange} placeholder="Conference Room A / Zoom link" />
          </FormField>
        </div>

        {/* Shared meeting indicator */}
        {isShared && (
          <div style={{
            padding: '10px 14px', background: '#eff6ff',
            border: '1px solid #bfdbfe', borderRadius: 8,
            fontSize: 13, color: '#1e40af', marginBottom: 12,
          }}>
            📢 <strong>Shared Meeting</strong> — This will appear on all {selectedDirectors.length} directors' dashboards as a single shared event.
          </div>
        )}

        {error  && <p style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {result && <p style={{ color: '#15803d', fontSize: 13, marginBottom: 12 }}>✅ {result}</p>}

        <FormActions
          onCancel={onClose}
          submitLabel={isShared ? `Schedule for All ${selectedDirectors.length} Directors` : 'Add Meeting'}
          loading={loading}
        />
      </form>
    </Modal>
  );
};

export default AddMeetingModal;
