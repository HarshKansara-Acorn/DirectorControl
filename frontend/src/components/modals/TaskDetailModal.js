import React, { useState, useEffect, useRef, useCallback } from 'react';
import Modal from './Modal';
import { Select } from './FormField';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import styles from './TaskDetailModal.module.css';

const PRIORITY_COLORS = {
  high:   { bg: '#fef2f2', color: '#dc2626' },
  medium: { bg: '#fff7ed', color: '#d97706' },
  low:    { bg: '#f0fdf4', color: '#15803d' },
};

const ROLE_COLORS = {
  admin:    { bg: '#eff6ff', color: '#1e40af', label: 'PA' },
  director: { bg: '#f0fdf4', color: '#15803d', label: 'Director' },
};

// ── Avatar bubble ─────────────────────────────────────────────────────────────
const Avatar = ({ name, role, size = 28 }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const rc = ROLE_COLORS[role] || ROLE_COLORS.director;
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: rc.bg, color: rc.color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.38, fontWeight: 700, flexShrink: 0,
      border: `1.5px solid ${rc.color}22`,
    }}>
      {initials}
    </div>
  );
};

// ── Single comment row ────────────────────────────────────────────────────────
const CommentRow = ({ comment, currentUserId, isAdmin, onDelete }) => {
  const isOwn = comment.userId === currentUserId;
  const rc = ROLE_COLORS[comment.userRole] || ROLE_COLORS.director;
  const time = new Date(comment.createdAt).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });

  return (
    <div className={`${styles.commentRow} ${isOwn ? styles.commentRowOwn : ''}`}>
      {!isOwn && <Avatar name={comment.userName} role={comment.userRole} />}
      <div className={`${styles.commentBubble} ${isOwn ? styles.commentBubbleOwn : ''} ${!isOwn && !comment.isRead ? styles.commentBubbleUnread : ''}`}>
        <div className={styles.commentMeta}>
          <span className={styles.commentAuthor}>{comment.userName}</span>
          <span className={styles.commentRole} style={{ background: rc.bg, color: rc.color }}>
            {rc.label}
          </span>
          <span className={styles.commentTime}>{time}</span>
          {(isOwn || isAdmin) && (
            <button className={styles.commentDelete} onClick={() => onDelete(comment.id)} title="Delete">✕</button>
          )}
        </div>
        <p className={`${styles.commentText} ${!isOwn && !comment.isRead ? styles.commentTextUnread : ''}`}>{comment.comment}</p>
      </div>
      {isOwn && <Avatar name={comment.userName} role={comment.userRole} />}
    </div>
  );
};

