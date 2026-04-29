const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, sql } = require('../config/db');

const mapApproval = (r) => ({
  id: r.Id, type: r.Type, title: r.Title, description: r.Description,
  fromName: r.FromName, fromEmail: r.FromEmail, directorId: r.DirectorId,
  priority: r.Priority,
  dueDate: r.DueDate ? r.DueDate.toISOString().split('T')[0] : null,
  dueTime: r.DueTime || null,
  status: r.Status, remarks: r.Remarks, actionBy: r.ActionBy,
  actionAt: r.ActionAt, createdBy: r.CreatedBy, createdAt: r.CreatedAt,
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { directorId } = req.query;
    const targetId = req.user.role === 'director' ? req.user.id : (directorId || null);
    let rows;
    if (targetId) {
      rows = await query('SELECT * FROM DC_Approvals WHERE DirectorId=@id ORDER BY CreatedAt DESC', { id: { type: sql.NVarChar, value: targetId } });
    } else {
      rows = await query('SELECT * FROM DC_Approvals ORDER BY CreatedAt DESC');
    }
    res.json(rows.map(mapApproval));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch approvals' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { type, title, description, fromName, fromEmail, directorId, priority, dueDate, dueTime } = req.body;
  if (!title || !directorId) return res.status(400).json({ message: 'Title and directorId are required' });
  try {
    const id = uuidv4();
    await execute(
      `INSERT INTO DC_Approvals (Id,Type,Title,Description,FromName,FromEmail,DirectorId,Priority,DueDate,DueTime,Status,CreatedBy)
       VALUES (@id,@type,@title,@desc,@fromName,@fromEmail,@directorId,@priority,@dueDate,@dueTime,'pending',@createdBy)`,
      {
        id: { type: sql.NVarChar, value: id },
        type: { type: sql.NVarChar, value: type || 'general' },
        title: { type: sql.NVarChar, value: title },
        desc: { type: sql.NVarChar, value: description || '' },
        fromName: { type: sql.NVarChar, value: fromName || '' },
        fromEmail: { type: sql.NVarChar, value: fromEmail || '' },
        directorId: { type: sql.NVarChar, value: directorId },
        priority: { type: sql.NVarChar, value: priority || 'normal' },
        dueDate: { type: sql.Date, value: dueDate ? new Date(dueDate) : null },
        dueTime: { type: sql.NVarChar, value: dueTime || null },
        createdBy: { type: sql.NVarChar, value: req.user.id },
      }
    );
    const created = await queryOne('SELECT * FROM DC_Approvals WHERE Id=@id', { id: { type: sql.NVarChar, value: id } });
    res.status(201).json(mapApproval(created));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to create approval' });
  }
});

// POST /api/approvals/broadcast — send same approval request to multiple directors
router.post('/broadcast', authenticateToken, requireAdmin, async (req, res) => {
  const { type, title, description, fromName, fromEmail, directorIds, priority, dueDate, dueTime } = req.body;
  if (!title || !directorIds?.length)
    return res.status(400).json({ message: 'Title and at least one directorId are required' });

  try {
    const created = [];
    for (const directorId of directorIds) {
      const id = uuidv4();
      await execute(
        `INSERT INTO DC_Approvals (Id,Type,Title,Description,FromName,FromEmail,DirectorId,Priority,DueDate,DueTime,Status,CreatedBy)
         VALUES (@id,@type,@title,@desc,@fromName,@fromEmail,@directorId,@priority,@dueDate,@dueTime,'pending',@createdBy)`,
        {
          id:         { type: sql.NVarChar, value: id },
          type:       { type: sql.NVarChar, value: type || 'general' },
          title:      { type: sql.NVarChar, value: title },
          desc:       { type: sql.NVarChar, value: description || '' },
          fromName:   { type: sql.NVarChar, value: fromName || '' },
          fromEmail:  { type: sql.NVarChar, value: fromEmail || '' },
          directorId: { type: sql.NVarChar, value: directorId },
          priority:   { type: sql.NVarChar, value: priority || 'normal' },
          dueDate:    { type: sql.Date,     value: dueDate ? new Date(dueDate) : null },
          dueTime:    { type: sql.NVarChar, value: dueTime || null },
          createdBy:  { type: sql.NVarChar, value: req.user.id },
        }
      );
      created.push(id);
    }
    res.status(201).json({
      message: `Approval request sent to ${created.length} director(s)`,
      count: created.length,
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to broadcast approval' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { type, title, description, fromName, fromEmail, priority, dueDate, dueTime } = req.body;
  if (!title) return res.status(400).json({ message: 'Title is required' });
  try {
    await execute(
      `UPDATE DC_Approvals SET Type=@type,Title=@title,Description=@desc,
       FromName=@fromName,FromEmail=@fromEmail,Priority=@priority,
       DueDate=@dueDate,DueTime=@dueTime WHERE Id=@id`,
      {
        id:        { type: sql.NVarChar, value: req.params.id },
        type:      { type: sql.NVarChar, value: type || 'general' },
        title:     { type: sql.NVarChar, value: title },
        desc:      { type: sql.NVarChar, value: description || '' },
        fromName:  { type: sql.NVarChar, value: fromName || '' },
        fromEmail: { type: sql.NVarChar, value: fromEmail || '' },
        priority:  { type: sql.NVarChar, value: priority || 'normal' },
        dueDate:   { type: sql.Date,     value: dueDate ? new Date(dueDate) : null },
        dueTime:   { type: sql.NVarChar, value: dueTime || null },
      }
    );
    const updated = await queryOne('SELECT * FROM DC_Approvals WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Approval not found' });
    res.json(mapApproval(updated));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to update approval' });
  }
});

router.patch('/:id/action', authenticateToken, async (req, res) => {
  const { action, remarks } = req.body;
  try {
    const approval = await queryOne('SELECT * FROM DC_Approvals WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!approval) return res.status(404).json({ message: 'Approval not found' });
    if (req.user.role === 'director' && approval.DirectorId !== req.user.id)
      return res.status(403).json({ message: 'Not authorized' });

    await execute(
      'UPDATE DC_Approvals SET Status=@status,Remarks=@remarks,ActionBy=@actionBy,ActionAt=GETUTCDATE() WHERE Id=@id',
      {
        id: { type: sql.NVarChar, value: req.params.id },
        status: { type: sql.NVarChar, value: action },
        remarks: { type: sql.NVarChar, value: remarks || '' },
        actionBy: { type: sql.NVarChar, value: req.user.id },
      }
    );
    const updated = await queryOne('SELECT * FROM DC_Approvals WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    res.json(mapApproval(updated));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update approval' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM DC_Approvals WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    res.json({ message: 'Approval deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete approval' });
  }
});

module.exports = router;
