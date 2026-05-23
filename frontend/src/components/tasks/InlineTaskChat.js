/**
 * InlineTaskChat — renders a live chat thread directly inside a task card.
 * Polls every 8 seconds while open so both sides see new messages in real time.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import styles from './InlineTaskChat.module.css';

const ROLE_COLORS = {
  admin:    { bg: '#eff6ff', color: '#1e40af', label: 'PA' },
  director: { bg: '#f0fdf4', color: '#15803d', label: 'Director' },
};

const Avatar = ({ name, role, size = 24 }) => {
  const initials = (name || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  const rc = ROLE_COLORS[role] || ROLE_COLORS.director;
  return (
    <div
      className={styles.avatar}
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: rc.bg, color: rc.color,
        border: `1.5px solid ${rc.color}33`,
      }}
      title={name}
    >
      {initials}
    </div>
  );
};

const InlineTaskChat = ({ taskId, onCommentCountChange }) => {
  const { user, isAdmin } = useAuth();
  const [comments, setComments]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [text, setText]             = useState('');
  const [sending, setSending]       = useState(false);
  const bottomRef                   = useRef(null);
  const inputRef                    = useRef(null);
  const pollRef                     = useRef(null);

  // ── Fetch comments ──────────────────────────────────────────────────────────
  const fetchComments = useCallback(async (silent = false) => {
    try {
      const res = await api.get(`/tasks/${taskId}/comments`);
      setComments(res.data);
      onCommentCountChange?.(res.data.length);
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [taskId, onCommentCountChange]);

  const markAllAsRead = useCallback(async () => {
    if (!user?.id) return;
    const unreadIds = comments
      .filter(c => c.userId !== user.id && !c.isRead)
      .map(c => c.id);
    if (!unreadIds.length) return;

    try {
      await api.patch(`/tasks/${taskId}/comments/read-all`, { commentIds: unreadIds });
      setComments(prev => prev.map(c => c.userId !== user.id ? { ...c, isRead: true } : c));
    } catch (err) {
      console.error('Failed to mark comments as read:', err);
    }
  }, [comments, taskId, user?.id]);

  // Initial load + start polling
  useEffect(() => {
    fetchComments();
    pollRef.current = setInterval(() => fetchComments(true), 8000);
    return () => clearInterval(pollRef.current);
  }, [fetchComments]);

  useEffect(() => {
    if (!loading) markAllAsRead();
  }, [comments, loading, markAllAsRead]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  // Focus input when chat opens
  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // ── Send message ────────────────────────────────────────────────────────────
  const handleSend = async (e) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await api.post(`/tasks/${taskId}/comments`, { comment: trimmed });
      setComments(prev => [...prev, { ...res.data, isRead: true }]);
      onCommentCountChange?.(comments.length + 1);
      setText('');
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Delete comment ──────────────────────────────────────────────────────────
  const handleDelete = async (commentId) => {
    try {
      await api.delete(`/tasks/${taskId}/comments/${commentId}`);
      setComments(prev => prev.filter(c => c.id !== commentId));
      onCommentCountChange?.(comments.length - 1);
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const fmtTime = (ts) => {
    const d = new Date(ts);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={styles.chat} onClick={e => e.stopPropagation()}>
      {/* ── Message list ── */}
      <div className={styles.messages}>
        {loading ? (
          <div className={styles.loadingRow}>Loading chat...</div>
        ) : comments.length === 0 ? (
          <div className={styles.emptyRow}>
            <span>💬</span> No messages yet — start the conversation
          </div>
        ) : (
          comments.map(c => {
            const isOwn = c.userId === user?.id;
            const rc = ROLE_COLORS[c.userRole] || ROLE_COLORS.director;
            return (
                <div 
                  key={c.id} 
                  className={`${styles.msgRow} ${isOwn ? styles.msgRowOwn : ''}`}
                >
                {!isOwn && <Avatar name={c.userName} role={c.userRole} />}
                  <div className={`${styles.bubble} ${isOwn ? styles.bubbleOwn : ''} ${!c.isRead && !isOwn ? styles.bubbleUnread : ''}`}>
                  <div className={styles.bubbleMeta}>
                    {!isOwn && (
                      <span className={styles.bubbleAuthor}>{c.userName}</span>
                    )}
                    <span
                      className={styles.bubbleRole}
                      style={{ background: rc.bg, color: rc.color }}
                    >
                      {rc.label}
                    </span>
                    <span className={styles.bubbleTime}>{fmtTime(c.createdAt)}</span>
                    {(isOwn || isAdmin) && (
                      <button
                        className={styles.deleteBtn}
                        onClick={() => handleDelete(c.id)}
                        title="Delete"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                    <p className={`${styles.bubbleText} ${!c.isRead && !isOwn ? styles.bubbleTextUnread : ''}`}>{c.comment}</p>
                </div>
                {isOwn && <Avatar name={c.userName} role={c.userRole} />}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ── */}
      <form className={styles.inputRow} onSubmit={handleSend}>
        <Avatar name={user?.name} role={user?.role} size={26} />
        <div className={styles.inputWrap}>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Reply…"
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            maxLength={1000}
          />
          <button
            type="submit"
            className={styles.sendBtn}
            disabled={sending || !text.trim()}
            title="Send (Enter)"
          >
            {sending ? '…' : '➤'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InlineTaskChat;
