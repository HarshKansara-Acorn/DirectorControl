const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, sql } = require('../config/db');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

const mapTask = (r) => ({
  id:          r.Id,
  title:       r.Title,
  description: r.Description,
  priority:    r.Priority,
  status:      r.Status,
  assignedTo:  r.AssignedTo,
  createdBy:   r.CreatedBy,
  // Names resolved by JOIN queries
  assignedToName:  r.AssignedToName  || null,
  createdByName:   r.CreatedByName   || null,
  assignedToRole:  r.AssignedToRole  || null,
  createdByRole:   r.CreatedByRole   || null,
  dueDate:     r.DueDate ? r.DueDate.toISOString().split('T')[0] : null,
  dueTime:     r.DueTime || null,
  tags:        r.Tags ? JSON.parse(r.Tags) : [],
  source:      r.Source || 'manual',
  externalTaskId: r.ExternalTaskId || null,
  createdAt:   r.CreatedAt,
  updatedAt:   r.UpdatedAt,
  commentCount: r.CommentCount ? Number(r.CommentCount) : 0,
});

const mapComment = (r) => ({
  id:        r.Id,
  taskId:    r.TaskId,
  userId:    r.UserId,
  userName:  r.UserName  || 'Unknown',
  userRole:  r.UserRole  || 'unknown',
  userAvatar: r.UserAvatar || '',
  comment:   r.Comment,
  isRead:    r.IsRead ? true : false,
  createdAt: r.CreatedAt,
});

// Base SELECT with name resolution and comment count
const TASK_SELECT = `
  SELECT
    t.*,
    u1.Name  AS AssignedToName,
    u1.Role  AS AssignedToRole,
    u2.Name  AS CreatedByName,
    u2.Role  AS CreatedByRole,
    (SELECT COUNT(*) FROM DC_TaskComments c WHERE c.TaskId = t.Id) AS CommentCount
  FROM DC_Tasks t
  LEFT JOIN DC_Users u1 ON u1.Id = t.AssignedTo
  LEFT JOIN DC_Users u2 ON u2.Id = t.CreatedBy
`;

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tasks
// Admin: pass ?directorId=xxx to see a director's tasks, or no param for all
// Director: always sees tasks where they are AssignedTo OR CreatedBy
// ─────────────────────────────────────────────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { directorId } = req.query;

    let rows;
    if (req.user.role === 'director') {
      // Director sees tasks assigned to them OR created by them
      rows = await query(
        `${TASK_SELECT}
         WHERE (t.AssignedTo = @id OR t.CreatedBy = @id)
         ORDER BY t.CreatedAt DESC`,
        { id: { type: sql.NVarChar, value: req.user.id } }
      );
    } else if (directorId) {
      // Admin viewing a specific director's tasks (both directions)
      rows = await query(
        `${TASK_SELECT}
         WHERE (t.AssignedTo = @id OR t.CreatedBy = @id)
         ORDER BY t.CreatedAt DESC`,
        { id: { type: sql.NVarChar, value: directorId } }
      );
    } else {
      // Admin with no filter — all tasks
      rows = await query(
        `${TASK_SELECT} ORDER BY t.CreatedAt DESC`
      );
    }

    res.json(rows.map(mapTask));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to fetch tasks' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tasks
