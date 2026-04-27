import React, { useState } from 'react';
import Modal from './Modal';
import { Select, FormActions } from './FormField';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import styles from './TaskDetailModal.module.css';

const PRIORITY_COLORS = {
  high: { bg: '#fef2f2', color: '#dc2626' },
  medium: { bg: '#fff7ed', color: '#d97706' },
  low: { bg: '#f0fdf4', color: '#15803d' },
};

const TaskDetailModal = ({ task, onClose, onUpdate }) => {
  const { isAdmin } = useAuth();
  const [status, setStatus] = useState(task.status);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.patch(`/tasks/${task.id}/status`, { status });
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await api.delete(`/tasks/${task.id}`);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  const p = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;

  return (
    <Modal title="Task Details" onClose={onClose} size="lg">
      <div className={styles.detail}>
        {/* Title & Priority */}
        <div className={styles.titleRow}>
          <h2 className={styles.taskTitle}>{task.title}</h2>
          <span className={styles.priorityBadge} style={{ background: p.bg, color: p.color }}>
            {task.priority?.toUpperCase()}
          </span>
        </div>

        {/* Description */}
        {task.description && (
          <p className={styles.description}>{task.description}</p>
        )}

        {/* Meta */}
        <div className={styles.metaGrid}>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Due Date &amp; Time</span>
            <span className={styles.metaValue}>
              {task.dueDate
                ? new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
                : 'No due date'}
              {task.dueTime ? ` at ${task.dueTime}` : ''}
            </span>
          </div>
          <div className={styles.metaItem}>
            <span className={styles.metaLabel}>Created</span>
            <span className={styles.metaValue}>
              {new Date(task.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        </div>

        {/* Tags */}
        {task.tags && task.tags.length > 0 && (
          <div className={styles.tagsRow}>
            {task.tags.map(tag => (
              <span key={tag} className={styles.tag}>{tag}</span>
            ))}
          </div>
        )}

        {/* Status Update */}
        <div className={styles.statusSection}>
          <label className={styles.statusLabel}>Update Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="todo">To Do</option>
            <option value="inprogress">In Progress</option>
            <option value="review">Review</option>
            <option value="done">Done</option>
          </Select>
        </div>

        {/* Actions */}
        <div className={styles.actions}>
          {isAdmin && (
            <button className={styles.deleteBtn} onClick={handleDelete}>
              Delete Task
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
          <button className={styles.saveBtn} onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default TaskDetailModal;
