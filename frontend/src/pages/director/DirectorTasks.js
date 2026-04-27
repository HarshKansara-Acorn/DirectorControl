import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import AddTaskModal from '../../components/modals/AddTaskModal';
import TaskDetailModal from '../../components/modals/TaskDetailModal';
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
  const { user } = useAuth();
  const [tasks, setTasks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [filterPriority, setFilter]     = useState('all');
  const [filterDirection, setFilterDir] = useState('all'); // all | from-pa | from-me
  const [selectedTask, setSelectedTask] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);

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

  const filtered = tasks.filter(t => {
    const priorityOk = filterPriority === 'all' || t.priority === filterPriority;
    let directionOk = true;
    if (filterDirection === 'from-pa') directionOk = t.createdByRole === 'admin';
    if (filterDirection === 'from-me') directionOk = t.createdBy === user?.id;
    return priorityOk && directionOk;
  });

  const today = new Date().toISOString().split('T')[0];
  const done = tasks.filter(t => t.status === 'done').length;
  const fromPA = tasks.filter(t => t.createdByRole === 'admin').length;
  const fromMe = tasks.filter(t => t.createdBy === user?.id).length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>My Tasks</h1>
          <p className={styles.subtitle}>
            {done}/{tasks.length} completed
            {fromPA > 0 && <span style={{ color: '#1e40af', marginLeft: 8 }}>· {fromPA} from PA</span>}
            {fromMe > 0 && <span style={{ color: '#7c3aed', marginLeft: 8 }}>· {fromMe} sent to PA</span>}
          </p>
        </div>
        <div className={styles.headerActions}>
          <select
            className={styles.filterSelect}
            value={filterDirection}
            onChange={e => setFilterDir(e.target.value)}
            aria-label="Filter by direction"
          >
            <option value="all">All Tasks</option>
            <option value="from-pa">From PA</option>
            <option value="from-me">Sent to PA</option>
          </select>
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
          <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
            + Send to PA
          </button>
        </div>
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
                          const isFromPA  = task.createdByRole === 'admin';
                          const isFromMe  = task.createdBy === user?.id;

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
                                    {/* Direction indicator */}
                                    <div className={styles.taskDirection}>
                                      {isFromPA
                                        ? <span className={styles.dirFromPA}>↓ from PA</span>
                                        : <span className={styles.dirToPA}>↑ sent to PA</span>
                                      }
                                      {task.commentCount > 0 && (
                                        <span className={styles.commentCount}>💬 {task.commentCount}</span>
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

      {/* Add task modal — director sends to PA */}
      {showAddModal && (
        <AddTaskModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchTasks(); }}
        />
      )}

      {/* Task detail with comments */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={() => { setSelectedTask(null); fetchTasks(); }}
        />
      )}
    </div>
  );
};

export default DirectorTasks;
