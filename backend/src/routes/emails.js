const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, sql } = require('../config/db');

const mapEmail = (r) => ({
  id: r.Id, subject: r.Subject, from: r.FromEmail, fromName: r.FromName,
  directorId: r.DirectorId, preview: r.Preview, priority: r.Priority,
  isRead: r.IsRead === true || r.IsRead === 1,
  createdBy: r.CreatedBy, createdAt: r.CreatedAt,
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { directorId } = req.query;
    const targetId = req.user.role === 'director' ? req.user.id : (directorId || null);
    let rows;
    if (targetId) {
      rows = await query('SELECT * FROM DC_UrgentEmails WHERE DirectorId=@id ORDER BY CreatedAt DESC', { id: { type: sql.NVarChar, value: targetId } });
    } else {
      rows = await query('SELECT * FROM DC_UrgentEmails ORDER BY CreatedAt DESC');
    }
    res.json(rows.map(mapEmail));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch emails' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { subject, from, fromName, directorId, preview, priority } = req.body;
  if (!subject || !directorId) return res.status(400).json({ message: 'Subject and directorId are required' });
  try {
    const id = uuidv4();
    await execute(
      'INSERT INTO DC_UrgentEmails (Id,Subject,FromEmail,FromName,DirectorId,Preview,Priority,IsRead,CreatedBy) VALUES (@id,@subject,@from,@fromName,@directorId,@preview,@priority,0,@createdBy)',
      {
        id: { type: sql.NVarChar, value: id },
        subject: { type: sql.NVarChar, value: subject },
        from: { type: sql.NVarChar, value: from || '' },
        fromName: { type: sql.NVarChar, value: fromName || '' },
        directorId: { type: sql.NVarChar, value: directorId },
        preview: { type: sql.NVarChar, value: preview || '' },
        priority: { type: sql.NVarChar, value: priority || 'urgent' },
        createdBy: { type: sql.NVarChar, value: req.user.id },
      }
    );
    const created = await queryOne('SELECT * FROM DC_UrgentEmails WHERE Id=@id', { id: { type: sql.NVarChar, value: id } });
    res.status(201).json(mapEmail(created));
  } catch (err) {
    res.status(500).json({ message: 'Failed to create email' });
  }
});

router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    await execute('UPDATE DC_UrgentEmails SET IsRead=1 WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    const updated = await queryOne('SELECT * FROM DC_UrgentEmails WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Email not found' });
    res.json(mapEmail(updated));
  } catch (err) {
    res.status(500).json({ message: 'Failed to mark email as read' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM DC_UrgentEmails WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    res.json({ message: 'Email deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete email' });
  }
});

module.exports = router;
