const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, sql } = require('../config/db');

const mapEvent = (r) => ({
  id: r.Id, title: r.Title, description: r.Description,
  type: r.Type, directorId: r.DirectorId,
  startDate: r.StartDate ? r.StartDate.toISOString().split('T')[0] : null,
  endDate: r.EndDate ? r.EndDate.toISOString().split('T')[0] : null,
  startTime: r.StartTime, endTime: r.EndTime, location: r.Location,
  attendees: r.Attendees ? JSON.parse(r.Attendees) : [],
  isAllDay: r.IsAllDay === true || r.IsAllDay === 1,
  priority: r.Priority, status: r.Status, notes: r.Notes,
  teamsId: r.TeamsId, joinUrl: r.JoinUrl, source: r.Source,
  createdBy: r.CreatedBy, createdAt: r.CreatedAt,
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { directorId, type } = req.query;
    const targetId = req.user.role === 'director' ? req.user.id : (directorId || null);
    let q = 'SELECT * FROM DC_Events WHERE 1=1';
    const params = {};
    if (targetId) { q += ' AND DirectorId=@id'; params.id = { type: sql.NVarChar, value: targetId }; }
    if (type && type !== 'all') { q += ' AND Type=@type'; params.type = { type: sql.NVarChar, value: type }; }
    q += ' ORDER BY StartDate, StartTime';
    const rows = await query(q, params);
    res.json(rows.map(mapEvent));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch events' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, type, directorId, startDate, endDate, startTime, endTime, location, attendees, isAllDay, priority, notes } = req.body;
  if (!title || !directorId || !startDate) return res.status(400).json({ message: 'Title, directorId and startDate are required' });
  try {
    const id = uuidv4();
    await execute(
      `INSERT INTO DC_Events (Id,Title,Description,Type,DirectorId,StartDate,EndDate,StartTime,EndTime,Location,Attendees,IsAllDay,Priority,Status,Notes,Source,CreatedBy)
       VALUES (@id,@title,@desc,@type,@directorId,@startDate,@endDate,@startTime,@endTime,@location,@attendees,@isAllDay,@priority,'upcoming',@notes,'manual',@createdBy)`,
      {
        id: { type: sql.NVarChar, value: id },
        title: { type: sql.NVarChar, value: title },
        desc: { type: sql.NVarChar, value: description || '' },
        type: { type: sql.NVarChar, value: type || 'meeting' },
        directorId: { type: sql.NVarChar, value: directorId },
        startDate: { type: sql.Date, value: new Date(startDate) },
        endDate: { type: sql.Date, value: endDate ? new Date(endDate) : new Date(startDate) },
        startTime: { type: sql.NVarChar, value: startTime || '09:00' },
        endTime: { type: sql.NVarChar, value: endTime || '10:00' },
        location: { type: sql.NVarChar, value: location || '' },
        attendees: { type: sql.NVarChar, value: JSON.stringify(attendees || []) },
        isAllDay: { type: sql.Bit, value: isAllDay ? 1 : 0 },
        priority: { type: sql.NVarChar, value: priority || 'medium' },
        notes: { type: sql.NVarChar, value: notes || '' },
        createdBy: { type: sql.NVarChar, value: req.user.id },
      }
    );
    const created = await queryOne('SELECT * FROM DC_Events WHERE Id=@id', { id: { type: sql.NVarChar, value: id } });
    res.status(201).json(mapEvent(created));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to create event' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, type, startDate, endDate, startTime, endTime, location, attendees, isAllDay, priority, notes } = req.body;
  try {
    await execute(
      'UPDATE DC_Events SET Title=@title,Description=@desc,Type=@type,StartDate=@startDate,EndDate=@endDate,StartTime=@startTime,EndTime=@endTime,Location=@location,Attendees=@attendees,IsAllDay=@isAllDay,Priority=@priority,Notes=@notes WHERE Id=@id',
      {
        id: { type: sql.NVarChar, value: req.params.id },
        title: { type: sql.NVarChar, value: title },
        desc: { type: sql.NVarChar, value: description || '' },
        type: { type: sql.NVarChar, value: type || 'meeting' },
        startDate: { type: sql.Date, value: new Date(startDate) },
        endDate: { type: sql.Date, value: endDate ? new Date(endDate) : new Date(startDate) },
        startTime: { type: sql.NVarChar, value: startTime || '09:00' },
        endTime: { type: sql.NVarChar, value: endTime || '10:00' },
        location: { type: sql.NVarChar, value: location || '' },
        attendees: { type: sql.NVarChar, value: JSON.stringify(attendees || []) },
        isAllDay: { type: sql.Bit, value: isAllDay ? 1 : 0 },
        priority: { type: sql.NVarChar, value: priority || 'medium' },
        notes: { type: sql.NVarChar, value: notes || '' },
      }
    );
    const updated = await queryOne('SELECT * FROM DC_Events WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Event not found' });
    res.json(mapEvent(updated));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update event' });
  }
});

router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  try {
    await execute('UPDATE DC_Events SET Status=@status WHERE Id=@id', {
      id: { type: sql.NVarChar, value: req.params.id },
      status: { type: sql.NVarChar, value: status },
    });
    const updated = await queryOne('SELECT * FROM DC_Events WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Event not found' });
    res.json(mapEvent(updated));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update event status' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM DC_Events WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    res.json({ message: 'Event deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete event' });
  }
});

module.exports = router;
