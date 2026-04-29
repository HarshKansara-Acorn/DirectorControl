const express = require('express');
const router  = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, getPool, sql } = require('../config/db');

// ── Helpers ───────────────────────────────────────────────────────────────────

const mapMember = (r) => ({
  id:           r.Id,
  directorId:   r.DirectorId,
  name:         r.Name,
  relationship: r.Relationship,
  dateOfBirth:  r.DateOfBirth ? r.DateOfBirth.toISOString().split('T')[0] : null,
  phone:        r.Phone        || null,
  email:        r.Email        || null,
  notes:        r.Notes        || null,
  photoData:    r.PhotoData    || null,
  photoName:    r.PhotoName    || null,
  hasPhoto:     !!r.PhotoData,
  createdBy:    r.CreatedBy,
  createdAt:    r.CreatedAt,
  updatedAt:    r.UpdatedAt,
});

// ── GET /api/family-tree?directorId=xxx ───────────────────────────────────────
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { directorId } = req.query;
    const targetId = req.user.role === 'director' ? req.user.id : (directorId || null);

    let rows;
    if (targetId) {
      rows = await query(
        'SELECT * FROM DC_FamilyMembers WHERE DirectorId=@id ORDER BY Relationship, Name',
        { id: { type: sql.NVarChar, value: targetId } }
      );
    } else {
      rows = await query('SELECT * FROM DC_FamilyMembers ORDER BY DirectorId, Relationship, Name');
    }
    res.json(rows.map(mapMember));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to fetch family members' });
  }
});

// ── POST /api/family-tree ─────────────────────────────────────────────────────
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { directorId, name, relationship, dateOfBirth, phone, email, notes } = req.body;
  if (!name || !directorId || !relationship)
    return res.status(400).json({ message: 'Name, directorId and relationship are required' });

  try {
    const id = uuidv4();
    await execute(
      `INSERT INTO DC_FamilyMembers
        (Id, DirectorId, Name, Relationship, DateOfBirth, Phone, Email, Notes, CreatedBy)
       VALUES
        (@id, @directorId, @name, @rel, @dob, @phone, @email, @notes, @createdBy)`,
      {
        id:         { type: sql.NVarChar, value: id },
        directorId: { type: sql.NVarChar, value: directorId },
        name:       { type: sql.NVarChar, value: name },
        rel:        { type: sql.NVarChar, value: relationship },
        dob:        { type: sql.Date,     value: dateOfBirth ? new Date(dateOfBirth) : null },
        phone:      { type: sql.NVarChar, value: phone || '' },
        email:      { type: sql.NVarChar, value: email || '' },
        notes:      { type: sql.NVarChar, value: notes || '' },
        createdBy:  { type: sql.NVarChar, value: req.user.id },
      }
    );
    const created = await queryOne(
      'SELECT * FROM DC_FamilyMembers WHERE Id=@id',
      { id: { type: sql.NVarChar, value: id } }
    );
    res.status(201).json(mapMember(created));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to create family member' });
  }
});

// ── POST /api/family-tree/bulk — import multiple members at once (Excel import) ─
router.post('/bulk', authenticateToken, requireAdmin, async (req, res) => {
  const { directorId, members } = req.body;
  if (!directorId || !Array.isArray(members) || members.length === 0)
    return res.status(400).json({ message: 'directorId and members array are required' });

  try {
    let added = 0;
    for (const m of members) {
      if (!m.name || !m.relationship) continue;
      const id = uuidv4();
      await execute(
        `INSERT INTO DC_FamilyMembers
          (Id, DirectorId, Name, Relationship, DateOfBirth, Phone, Email, Notes, CreatedBy)
         VALUES
          (@id, @directorId, @name, @rel, @dob, @phone, @email, @notes, @createdBy)`,
        {
          id:         { type: sql.NVarChar, value: id },
          directorId: { type: sql.NVarChar, value: directorId },
          name:       { type: sql.NVarChar, value: m.name },
          rel:        { type: sql.NVarChar, value: m.relationship },
          dob:        { type: sql.Date,     value: m.dateOfBirth ? new Date(m.dateOfBirth) : null },
          phone:      { type: sql.NVarChar, value: m.phone || '' },
          email:      { type: sql.NVarChar, value: m.email || '' },
          notes:      { type: sql.NVarChar, value: m.notes || '' },
          createdBy:  { type: sql.NVarChar, value: req.user.id },
        }
      );
      added++;
    }
    res.status(201).json({ message: `Imported ${added} family member(s)`, count: added });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to import family members' });
  }
});

