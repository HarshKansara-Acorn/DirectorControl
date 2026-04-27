const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, getPool, sql } = require('../config/db');
const { validateFile, formatFileSize } = require('../utils/fileUpload');

const mapTravel = (r) => ({
  id: r.Id, destination: r.Destination, purpose: r.Purpose,
  directorId: r.DirectorId,
  departureDate: r.DepartureDate ? r.DepartureDate.toISOString().split('T')[0] : null,
  departureTime: r.DepartureTime || null,
  returnDate: r.ReturnDate ? r.ReturnDate.toISOString().split('T')[0] : null,
  returnTime: r.ReturnTime || null,
  status: r.Status, notes: r.Notes,
  attachmentData: r.AttachmentData || null,
  attachmentName: r.AttachmentName || null,
  attachmentType: r.AttachmentType || null,
  hasAttachment: !!r.AttachmentData,
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
  const { destination, purpose, directorId, departureDate, departureTime, returnDate, returnTime, notes } = req.body;
  if (!destination || !directorId || !departureDate) return res.status(400).json({ message: 'Destination, directorId and departureDate are required' });
  try {
    const id = uuidv4();
    await execute(
      'INSERT INTO DC_Travel (Id,Destination,Purpose,DirectorId,DepartureDate,DepartureTime,ReturnDate,ReturnTime,Status,Notes,CreatedBy) VALUES (@id,@dest,@purpose,@directorId,@depDate,@depTime,@retDate,@retTime,@status,@notes,@createdBy)',
      {
        id: { type: sql.NVarChar, value: id },
        dest: { type: sql.NVarChar, value: destination },
        purpose: { type: sql.NVarChar, value: purpose || '' },
        directorId: { type: sql.NVarChar, value: directorId },
        depDate: { type: sql.Date, value: new Date(departureDate) },
        depTime: { type: sql.NVarChar, value: departureTime || null },
        retDate: { type: sql.Date, value: returnDate ? new Date(returnDate) : null },
        retTime: { type: sql.NVarChar, value: returnTime || null },
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
  const { destination, purpose, departureDate, departureTime, returnDate, returnTime, status, notes } = req.body;
  try {
    await execute(
      'UPDATE DC_Travel SET Destination=@dest,Purpose=@purpose,DepartureDate=@depDate,DepartureTime=@depTime,ReturnDate=@retDate,ReturnTime=@retTime,Status=@status,Notes=@notes WHERE Id=@id',
      {
        id: { type: sql.NVarChar, value: req.params.id },
        dest: { type: sql.NVarChar, value: destination },
        purpose: { type: sql.NVarChar, value: purpose || '' },
        depDate: { type: sql.Date, value: new Date(departureDate) },
        depTime: { type: sql.NVarChar, value: departureTime || null },
        retDate: { type: sql.Date, value: returnDate ? new Date(returnDate) : null },
        retTime: { type: sql.NVarChar, value: returnTime || null },
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

// ── POST /api/travel/:id/upload — attach visa/ticket/itinerary ───────────────
router.post('/:id/upload', authenticateToken, requireAdmin, async (req, res) => {
  const { fileData, fileName } = req.body;

  const validation = validateFile(fileData);
  if (!validation.valid) return res.status(400).json({ message: validation.error });

  try {
    const pool = await getPool();
    await pool.request()
      .input('id',       sql.NVarChar(36),      req.params.id)
      .input('fileData', sql.NVarChar(sql.MAX), fileData)
      .input('fileName', sql.NVarChar(300),     fileName || `document.${validation.ext}`)
      .input('fileType', sql.NVarChar(50),      validation.ext)
      .query(`UPDATE DC_Travel SET
        AttachmentData=@fileData, AttachmentName=@fileName, AttachmentType=@fileType
        WHERE Id=@id`);

    const rows = await query('SELECT * FROM DC_Travel WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!rows[0]) return res.status(404).json({ message: 'Travel not found' });
    res.json(mapTravel(rows[0]));
  } catch (err) {
    console.error('Travel upload error:', err.message);
    res.status(500).json({ message: 'Failed to upload file' });
  }
});

// ── DELETE /api/travel/:id/upload — remove attachment ────────────────────────
router.delete('/:id/upload', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute(
      `UPDATE DC_Travel SET AttachmentData=NULL, AttachmentName=NULL, AttachmentType=NULL WHERE Id=@id`,
      { id: { type: sql.NVarChar, value: req.params.id } }
    );
    res.json({ message: 'Attachment removed' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove attachment' });
  }
});

module.exports = router;