// Both admin AND directors can create tasks.
// Director creates a task → assignedTo = admin (PA)
// Admin creates a task   → assignedTo = director
// ─────────────────────────────────────────────────────────────────────────────
router.post('/', authenticateToken, async (req, res) => {
  const { title, description, priority, status, assignedTo, dueDate, dueTime, tags } = req.body;
  if (!title || !assignedTo)
    return res.status(400).json({ message: 'Title and assignedTo are required' });

  try {
    const id = uuidv4();
    await execute(
      `INSERT INTO DC_Tasks (Id,Title,Description,Priority,Status,AssignedTo,CreatedBy,DueDate,DueTime,Tags)
       VALUES (@id,@title,@desc,@priority,@status,@assignedTo,@createdBy,@dueDate,@dueTime,@tags)`,
      {
        id:         { type: sql.NVarChar, value: id },
        title:      { type: sql.NVarChar, value: title },
        desc:       { type: sql.NVarChar, value: description || '' },
        priority:   { type: sql.NVarChar, value: priority || 'medium' },
        status:     { type: sql.NVarChar, value: status || 'todo' },
        assignedTo: { type: sql.NVarChar, value: assignedTo },
        createdBy:  { type: sql.NVarChar, value: req.user.id },
        dueDate:    { type: sql.Date,     value: dueDate ? new Date(dueDate) : null },
        dueTime:    { type: sql.NVarChar, value: dueTime || null },
        tags:       { type: sql.NVarChar, value: JSON.stringify(tags || []) },
      }
    );
    const rows = await query(
      `${TASK_SELECT} WHERE t.Id = @id`,
      { id: { type: sql.NVarChar, value: id } }
    );
    res.status(201).json(mapTask(rows[0]));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to create task' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tasks/broadcast — admin only, create same task for multiple directors
// ─────────────────────────────────────────────────────────────────────────────
router.post('/broadcast', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, priority, status, directorIds, dueDate, dueTime, tags } = req.body;

  if (!title || !directorIds?.length)
    return res.status(400).json({ message: 'Title and at least one directorId are required' });

  try {
    const created = [];
    for (const directorId of directorIds) {
      const id = uuidv4();
      await execute(
        `INSERT INTO DC_Tasks (Id,Title,Description,Priority,Status,AssignedTo,CreatedBy,DueDate,DueTime,Tags)
         VALUES (@id,@title,@desc,@priority,@status,@assignedTo,@createdBy,@dueDate,@dueTime,@tags)`,
        {
          id:         { type: sql.NVarChar, value: id },
          title:      { type: sql.NVarChar, value: title },
          desc:       { type: sql.NVarChar, value: description || '' },
          priority:   { type: sql.NVarChar, value: priority || 'medium' },
          status:     { type: sql.NVarChar, value: status || 'todo' },
          assignedTo: { type: sql.NVarChar, value: directorId },
          createdBy:  { type: sql.NVarChar, value: req.user.id },
          dueDate:    { type: sql.Date,     value: dueDate ? new Date(dueDate) : null },
          dueTime:    { type: sql.NVarChar, value: dueTime || null },
          tags:       { type: sql.NVarChar, value: JSON.stringify(tags || []) },
        }
      );
      created.push(id);
    }
    res.status(201).json({
      message: `Task created for ${created.length} director(s)`,
      count: created.length,
      ids: created,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to broadcast task' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/tasks/:id — update task (creator or admin only)
// ─────────────────────────────────────────────────────────────────────────────
router.put('/:id', authenticateToken, async (req, res) => {
  const { title, description, priority, status, dueDate, dueTime, tags } = req.body;
  try {
    // Only creator or admin can edit
    const existing = await queryOne('SELECT CreatedBy FROM DC_Tasks WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Task not found' });
    if (req.user.role !== 'admin' && existing.CreatedBy !== req.user.id)
      return res.status(403).json({ message: 'Only the task creator or admin can edit this task' });

    await execute(
      `UPDATE DC_Tasks SET Title=@title, Description=@desc, Priority=@priority,
       Status=@status, DueDate=@dueDate, DueTime=@dueTime, Tags=@tags, UpdatedAt=GETUTCDATE()
       WHERE Id=@id`,
      {
        id:       { type: sql.NVarChar, value: req.params.id },
        title:    { type: sql.NVarChar, value: title },
        desc:     { type: sql.NVarChar, value: description || '' },
        priority: { type: sql.NVarChar, value: priority || 'medium' },
        status:   { type: sql.NVarChar, value: status || 'todo' },
        dueDate:  { type: sql.Date,     value: dueDate ? new Date(dueDate) : null },
        dueTime:  { type: sql.NVarChar, value: dueTime || null },
        tags:     { type: sql.NVarChar, value: JSON.stringify(tags || []) },
      }
    );
    const rows = await query(`${TASK_SELECT} WHERE t.Id = @id`, { id: { type: sql.NVarChar, value: req.params.id } });
    res.json(mapTask(rows[0]));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to update task' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/tasks/:id/status — both assignee and creator can update status
// ─────────────────────────────────────────────────────────────────────────────
router.patch('/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  try {
    const existing = await queryOne('SELECT AssignedTo, CreatedBy FROM DC_Tasks WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Task not found' });

    // Allow: admin, assignee, or creator
    const canUpdate = req.user.role === 'admin'
      || existing.AssignedTo === req.user.id
      || existing.CreatedBy  === req.user.id;
    if (!canUpdate) return res.status(403).json({ message: 'Not authorized to update this task' });

    await execute(
      'UPDATE DC_Tasks SET Status=@status, UpdatedAt=GETUTCDATE() WHERE Id=@id',
      {
        id:     { type: sql.NVarChar, value: req.params.id },
        status: { type: sql.NVarChar, value: status },
      }
    );
    const rows = await query(`${TASK_SELECT} WHERE t.Id = @id`, { id: { type: sql.NVarChar, value: req.params.id } });
    res.json(mapTask(rows[0]));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to update task status' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/tasks/:id — admin or creator only
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const existing = await queryOne('SELECT CreatedBy FROM DC_Tasks WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!existing) return res.status(404).json({ message: 'Task not found' });
    if (req.user.role !== 'admin' && existing.CreatedBy !== req.user.id)
      return res.status(403).json({ message: 'Only the task creator or admin can delete this task' });

    await execute('DELETE FROM DC_Tasks WHERE Id = @id', { id: { type: sql.NVarChar, value: req.params.id } });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete task' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/tasks/:id/comments
// ─────────────────────────────────────────────────────────────────────────────
router.get('/:id/comments', authenticateToken, async (req, res) => {
  try {
    const rows = await query(
      `SELECT c.*, u.Name AS UserName, u.Role AS UserRole, u.Avatar AS UserAvatar, c.IsRead
       FROM DC_TaskComments c
       LEFT JOIN DC_Users u ON u.Id = c.UserId
       WHERE c.TaskId = @taskId
       ORDER BY c.CreatedAt ASC`,
      { taskId: { type: sql.NVarChar, value: req.params.id } }
    );
    res.json(rows.map(mapComment));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to fetch comments' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/tasks/:id/comments — any participant (assignee, creator, admin) can comment
// ─────────────────────────────────────────────────────────────────────────────
router.post('/:id/comments', authenticateToken, async (req, res) => {
  const { comment } = req.body;
  if (!comment?.trim()) return res.status(400).json({ message: 'Comment cannot be empty' });

  try {
    // Verify user is a participant
    const task = await queryOne('SELECT AssignedTo, CreatedBy FROM DC_Tasks WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isParticipant = req.user.role === 'admin'
      || task.AssignedTo === req.user.id
      || task.CreatedBy  === req.user.id;
    if (!isParticipant) return res.status(403).json({ message: 'Not authorized to comment on this task' });

    const id = uuidv4();
    await execute(
      'INSERT INTO DC_TaskComments (Id, TaskId, UserId, Comment) VALUES (@id, @taskId, @userId, @comment)',
      {
        id:      { type: sql.NVarChar, value: id },
        taskId:  { type: sql.NVarChar, value: req.params.id },
        userId:  { type: sql.NVarChar, value: req.user.id },
        comment: { type: sql.NVarChar, value: comment.trim() },
      }
    );

    const rows = await query(
      `SELECT c.*, u.Name AS UserName, u.Role AS UserRole, u.Avatar AS UserAvatar
       FROM DC_TaskComments c
       LEFT JOIN DC_Users u ON u.Id = c.UserId
       WHERE c.Id = @id`,
      { id: { type: sql.NVarChar, value: id } }
    );
    res.status(201).json(mapComment(rows[0]));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to add comment' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/tasks/:id/comments/:commentId — own comment or admin
// ─────────────────────────────────────────────────────────────────────────────
router.delete('/:id/comments/:commentId', authenticateToken, async (req, res) => {
  try {
    const c = await queryOne('SELECT UserId FROM DC_TaskComments WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.commentId } });
    if (!c) return res.status(404).json({ message: 'Comment not found' });
    if (req.user.role !== 'admin' && c.UserId !== req.user.id)
      return res.status(403).json({ message: 'Not authorized to delete this comment' });

    await execute('DELETE FROM DC_TaskComments WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.commentId } });
    res.json({ message: 'Comment deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete comment' });
  }
});

// PATCH /api/tasks/:id/comments/:commentId/read — mark a comment as read
router.patch('/:id/comments/:commentId/read', authenticateToken, async (req, res) => {
  try {
    const c = await queryOne('SELECT TaskId FROM DC_TaskComments WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.commentId } });
    if (!c) return res.status(404).json({ message: 'Comment not found' });

    // Verify user is a participant
    const task = await queryOne('SELECT AssignedTo, CreatedBy FROM DC_Tasks WHERE Id=@taskId', { taskId: { type: sql.NVarChar, value: c.TaskId } });
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isParticipant = req.user.role === 'admin' || task.AssignedTo === req.user.id || task.CreatedBy === req.user.id;
    if (!isParticipant) return res.status(403).json({ message: 'Not authorized' });

    await execute('UPDATE DC_TaskComments SET IsRead=1 WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.commentId } });
    res.json({ message: 'Comment marked as read' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to mark comment as read' });
  }
});

router.patch('/:id/comments/read-all', authenticateToken, async (req, res) => {
  try {
    const { commentIds } = req.body;
    if (!Array.isArray(commentIds) || !commentIds.length) {
      return res.status(400).json({ message: 'commentIds array is required' });
    }

    const task = await queryOne(
      'SELECT AssignedTo, CreatedBy FROM DC_Tasks WHERE Id=(SELECT TaskId FROM DC_TaskComments WHERE Id=@id)',
      { id: { type: sql.NVarChar, value: commentIds[0] } }
    );
    if (!task) return res.status(404).json({ message: 'Task not found' });

    const isParticipant = req.user.role === 'admin' || task.AssignedTo === req.user.id || task.CreatedBy === req.user.id;
    if (!isParticipant) return res.status(403).json({ message: 'Not authorized' });

    const idsParam = commentIds.map((id, index) => `@id${index}`).join(', ');
    const params = {};
    commentIds.forEach((id, index) => {
      params[`id${index}`] = { type: sql.NVarChar, value: id };
    });

    await execute(`UPDATE DC_TaskComments SET IsRead=1 WHERE Id IN (${idsParam})`, params);
    res.json({ message: 'Comments marked as read' });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to mark comments as read' });
  }
});

module.exports = router;