// ── Main modal ────────────────────────────────────────────────────────────────
const TaskDetailModal = ({ task, onClose, onUpdate }) => {
  const { user, isAdmin } = useAuth();
  const [status, setStatus]       = useState(task.status);
  const [comments, setComments]   = useState([]);
  const [newComment, setNewComment] = useState('');
  const [loadingComments, setLoadingComments] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [activeTab, setActiveTab] = useState('details'); // 'details' | 'comments'
  const commentsEndRef = useRef(null);

  const p  = PRIORITY_COLORS[task.priority] || PRIORITY_COLORS.medium;
  const isCreator  = task.createdBy  === user?.id;
  const isAssignee = task.assignedTo === user?.id;
  const canEdit    = isAdmin || isCreator;
  const canDelete  = isAdmin || isCreator;

  // ── Load comments ──────────────────────────────────────────────────────────
  const fetchComments = async () => {
    try {
      const res = await api.get(`/tasks/${task.id}/comments`);
      setComments(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingComments(false);
    }
  };

  useEffect(() => { fetchComments(); }, [task.id]); // eslint-disable-line

  const markAllCommentsAsRead = useCallback(async () => {
    if (!user?.id || !comments.length) return;
    const unreadIds = comments
      .filter(c => c.userId !== user.id && !c.isRead)
      .map(c => c.id);
    if (!unreadIds.length) return;

    try {
      await api.patch(`/tasks/${task.id}/comments/read-all`, { commentIds: unreadIds });
      setComments(prev => prev.map(c => c.userId !== user.id ? { ...c, isRead: true } : c));
    } catch (err) {
      console.error('Failed to mark comments as read:', err);
    }
  }, [comments, task.id, user?.id]);

  useEffect(() => {
    if (activeTab === 'comments') {
      markAllCommentsAsRead();
      commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, activeTab, markAllCommentsAsRead]);

  // ── Save status ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await api.patch(`/tasks/${task.id}/status`, { status });
      onUpdate();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Delete task ────────────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    try {
      await api.delete(`/tasks/${task.id}`);
      onUpdate();
    } catch (err) {
      console.error(err);
    }
  };

  // ── Post comment ───────────────────────────────────────────────────────────
  const handlePostComment = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post(`/tasks/${task.id}/comments`, { comment: newComment.trim() });
      setComments(prev => [...prev, res.data]);
      setNewComment('');
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Delete comment ─────────────────────────────────────────────────────────
  const handleDeleteComment = async (commentId) => {
    try {
      await api.delete(`/tasks/${task.id}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
    } catch (err) {
      console.error(err);
    }
  };

  const directionLabel = isCreator && !isAssignee
    ? `→ ${task.assignedToName || 'Assignee'}`
    : `← from ${task.createdByName || 'Creator'}`;

  return (
    <Modal title="Task" onClose={onClose} size="lg">
      <div className={styles.detail}>

        {/* ── Header ── */}
        <div className={styles.titleRow}>
          <div className={styles.titleGroup}>
            <h2 className={styles.taskTitle}>{task.title}</h2>
            <div className={styles.directionBadge}>
              <span className={styles.directionText}>{directionLabel}</span>
            </div>
          </div>
          <span className={styles.priorityBadge} style={{ background: p.bg, color: p.color }}>
            {task.priority?.toUpperCase()}
          </span>
        </div>

        {/* ── Participants strip ── */}
        <div className={styles.participantsRow}>
          <div className={styles.participant}>
            <Avatar name={task.createdByName} role={task.createdByRole} size={26} />
            <div className={styles.participantInfo}>
              <span className={styles.participantLabel}>Created by</span>
              <span className={styles.participantName}>{task.createdByName || 'Unknown'}</span>
            </div>
          </div>
          <div className={styles.participantArrow}>→</div>
          <div className={styles.participant}>
            <Avatar name={task.assignedToName} role={task.assignedToRole} size={26} />
            <div className={styles.participantInfo}>
              <span className={styles.participantLabel}>Assigned to</span>
              <span className={styles.participantName}>{task.assignedToName || 'Unknown'}</span>
            </div>
          </div>
          <div className={styles.commentCountBadge} onClick={() => setActiveTab('comments')}>
            💬 {comments.length}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tab} ${activeTab === 'details' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('details')}
          >
            Details
          </button>
          <button
            className={`${styles.tab} ${activeTab === 'comments' ? styles.tabActive : ''}`}
            onClick={() => setActiveTab('comments')}
          >
            Comments {comments.length > 0 && <span className={styles.tabBadge}>{comments.length}</span>}
          </button>
        </div>

        {/* ── Details Tab ── */}
        {activeTab === 'details' && (
          <div className={styles.tabContent}>
            {task.description && (
              <p className={styles.description}>{task.description}</p>
            )}

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

            {task.tags && task.tags.length > 0 && (
              <div className={styles.tagsRow}>
                {task.tags.map(tag => (
                  <span key={tag} className={styles.tag}>{tag}</span>
                ))}
              </div>
            )}

            {/* Status update — both assignee and creator can change */}
            <div className={styles.statusSection}>
              <label className={styles.statusLabel}>Status</label>
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="todo">To Do</option>
                <option value="inprogress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </Select>
            </div>

            <div className={styles.actions}>
              {canDelete && (
                <button className={styles.deleteBtn} onClick={handleDelete}>Delete</button>
              )}
              <div style={{ flex: 1 }} />
              <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
              <button className={styles.saveBtn} onClick={handleSave} disabled={saving}>
                {saving ? 'Saving...' : 'Save Status'}
              </button>
            </div>
          </div>
        )}

        {/* ── Comments Tab ── */}
        {activeTab === 'comments' && (
          <div className={styles.tabContent}>
            <div className={styles.commentsList}>
              {loadingComments ? (
                <div className={styles.commentsLoading}>Loading messages...</div>
              ) : comments.length === 0 ? (
                <div className={styles.commentsEmpty}>
                  <span>💬</span>
                  <p>No messages yet. Start the conversation!</p>
                </div>
              ) : (
                comments.map(c => (
                  <CommentRow
                    key={c.id}
                    comment={c}
                    currentUserId={user?.id}
                    isAdmin={isAdmin}
                    onDelete={handleDeleteComment}
                  />
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Comment input */}
            <form className={styles.commentForm} onSubmit={handlePostComment}>
              <Avatar name={user?.name} role={user?.role} size={30} />
              <div className={styles.commentInputWrap}>
                <textarea
                  className={styles.commentInput}
                  placeholder="Write a message..."
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePostComment(e); }
                  }}
                  rows={2}
                />
                <button
                  type="submit"
                  className={styles.commentSendBtn}
                  disabled={submitting || !newComment.trim()}
                >
                  {submitting ? '...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default TaskDetailModal;
