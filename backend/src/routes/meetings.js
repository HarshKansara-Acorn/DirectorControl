const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, sql } = require('../config/db');

const mapMeeting = (r) => {
  // Parse directorIds — shared meetings have a JSON array
  let directorIds = [];
  try { directorIds = r.DirectorIds ? JSON.parse(r.DirectorIds) : []; } catch {}

  return {
    id:          r.Id,
    title:       r.Title,
    description: r.Description,
    directorId:  r.DirectorId,
    directorIds: directorIds,
    isShared:    r.IsShared === true || r.IsShared === 1,
    date:        r.MeetingDate ? r.MeetingDate.toISOString().split('T')[0] : null,
    time:        r.MeetingTime,
    duration:    r.Duration,
    location:    r.Location,
    attendees:   r.Attendees ? JSON.parse(r.Attendees) : [],
    createdBy:   r.CreatedBy,
    createdAt:   r.CreatedAt,
  };
};

// GET /api/meetings?directorId=xxx&date=yyyy-mm-dd
// Returns both individual meetings AND shared meetings the director is part of
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { directorId, date } = req.query;
    const targetId = req.user.role === 'director' ? req.user.id : (directorId || null);

    let rows = [];

    if (targetId) {
      // Individual meetings for this director
      let q = 'SELECT * FROM DC_Meetings WHERE DirectorId=@id';
      const params = { id: { type: sql.NVarChar, value: targetId } };
      if (date) { q += ' AND MeetingDate=@date'; params.date = { type: sql.Date, value: new Date(date) }; }

      const individual = await query(q, params);

      // Shared meetings where this director is in DirectorIds JSON array
      let sq = "SELECT * FROM DC_Meetings WHERE IsShared=1 AND DirectorIds LIKE @pattern";
      const sharedParams = { pattern: { type: sql.NVarChar, value: `%${targetId}%` } };
      if (date) { sq += ' AND MeetingDate=@date'; sharedParams.date = { type: sql.Date, value: new Date(date) }; }

      const shared = await query(sq, sharedParams);

      // Merge, deduplicate by id
      const seen = new Set();
      for (const r of [...individual, ...shared]) {
        if (!seen.has(r.Id)) { seen.add(r.Id); rows.push(r); }
      }
    } else {
      // Admin with no filter — return all
      let q = 'SELECT * FROM DC_Meetings WHERE 1=1';
      const params = {};
      if (date) { q += ' AND MeetingDate=@date'; params.date = { type: sql.Date, value: new Date(date) }; }
      rows = await query(q, params);
    }

    rows.sort((a, b) => {
      const d = new Date(a.MeetingDate) - new Date(b.MeetingDate);
      return d !== 0 ? d : (a.MeetingTime || '').localeCompare(b.MeetingTime || '');
    });

    res.json(rows.map(mapMeeting));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to fetch meetings' });
  }
});

// POST /api/meetings — single director OR shared (directorIds array)
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, directorId, directorIds, date, time, duration, location, attendees } = req.body;

  // Determine if this is a shared meeting
  const isShared = Array.isArray(directorIds) && directorIds.length > 1;
  const primaryDirectorId = isShared ? directorIds[0] : directorId;

  if (!title || !primaryDirectorId || !date)
    return res.status(400).json({ message: 'Title, at least one director, and date are required' });

  try {
    const id = uuidv4();
    await execute(
      `INSERT INTO DC_Meetings
        (Id,Title,Description,DirectorId,DirectorIds,IsShared,MeetingDate,MeetingTime,Duration,Location,Attendees,CreatedBy)
       VALUES
        (@id,@title,@desc,@directorId,@directorIds,@isShared,@date,@time,@duration,@location,@attendees,@createdBy)`,
      {
        id:          { type: sql.NVarChar, value: id },
        title:       { type: sql.NVarChar, value: title },
        desc:        { type: sql.NVarChar, value: description || '' },
        directorId:  { type: sql.NVarChar, value: primaryDirectorId },
        directorIds: { type: sql.NVarChar, value: isShared ? JSON.stringify(directorIds) : JSON.stringify([primaryDirectorId]) },
        isShared:    { type: sql.Bit,      value: isShared ? 1 : 0 },
        date:        { type: sql.Date,     value: new Date(date) },
        time:        { type: sql.NVarChar, value: time || '09:00' },
        duration:    { type: sql.Int,      value: Number(duration) || 60 },
        location:    { type: sql.NVarChar, value: location || '' },
        attendees:   { type: sql.NVarChar, value: JSON.stringify(attendees || []) },
        createdBy:   { type: sql.NVarChar, value: req.user.id },
      }
    );
    const created = await queryOne('SELECT * FROM DC_Meetings WHERE Id=@id', { id: { type: sql.NVarChar, value: id } });
    res.status(201).json(mapMeeting(created));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to create meeting' });
  }
});

// PUT /api/meetings/:id
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, directorIds, date, time, duration, location, attendees } = req.body;
  const isShared = Array.isArray(directorIds) && directorIds.length > 1;
  try {
    await execute(
      `UPDATE DC_Meetings SET
        Title=@title, Description=@desc,
        DirectorIds=@directorIds, IsShared=@isShared,
        MeetingDate=@date, MeetingTime=@time, Duration=@duration,
        Location=@location, Attendees=@attendees
       WHERE Id=@id`,
      {
        id:          { type: sql.NVarChar, value: req.params.id },
        title:       { type: sql.NVarChar, value: title },
        desc:        { type: sql.NVarChar, value: description || '' },
        directorIds: { type: sql.NVarChar, value: JSON.stringify(directorIds || []) },
        isShared:    { type: sql.Bit,      value: isShared ? 1 : 0 },
        date:        { type: sql.Date,     value: new Date(date) },
        time:        { type: sql.NVarChar, value: time || '09:00' },
        duration:    { type: sql.Int,      value: Number(duration) || 60 },
        location:    { type: sql.NVarChar, value: location || '' },
        attendees:   { type: sql.NVarChar, value: JSON.stringify(attendees || []) },
      }
    );
    const updated = await queryOne('SELECT * FROM DC_Meetings WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Meeting not found' });
    res.json(mapMeeting(updated));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update meeting' });
  }
});

// DELETE /api/meetings/:id
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM DC_Meetings WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    res.json({ message: 'Meeting deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete meeting' });
  }
});

module.exports = router;
