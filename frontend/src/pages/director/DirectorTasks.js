import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import api from '../../services/api';
import styles from './DirectorTasks.module.css';

const COLUMNS = [
  { id: 'todo',       label: 'To Do',       color: '#64748b', bg: 'var(--bg-subtle)' },
  { id: 'inprogress', label: 'In Progress',  color: '#d97706', bg: '#fffbeb' },
  { id: 'review',     label: 'Review',       color: '#7c3aed', bg: '#faf5ff' },
  { id: 'done',       label: 'Done',         color: '#15803d', bg: '#f0fdf4' },
];

const PRIORITY = {
  high:   { bg: '#fef2f2', color: '#dc2626', label: '🔴 High' },
  medium: { bg: '#fff7ed', color: '#d97706', label: '🟡 Medium' },
  low:    { bg: '#f0fdf4', color: '#15803d', label: '🟢 Low' },
};

const DirectorTasks = () => {
  const [tasks, setTasks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterPriority, setFilter]     = useState('all');
  const [selectedTask, setSelectedTask] = useState(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks');
      setTasks(res.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleDragEnd = async ({ destination, source, draggableId }) => {
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const newStatus = destination.droppableId;
    setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: newStatus } : t));
    try {
      await api.patch(`/tasks/${draggableId}/status`, { status: newStatus });
    } catch { fetchTasks(); }
  };

  const filtered = tasks.filter(t => filterPriority === 'all' || t.priority === filterPriority);
  const today = new Date().toISOString().split('T')[0];
  const done = tasks.filter(t => t.status === 'done').length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Tasks</h1>
          <p className={styles.subtitle}>{done}/{tasks.length} tasks completed</p>
        </div>
        <select
          className={styles.filterSelect}
          value={filterPriority}
          onChange={e => setFilter(e.target.value)}
          aria-label="Filter by priority"
        >
          <option value="all">All Priorities</option>
          <option value="high">🔴 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
      </div>

      {loading ? (
        <div className={styles.loadingBoard}>
          {COLUMNS.map(c => <div key={c.id} className={styles.skeletonCol} />)}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className={styles.board}>
            {COLUMNS.map(col => {
              const colTasks = filtered.filter(t => t.status === col.id);
              return (
                <div key={col.id} className={styles.column}>
                  <div className={styles.colHeader}>
                    <div className={styles.colTitleGroup}>
                      <div className={styles.colDot} style={{ background: col.color }} />
                      <span className={styles.colTitle}>{col.label}</span>
                    </div>
                    <span className={styles.colCount} style={{ background: col.bg, color: col.color }}>
                      {colTasks.length}
                    </span>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`${styles.droppable} ${snapshot.isDraggingOver ? styles.droppableOver : ''}`}
                      >
                        {colTasks.length === 0 && !snapshot.isDraggingOver && (
                          <div className={styles.emptyCol}>No tasks</div>
                        )}
                        {colTasks.map((task, idx) => {
                          const p = PRIORITY[task.priority] || PRIORITY.medium;
                          const isOverdue = task.dueDate && task.dueDate < today && task.status !== 'done';
                          return (
                            <Draggable key={task.id} draggableId={task.id} index={idx}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`${styles.taskCard} ${snapshot.isDragging ? styles.dragging : ''} ${isOverdue ? styles.taskCardOverdue : ''}`}
                                  onClick={() => setSelectedTask(task)}
                                >
                                  <div className={styles.taskBar} style={{ background: p.color }} />
                                  <div className={styles.taskBody}>
                                    {isOverdue && <span className={styles.overdueChip}>Overdue</span>}
                                    <div className={styles.taskTitle}>{task.title}</div>
                                    {task.description && (
                                      <div className={styles.taskDesc}>{task.description}</div>
                                    )}
                                    {task.tags?.length > 0 && (
                                      <div className={styles.tags}>
                                        {task.tags.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
                                      </div>
                                    )}
                                    <div className={styles.taskMeta}>
                                      <span className={styles.priorityChip} style={{ background: p.bg, color: p.color }}>
                                        {p.label}
                                      </span>
                                      {task.dueDate && (
                                        <span className={`${styles.dueDate} ${isOverdue ? styles.dueDateOverdue : ''}`}>
                                          📅 {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Task Detail Modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onStatusChange={async (id, status) => {
            setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
            setSelectedTask(null);
            try { await api.patch(`/tasks/${id}/status`, { status }); }
            catch { fetchTasks(); }
          }}
        />
      )}
    </div>
  );
};

const TaskDetailModal = ({ task, onClose, onStatusChange }) => {
  const [status, setStatus] = useState(task.status);
  const p = { high: { bg: '#fef2f2', color: '#dc2626' }, medium: { bg: '#fff7ed', color: '#d97706' }, low: { bg: '#f0fdf4', color: '#15803d' } };
  const ps = p[task.priority] || p.medium;

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>{task.title}</h2>
          <button className={styles.closeBtn} onClick={onClose}>✕</button>
        </div>
        <div className={styles.modalBody}>
          <span className={styles.priorityBadge} style={{ background: ps.bg, color: ps.color }}>
            {task.priority?.toUpperCase()}
          </span>
          {task.description && <p className={styles.modalDesc}>{task.description}</p>}
          <div className={styles.modalMeta}>
            {task.dueDate && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Due Date</span>
                <span className={styles.metaValue}>{new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            )}
          </div>
          {task.tags?.length > 0 && (
            <div className={styles.tags}>
              {task.tags.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
            </div>
          )}
          <div className={styles.statusSection}>
            <label className={styles.statusLabel}>Update Status</label>
            <select className={styles.statusSelect} value={status} onChange={e => setStatus(e.target.value)}>
              <option value="todo">To Do</option>
              <option value="inprogress">In Progress</option>
              <option value="review">Review</option>
              <option value="done">Done</option>
            </select>
          </div>
          <div className={styles.modalActions}>
            <button className={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button className={styles.saveBtn} onClick={() => onStatusChange(task.id, status)}>Save Changes</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DirectorTasks;
