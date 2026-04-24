const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, sql } = require('../config/db');

const mapTravel = (r) => ({
  id: r.Id, destination: r.Destination, purpose: r.Purpose,
  directorId: r.DirectorId,
  departureDate: r.DepartureDate ? r.DepartureDate.toISOString().split('T')[0] : null,
  returnDate: r.ReturnDate ? r.ReturnDate.toISOString().split('T')[0] : null,
  status: r.Status, notes: r.Notes,
  createdBy: r.CreatedBy, createdAt: r.CreatedAt,
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { directorId } = req.query;
    const targetId = req.user.role === 'director' ? req.user.id : (directorId || null);
    let rows;
    if (targetId) {
      rows = await query('SELECT * FROM DC_Travel WHERE DirectorId=@id ORDER BY DepartureDate', { id: { type: sql.NVarChar, value: targetId } });
    } else {
      rows = await query('SELECT * FROM DC_Travel ORDER BY DepartureDate');
    }
    res.json(rows.map(mapTravel));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch travel' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { destination, purpose, directorId, departureDate, returnDate, notes } = req.body;
  if (!destination || !directorId || !departureDate) return res.status(400).json({ message: 'Destination, directorId and departureDate are required' });
  try {
    const id = uuidv4();
    await execute(
      'INSERT INTO DC_Travel (Id,Destination,Purpose,DirectorId,DepartureDate,ReturnDate,Status,Notes,CreatedBy) VALUES (@id,@dest,@purpose,@directorId,@depDate,@retDate,@status,@notes,@createdBy)',
      {
        id: { type: sql.NVarChar, value: id },
        dest: { type: sql.NVarChar, value: destination },
        purpose: { type: sql.NVarChar, value: purpose || '' },
        directorId: { type: sql.NVarChar, value: directorId },
        depDate: { type: sql.Date, value: new Date(departureDate) },
        retDate: { type: sql.Date, value: returnDate ? new Date(returnDate) : null },
        status: { type: sql.NVarChar, value: 'upcoming' },
        notes: { type: sql.NVarChar, value: notes || '' },
        createdBy: { type: sql.NVarChar, value: req.user.id },
      }
    );
    const created = await queryOne('SELECT * FROM DC_Travel WHERE Id=@id', { id: { type: sql.NVarChar, value: id } });
    res.status(201).json(mapTravel(created));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to create travel' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { destination, purpose, departureDate, returnDate, status, notes } = req.body;
  try {
    await execute(
      'UPDATE DC_Travel SET Destination=@dest,Purpose=@purpose,DepartureDate=@depDate,ReturnDate=@retDate,Status=@status,Notes=@notes WHERE Id=@id',
      {
        id: { type: sql.NVarChar, value: req.params.id },
        dest: { type: sql.NVarChar, value: destination },
        purpose: { type: sql.NVarChar, value: purpose || '' },
        depDate: { type: sql.Date, value: new Date(departureDate) },
        retDate: { type: sql.Date, value: returnDate ? new Date(returnDate) : null },
        status: { type: sql.NVarChar, value: status || 'upcoming' },
        notes: { type: sql.NVarChar, value: notes || '' },
      }
    );
    const updated = await queryOne('SELECT * FROM DC_Travel WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Travel not found' });
    res.json(mapTravel(updated));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update travel' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM DC_Travel WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    res.json({ message: 'Travel deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete travel' });
  }
});

module.exports = router;
