import React, { useState, useEffect, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useAuth } from '../context/AuthContext';
import { useDirector } from '../context/DirectorContext';
import api from '../services/api';
import AddTaskModal from '../components/modals/AddTaskModal';
import TaskDetailModal from '../components/modals/TaskDetailModal';
import styles from './Tasks.module.css';

const COLUMNS = [
  { id: 'todo', label: 'To Do', color: '#64748b', bg: '#f8fafc' },
  { id: 'inprogress', label: 'In Progress', color: '#d97706', bg: '#fffbeb' },
  { id: 'review', label: 'Review', color: '#7c3aed', bg: '#faf5ff' },
  { id: 'done', label: 'Done', color: '#15803d', bg: '#f0fdf4' },
];

const PRIORITY_COLORS = {
  high: { bg: '#fef2f2', color: '#dc2626', label: '🔴 High' },
  medium: { bg: '#fff7ed', color: '#d97706', label: '🟡 Medium' },
  low: { bg: '#f0fdf4', color: '#15803d', label: '🟢 Low' },
};

const Tasks = () => {
  const { isAdmin } = useAuth();
  const { activeDirectorId, selectedDirector } = useDirector();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filterPriority, setFilterPriority] = useState('all');

  const fetchTasks = useCallback(async () => {
    if (!activeDirectorId) return;
    setLoading(true);
    try {
      const res = await api.get('/tasks', { params: { directorId: activeDirectorId } });
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [activeDirectorId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleDragEnd = async (result) => {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const newStatus = destination.droppableId;

    // Optimistic update
    setTasks(prev => prev.map(t => t.id === draggableId ? { ...t, status: newStatus } : t));

    try {
      await api.patch(`/tasks/${draggableId}/status`, { status: newStatus });
    } catch (err) {
      console.error('Failed to update task status:', err);
      fetchTasks(); // Revert on error
    }
  };

  const filteredTasks = tasks.filter(t =>
    filterPriority === 'all' || t.priority === filterPriority
  );

  const getColumnTasks = (columnId) =>
    filteredTasks.filter(t => t.status === columnId);

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.status === 'done').length;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Tasks</h1>
          <p className={styles.subtitle}>
            {selectedDirector?.name || 'Director'} — {completedTasks}/{totalTasks} tasks completed
          </p>
        </div>
        <div className={styles.headerActions}>
          {/* Priority Filter */}
          <select
            className={styles.filterSelect}
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            aria-label="Filter by priority"
          >
            <option value="all">All Priorities</option>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>

          {isAdmin && (
            <button className={styles.addBtn} onClick={() => setShowAddModal(true)}>
              + New Task
            </button>
          )}
        </div>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <div className={styles.loadingBoard}>
          {COLUMNS.map(col => (
            <div key={col.id} className={styles.skeletonColumn} />
          ))}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className={styles.board}>
            {COLUMNS.map((col) => {
              const colTasks = getColumnTasks(col.id);
              return (
                <div key={col.id} className={styles.column}>
                  {/* Column Header */}
                  <div className={styles.columnHeader}>
                    <div className={styles.columnTitleGroup}>
                      <div
                        className={styles.columnDot}
                        style={{ background: col.color }}
                      />
                      <span className={styles.columnTitle}>{col.label}</span>
                    </div>
                    <span
                      className={styles.columnCount}
                      style={{ background: col.bg, color: col.color }}
                    >
                      {colTasks.length}
                    </span>
                  </div>

                  {/* Droppable Area */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`${styles.droppable} ${snapshot.isDraggingOver ? styles.droppableOver : ''}`}
                        style={{ background: snapshot.isDraggingOver ? col.bg : undefined }}
                      >
                        {colTasks.length === 0 && !snapshot.isDraggingOver && (
                          <div className={styles.emptyColumn}>
                            <p>No tasks</p>
                          </div>
                        )}

                        {colTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`${styles.taskCard} ${snapshot.isDragging ? styles.taskCardDragging : ''}`}
                                onClick={() => setSelectedTask(task)}
                              >
                                {/* Priority indicator */}
                                <div
                                  className={styles.taskPriorityBar}
                                  style={{ background: PRIORITY_COLORS[task.priority]?.color || '#94a3b8' }}
                                />

                                <div className={styles.taskContent}>
                                  <div className={styles.taskTitle}>{task.title}</div>

                                  {task.description && (
                                    <div className={styles.taskDesc}>{task.description}</div>
                                  )}

                                  {/* Tags */}
                                  {task.tags && task.tags.length > 0 && (
                                    <div className={styles.taskTags}>
                                      {task.tags.map(tag => (
                                        <span key={tag} className={styles.tag}>{tag}</span>
                                      ))}
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
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
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

      {/* Modals */}
      {showAddModal && (
        <AddTaskModal
          directorId={activeDirectorId}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => { setShowAddModal(false); fetchTasks(); }}
        />
      )}

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

export default Tasks;
