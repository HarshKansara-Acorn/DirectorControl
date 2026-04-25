const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, sql } = require('../config/db');

const mapReminder = (r) => ({
  id: r.Id, title: r.Title, description: r.Description,
  directorId: r.DirectorId,
  dueDate: r.DueDate ? r.DueDate.toISOString().split('T')[0] : null,
  priority: r.Priority, isActive: r.IsActive === true || r.IsActive === 1,
  createdBy: r.CreatedBy, createdAt: r.CreatedAt,
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { directorId } = req.query;
    const targetId = req.user.role === 'director' ? req.user.id : (directorId || null);
    let rows;
    if (targetId) {
      rows = await query('SELECT * FROM DC_Reminders WHERE DirectorId=@id ORDER BY DueDate', { id: { type: sql.NVarChar, value: targetId } });
    } else {
      rows = await query('SELECT * FROM DC_Reminders ORDER BY DueDate');
    }
    res.json(rows.map(mapReminder));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch reminders' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, directorId, dueDate, priority } = req.body;
  if (!title || !directorId) return res.status(400).json({ message: 'Title and directorId are required' });
  try {
    const id = uuidv4();
    await execute(
      'INSERT INTO DC_Reminders (Id,Title,Description,DirectorId,DueDate,Priority,IsActive,CreatedBy) VALUES (@id,@title,@desc,@directorId,@dueDate,@priority,1,@createdBy)',
      {
        id: { type: sql.NVarChar, value: id },
        title: { type: sql.NVarChar, value: title },
        desc: { type: sql.NVarChar, value: description || '' },
        directorId: { type: sql.NVarChar, value: directorId },
        dueDate: { type: sql.Date, value: dueDate ? new Date(dueDate) : null },
        priority: { type: sql.NVarChar, value: priority || 'medium' },
        createdBy: { type: sql.NVarChar, value: req.user.id },
      }
    );
    const created = await queryOne('SELECT * FROM DC_Reminders WHERE Id=@id', { id: { type: sql.NVarChar, value: id } });
    res.status(201).json(mapReminder(created));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to create reminder' });
  }
});

// POST /api/reminders/broadcast — send same reminder to multiple directors
router.post('/broadcast', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, directorIds, dueDate, priority } = req.body;
  if (!title || !directorIds?.length)
    return res.status(400).json({ message: 'Title and at least one directorId are required' });

  try {
    const created = [];
    for (const directorId of directorIds) {
      const id = uuidv4();
      await execute(
        'INSERT INTO DC_Reminders (Id,Title,Description,DirectorId,DueDate,Priority,IsActive,CreatedBy) VALUES (@id,@title,@desc,@directorId,@dueDate,@priority,1,@createdBy)',
        {
          id:         { type: sql.NVarChar, value: id },
          title:      { type: sql.NVarChar, value: title },
          desc:       { type: sql.NVarChar, value: description || '' },
          directorId: { type: sql.NVarChar, value: directorId },
          dueDate:    { type: sql.Date,     value: dueDate ? new Date(dueDate) : null },
          priority:   { type: sql.NVarChar, value: priority || 'medium' },
          createdBy:  { type: sql.NVarChar, value: req.user.id },
        }
      );
      created.push(id);
    }
    res.status(201).json({
      message: `Reminder sent to ${created.length} director(s)`,
      count: created.length,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to broadcast reminder' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, dueDate, priority, isActive } = req.body;
  try {
    await execute(
      'UPDATE DC_Reminders SET Title=@title,Description=@desc,DueDate=@dueDate,Priority=@priority,IsActive=@isActive WHERE Id=@id',
      {
        id: { type: sql.NVarChar, value: req.params.id },
        title: { type: sql.NVarChar, value: title },
        desc: { type: sql.NVarChar, value: description || '' },
        dueDate: { type: sql.Date, value: dueDate ? new Date(dueDate) : null },
        priority: { type: sql.NVarChar, value: priority || 'medium' },
        isActive: { type: sql.Bit, value: isActive !== false ? 1 : 0 },
      }
    );
    const updated = await queryOne('SELECT * FROM DC_Reminders WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Reminder not found' });
    res.json(mapReminder(updated));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update reminder' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM DC_Reminders WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    res.json({ message: 'Reminder deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete reminder' });
  }
});

module.exports = router;
