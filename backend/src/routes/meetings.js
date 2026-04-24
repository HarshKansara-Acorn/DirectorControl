const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, sql } = require('../config/db');

const mapMeeting = (r) => ({
  id: r.Id, title: r.Title, description: r.Description,
  directorId: r.DirectorId,
  date: r.MeetingDate ? r.MeetingDate.toISOString().split('T')[0] : null,
  time: r.MeetingTime, duration: r.Duration, location: r.Location,
  attendees: r.Attendees ? JSON.parse(r.Attendees) : [],
  createdBy: r.CreatedBy, createdAt: r.CreatedAt,
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { directorId, date } = req.query;
    const targetId = req.user.role === 'director' ? req.user.id : (directorId || null);
    let q = 'SELECT * FROM DC_Meetings WHERE 1=1';
    const params = {};
    if (targetId) { q += ' AND DirectorId=@id'; params.id = { type: sql.NVarChar, value: targetId }; }
    if (date) { q += ' AND MeetingDate=@date'; params.date = { type: sql.Date, value: new Date(date) }; }
    q += ' ORDER BY MeetingDate, MeetingTime';
    const rows = await query(q, params);
    res.json(rows.map(mapMeeting));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch meetings' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, directorId, date, time, duration, location, attendees } = req.body;
  if (!title || !directorId || !date) return res.status(400).json({ message: 'Title, directorId and date are required' });
  try {
    const id = uuidv4();
    await execute(
      `INSERT INTO DC_Meetings (Id,Title,Description,DirectorId,MeetingDate,MeetingTime,Duration,Location,Attendees,CreatedBy)
       VALUES (@id,@title,@desc,@directorId,@date,@time,@duration,@location,@attendees,@createdBy)`,
      {
        id: { type: sql.NVarChar, value: id },
        title: { type: sql.NVarChar, value: title },
        desc: { type: sql.NVarChar, value: description || '' },
        directorId: { type: sql.NVarChar, value: directorId },
        date: { type: sql.Date, value: new Date(date) },
        time: { type: sql.NVarChar, value: time || '09:00' },
        duration: { type: sql.Int, value: duration || 60 },
        location: { type: sql.NVarChar, value: location || '' },
        attendees: { type: sql.NVarChar, value: JSON.stringify(attendees || []) },
        createdBy: { type: sql.NVarChar, value: req.user.id },
      }
    );
    const created = await queryOne('SELECT * FROM DC_Meetings WHERE Id=@id', { id: { type: sql.NVarChar, value: id } });
    res.status(201).json(mapMeeting(created));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to create meeting' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, date, time, duration, location, attendees } = req.body;
  try {
    await execute(
      'UPDATE DC_Meetings SET Title=@title,Description=@desc,MeetingDate=@date,MeetingTime=@time,Duration=@duration,Location=@location,Attendees=@attendees WHERE Id=@id',
      {
        id: { type: sql.NVarChar, value: req.params.id },
        title: { type: sql.NVarChar, value: title },
        desc: { type: sql.NVarChar, value: description || '' },
        date: { type: sql.Date, value: new Date(date) },
        time: { type: sql.NVarChar, value: time || '09:00' },
        duration: { type: sql.Int, value: duration || 60 },
        location: { type: sql.NVarChar, value: location || '' },
        attendees: { type: sql.NVarChar, value: JSON.stringify(attendees || []) },
      }
    );
    const updated = await queryOne('SELECT * FROM DC_Meetings WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Meeting not found' });
    res.json(mapMeeting(updated));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update meeting' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM DC_Meetings WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    res.json({ message: 'Meeting deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete meeting' });
  }
});

module.exports = router;
