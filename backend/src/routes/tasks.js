const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, sql } = require('../config/db');

const mapTask = (r) => ({
  id: r.Id, title: r.Title, description: r.Description,
  priority: r.Priority, status: r.Status,
  assignedTo: r.AssignedTo, createdBy: r.CreatedBy,
  dueDate: r.DueDate ? r.DueDate.toISOString().split('T')[0] : null,
  tags: r.Tags ? JSON.parse(r.Tags) : [],
  createdAt: r.CreatedAt,
});

// GET /api/tasks?directorId=xxx
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { directorId } = req.query;
    const targetId = req.user.role === 'director' ? req.user.id : (directorId || null);

    let rows;
    if (targetId) {
      rows = await query(
        'SELECT * FROM DC_Tasks WHERE AssignedTo = @id ORDER BY CreatedAt DESC',
        { id: { type: sql.NVarChar, value: targetId } }
      );
    } else {
      rows = await query('SELECT * FROM DC_Tasks ORDER BY CreatedAt DESC');
    }
    res.json(rows.map(mapTask));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to fetch tasks' });
  }
});

// POST /api/tasks
router.post('/', authenticateToken, async (req, res) => {
  const { title, description, priority, status, assignedTo, dueDate, tags } = req.body;
  if (!title || !assignedTo)
    return res.status(400).json({ message: 'Title and assignedTo are required' });

  try {
    const id = uuidv4();
    await execute(
      `INSERT INTO DC_Tasks (Id,Title,Description,Priority,Status,AssignedTo,CreatedBy,DueDate,Tags)
       VALUES (@id,@title,@desc,@priority,@status,@assignedTo,@createdBy,@dueDate,@tags)`,
      {
        id:         { type: sql.NVarChar, value: id },
        title:      { type: sql.NVarChar, value: title },
        desc:       { type: sql.NVarChar, value: description || '' },
        priority:   { type: sql.NVarChar, value: priority || 'medium' },
        status:     { type: sql.NVarChar, value: status || 'todo' },
        assignedTo: { type: sql.NVarChar, value: assignedTo },
        createdBy:  { type: sql.NVarChar, value: req.user.id },
        dueDate:    { type: sql.Date,     value: dueDate ? new Date(dueDate) : null },
        tags:       { type: sql.NVarChar, value: JSON.stringify(tags || []) },
      }
    );
    const created = await queryOne('SELECT * FROM DC_Tasks WHERE Id = @id', { id: { type: sql.NVarChar, value: id } });
    res.status(201).json(mapTask(created));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to create task' });
  }
});

// PUT /api/tasks/:id
router.put('/:id', authenticateToken, async (req, res) => {
  const { title, description, priority, status, dueDate, tags } = req.body;
  try {
    await execute(
      `UPDATE DC_Tasks SET Title=@title, Description=@desc, Priority=@priority,
       Status=@status, DueDate=@dueDate, Tags=@tags, UpdatedAt=GETUTCDATE()
       WHERE Id=@id`,
      {
        id:       { type: sql.NVarChar, value: req.params.id },
        title:    { type: sql.NVarChar, value: title },
        desc:     { type: sql.NVarChar, value: description || '' },
        priority: { type: sql.NVarChar, value: priority || 'medium' },
        status:   { type: sql.NVarChar, value: status || 'todo' },
        dueDate:  { type: sql.Date,     value: dueDate ? new Date(dueDate) : null },
        tags:     { type: sql.NVarChar, value: JSON.stringify(tags || []) },
      }
    );
    const updated = await queryOne('SELECT * FROM DC_Tasks WHERE Id = @id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Task not found' });
    res.json(mapTask(updated));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to update task' });
  }
});

// PATCH /api/tasks/:id/status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  const { status } = req.body;
  try {
    await execute(
      'UPDATE DC_Tasks SET Status=@status, UpdatedAt=GETUTCDATE() WHERE Id=@id',
      {
        id:     { type: sql.NVarChar, value: req.params.id },
        status: { type: sql.NVarChar, value: status },
      }
    );
    const updated = await queryOne('SELECT * FROM DC_Tasks WHERE Id = @id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Task not found' });
    res.json(mapTask(updated));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to update task status' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM DC_Tasks WHERE Id = @id', { id: { type: sql.NVarChar, value: req.params.id } });
    res.json({ message: 'Task deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete task' });
  }
});

module.exports = router;