// ── PUT /api/family-tree/:id ──────────────────────────────────────────────────
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { name, relationship, dateOfBirth, phone, email, notes } = req.body;
  if (!name || !relationship)
    return res.status(400).json({ message: 'Name and relationship are required' });

  try {
    await execute(
      `UPDATE DC_FamilyMembers SET
        Name=@name, Relationship=@rel, DateOfBirth=@dob,
        Phone=@phone, Email=@email, Notes=@notes, UpdatedAt=GETUTCDATE()
       WHERE Id=@id`,
      {
        id:    { type: sql.NVarChar, value: req.params.id },
        name:  { type: sql.NVarChar, value: name },
        rel:   { type: sql.NVarChar, value: relationship },
        dob:   { type: sql.Date,     value: dateOfBirth ? new Date(dateOfBirth) : null },
        phone: { type: sql.NVarChar, value: phone || '' },
        email: { type: sql.NVarChar, value: email || '' },
        notes: { type: sql.NVarChar, value: notes || '' },
      }
    );
    const updated = await queryOne(
      'SELECT * FROM DC_FamilyMembers WHERE Id=@id',
      { id: { type: sql.NVarChar, value: req.params.id } }
    );
    if (!updated) return res.status(404).json({ message: 'Member not found' });
    res.json(mapMember(updated));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to update family member' });
  }
});

// ── POST /api/family-tree/:id/photo — upload/replace photo ───────────────────
router.post('/:id/photo', authenticateToken, requireAdmin, async (req, res) => {
  const { photoData, photoName } = req.body;

  if (!photoData) return res.status(400).json({ message: 'photoData is required' });

  // Validate it's an image
  const validImage = /^data:image\/(jpeg|jpg|png|gif|webp);base64,/i.test(photoData);
  if (!validImage)
    return res.status(400).json({ message: 'Only image files are allowed (JPEG, PNG, GIF, WebP)' });

  const MAX = 5 * 1024 * 1024; // 5MB
  if (photoData.length > MAX)
    return res.status(413).json({ message: 'Photo too large. Maximum size is 5MB.' });

  try {
    const pool = await getPool();
    await pool.request()
      .input('id',        sql.NVarChar(36),       req.params.id)
      .input('photoData', sql.NVarChar(sql.MAX),   photoData)
      .input('photoName', sql.NVarChar(300),        photoName || 'photo.jpg')
      .query(`UPDATE DC_FamilyMembers SET
        PhotoData=@photoData, PhotoName=@photoName, UpdatedAt=GETUTCDATE()
        WHERE Id=@id`);

    const rows = await query(
      'SELECT * FROM DC_FamilyMembers WHERE Id=@id',
      { id: { type: sql.NVarChar, value: req.params.id } }
    );
    if (!rows[0]) return res.status(404).json({ message: 'Member not found' });
    res.json(mapMember(rows[0]));
  } catch (err) {
    console.error('Photo upload error:', err.message);
    res.status(500).json({ message: 'Failed to upload photo' });
  }
});

// ── DELETE /api/family-tree/:id/photo ────────────────────────────────────────
router.delete('/:id/photo', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute(
      'UPDATE DC_FamilyMembers SET PhotoData=NULL, PhotoName=NULL, UpdatedAt=GETUTCDATE() WHERE Id=@id',
      { id: { type: sql.NVarChar, value: req.params.id } }
    );
    res.json({ message: 'Photo removed' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove photo' });
  }
});

// ── DELETE /api/family-tree/:id ───────────────────────────────────────────────
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute(
      'DELETE FROM DC_FamilyMembers WHERE Id=@id',
      { id: { type: sql.NVarChar, value: req.params.id } }
    );
    res.json({ message: 'Family member deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete family member' });
  }
});

module.exports = router;
