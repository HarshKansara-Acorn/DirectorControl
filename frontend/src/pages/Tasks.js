import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAuth } from '../context/AuthContext';
import { useDirector } from '../context/DirectorContext';
import api from '../services/api';
import AddTaskModal from '../components/modals/AddTaskModal';
import TaskDetailModal from '../components/modals/TaskDetailModal';
import InlineTaskChat from '../components/tasks/InlineTaskChat';
import styles from './Tasks.module.css';

const COLUMNS = [
  { id: 'todo',       label: 'To Do',       color: '#64748b', bg: '#f8fafc' },
  { id: 'inprogress', label: 'In Progress',  color: '#d97706', bg: '#fffbeb' },
  { id: 'review',     label: 'Review',       color: '#7c3aed', bg: '#faf5ff' },
  { id: 'done',       label: 'Done',         color: '#15803d', bg: '#f0fdf4' },
];

const PRIORITY_COLORS = {
  high:   { bg: '#fef2f2', color: '#dc2626', label: '🔴 High' },
  medium: { bg: '#fff7ed', color: '#d97706', label: '🟡 Medium' },
  low:    { bg: '#f0fdf4', color: '#15803d', label: '🟢 Low' },
};

const Tasks = () => {
  const { isAdmin, user } = useAuth();
  const { activeDirectorId, selectedDirector } = useDirector();
  const [tasks, setTasks]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [detailTask, setDetailTask]     = useState(null);
  const [openChatId, setOpenChatId]     = useState(null);
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterDirection, setFilterDirection] = useState('all');
  const [commentCounts, setCommentCounts] = useState({});

  const fetchTasks = useCallback(async () => {
    if (!activeDirectorId) return;
    setLoading(true);
    try {
      const res = await api.get('/tasks', { params: { directorId: activeDirectorId } });
      setTasks(res.data);
      const counts = {};
      res.data.forEach(t => { counts[t.id] = t.commentCount || 0; });
      setCommentCounts(counts);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [activeDirectorId]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    const newStatus = destination.droppableId;
    setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: newStatus } : t));
    try {
      await api.patch(`/tasks/${draggableId}/status`, { status: newStatus });
    } catch (err) {
      console.error('Failed to update task status:', err);
      fetchTasks();
    }
  };

  const toggleChat = (taskId, e) => {
    e.stopPropagation();
    setOpenChatId(prev => prev === taskId ? null : taskId);
  };

  const filteredTasks = tasks.filter(t => {
    const priorityOk = filterPriority === 'all' || t.priority === filterPriority;
    let directionOk = true;
    if (filterDirection === 'from-pa') directionOk = t.createdByRole === 'admin';
    if (filterDirection === 'from-director') directionOk = t.createdByRole === 'director';
    return priorityOk && directionOk;
  });

  const getColumnTasks = (columnId) => filteredTasks.filter(t => t.status === columnId);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const fromDirectorCount = tasks.filter(t => t.createdByRole === 'director').length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tasks</h1>
          <p className={styles.subtitle}>
            {selectedDirector?.name || 'Director'} — {completedTasks}/{totalTasks} completed
            {fromDirectorCount > 0 && <span style={{ color: '#7c3aed', marginLeft: 8 }}>· {fromDirectorCount} from director</span>}
          </p>
        </div>
        <div className={styles.headerActions}>
          <select className={styles.filterSelect} value={filterDirection} onChange={e => setFilterDirection(e.target.value)}>
            <option value="all">All Tasks</option>
            <option value="from-pa">PA → Director</option>
            <option value="from-director">Director → PA</option>
          </select>
          <select className={styles.filterSelect} value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
            <option value="all">All Priorities</option>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
          {isAdmin && (
            <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
              + Assign Task
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className={styles.loadingBoard}>
          {COLUMNS.map(col => <div key={col.id} className={styles.skeletonColumn} />)}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className={styles.board}>
            {COLUMNS.map((col) => {
              const colTasks = getColumnTasks(col.id);
              return (
                <div key={col.id} className={styles.column}>
                  <div className={styles.columnHeader}>
                    <div className={styles.columnTitleGroup}>
                      <div className={styles.columnDot} style={{ background: col.color }} />
                      <span className={styles.columnTitle}>{col.label}</span>
                    </div>
                    <span className={styles.columnCount} style={{ background: col.bg, color: col.color }}>
                      {colTasks.length}
                    </span>
                  </div>

                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`${styles.droppable} ${snapshot.isDraggingOver ? styles.droppableOver : ''}`}
                        style={{ background: snapshot.isDraggingOver ? col.bg : undefined }}
                      >
                        {colTasks.length === 0 && !snapshot.isDraggingOver && (
                          <div className={styles.emptyColumn}><p>No tasks</p></div>
                        )}

                        {colTasks.map((task, index) => {
                          const chatOpen = openChatId === task.id;
                          const msgCount = commentCounts[task.id] ?? task.commentCount ?? 0;

                          return (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`${styles.taskCard} ${snapshot.isDragging ? styles.taskCardDragging : ''} ${chatOpen ? styles.taskCardOpen : ''}`}
                                >
                                  {/* Drag handle = task body */}
                                  <div {...provided.dragHandleProps} className={styles.taskDragArea}>
                                    <div
                                      className={styles.taskPriorityBar}
                                      style={{ background: PRIORITY_COLORS[task.priority]?.color || '#94a3b8' }}
                                    />
                                    <div className={styles.taskContent}>
                                      <div className={styles.taskTitle}>{task.title}</div>
                                      {task.description && (
                                        <div className={styles.taskDesc}>{task.description}</div>
                                      )}
                                      {task.tags && task.tags.length > 0 && (
                                        <div className={styles.taskTags}>
                                          {task.tags.map(tag => <span key={tag} className={styles.tag}>{tag}</span>)}
                                        </div>
                                      )}
                                      <div className={styles.taskMeta}>
                                        <span
                                          className={styles.priorityChip}
                                          style={{
                                            background: PRIORITY_COLORS[task.priority]?.bg,
                                            color: PRIORITY_COLORS[task.priority]?.color,
                                          }}
                                        >
                                          {PRIORITY_COLORS[task.priority]?.label || task.priority}
                                        </span>
                                        {task.dueDate && (
                                          <span className={styles.dueDate}>
                                            📅 {new Date(task.dueDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                            {task.dueTime ? ` ${task.dueTime}` : ''}
                                          </span>
                                        )}
                                      </div>

                                      {/* Footer: direction + action buttons */}
                                      <div className={styles.taskDirection}>
                                        {task.createdByRole === 'director'
                                          ? <span className={styles.dirFromDirector}>↑ from {task.createdByName?.split(' ')[0]}</span>
                                          : <span className={styles.dirFromPA}>↓ PA → {task.assignedToName?.split(' ')[0]}</span>
                                        }
                                        <div className={styles.taskActions}>
                                          <button
                                            className={`${styles.chatBtn} ${chatOpen ? styles.chatBtnActive : ''}`}
                                            onClick={e => toggleChat(task.id, e)}
                                            title={chatOpen ? 'Close chat' : 'Open chat'}
                                          >
                                            💬 {msgCount > 0 ? msgCount : ''}
                                          </button>
                                          <button
                                            className={styles.detailBtn}
                                            onClick={e => { e.stopPropagation(); setDetailTask(task); }}
                                            title="View details & change status"
                                          >
                                            ⋯
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  </div>

                                  {/* Inline chat panel */}
                                  {chatOpen && (
                                    <InlineTaskChat
                                      taskId={task.id}
                                      onCommentCountChange={count =>
                                        setCommentCounts(prev => ({ ...prev, [task.id]: count }))
                                      }
                                    />
                                  )}
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

      {showAddModal && (
        <AddTaskModal
          directorId={activeDirectorId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchTasks(); }}
        />
      )}

      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          onClose={() => setDetailTask(null)}
          onUpdate={() => { setDetailTask(null); fetchTasks(); }}
        />
      )}
    </div>
  );
};

export default Tasks;
