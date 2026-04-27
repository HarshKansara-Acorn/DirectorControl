const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, getPool, sql } = require('../config/db');
const { validateFile, formatFileSize } = require('../utils/fileUpload');

const mapDoc = (r) => ({
  id: r.Id, title: r.Title, description: r.Description,
  category: r.Category, directorId: r.DirectorId,
  fileUrl: r.FileUrl, fileName: r.FileName, fileSize: r.FileSize, fileType: r.FileType,
  fileData: r.FileData || null,   // base64 content
  hasFile: !!r.FileData,
  status: r.Status,
  expiryDate: r.ExpiryDate ? r.ExpiryDate.toISOString().split('T')[0] : null,
  expiryTime: r.ExpiryTime || null,
  tags: r.Tags ? JSON.parse(r.Tags) : [],
  createdBy: r.CreatedBy, createdAt: r.CreatedAt,
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { directorId, category } = req.query;
    const targetId = req.user.role === 'director' ? req.user.id : (directorId || null);
    let q = 'SELECT * FROM DC_Documents WHERE 1=1';
    const params = {};
    if (targetId) { q += ' AND DirectorId=@id'; params.id = { type: sql.NVarChar, value: targetId }; }
    if (category && category !== 'all') { q += ' AND Category=@cat'; params.cat = { type: sql.NVarChar, value: category }; }
    q += ' ORDER BY CreatedAt DESC';
    const rows = await query(q, params);
    res.json(rows.map(mapDoc));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch documents' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, category, directorId, fileName, fileSize, fileType, expiryDate, expiryTime, tags } = req.body;
  if (!title || !directorId) return res.status(400).json({ message: 'Title and directorId are required' });
  try {
    const id = uuidv4();
    await execute(
      `INSERT INTO DC_Documents (Id,Title,Description,Category,DirectorId,FileName,FileSize,FileType,Status,ExpiryDate,ExpiryTime,Tags,CreatedBy)
       VALUES (@id,@title,@desc,@category,@directorId,@fileName,@fileSize,@fileType,'active',@expiryDate,@expiryTime,@tags,@createdBy)`,
      {
        id: { type: sql.NVarChar, value: id },
        title: { type: sql.NVarChar, value: title },
        desc: { type: sql.NVarChar, value: description || '' },
        category: { type: sql.NVarChar, value: category || 'General' },
        directorId: { type: sql.NVarChar, value: directorId },
        fileName: { type: sql.NVarChar, value: fileName || '' },
        fileSize: { type: sql.NVarChar, value: fileSize || '' },
        fileType: { type: sql.NVarChar, value: fileType || 'pdf' },
        expiryDate: { type: sql.Date, value: expiryDate ? new Date(expiryDate) : null },
        expiryTime: { type: sql.NVarChar, value: expiryTime || null },
        tags: { type: sql.NVarChar, value: JSON.stringify(tags || []) },
        createdBy: { type: sql.NVarChar, value: req.user.id },
      }
    );
    const created = await queryOne('SELECT * FROM DC_Documents WHERE Id=@id', { id: { type: sql.NVarChar, value: id } });
    res.status(201).json(mapDoc(created));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to create document' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { title, description, category, fileName, fileSize, fileType, expiryDate, expiryTime, tags } = req.body;
  try {
    await execute(
      'UPDATE DC_Documents SET Title=@title,Description=@desc,Category=@category,FileName=@fileName,FileSize=@fileSize,FileType=@fileType,ExpiryDate=@expiryDate,ExpiryTime=@expiryTime,Tags=@tags WHERE Id=@id',
      {
        id: { type: sql.NVarChar, value: req.params.id },
        title: { type: sql.NVarChar, value: title },
        desc: { type: sql.NVarChar, value: description || '' },
        category: { type: sql.NVarChar, value: category || 'General' },
        fileName: { type: sql.NVarChar, value: fileName || '' },
        fileSize: { type: sql.NVarChar, value: fileSize || '' },
        fileType: { type: sql.NVarChar, value: fileType || 'pdf' },
        expiryDate: { type: sql.Date, value: expiryDate ? new Date(expiryDate) : null },
        expiryTime: { type: sql.NVarChar, value: expiryTime || null },
        tags: { type: sql.NVarChar, value: JSON.stringify(tags || []) },
      }
    );
    const updated = await queryOne('SELECT * FROM DC_Documents WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Document not found' });
    res.json(mapDoc(updated));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update document' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM DC_Documents WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete document' });
  }
});

// ── POST /api/documents/:id/upload — attach a file to an existing document ───
router.post('/:id/upload', authenticateToken, requireAdmin, async (req, res) => {
  const { fileData, fileName } = req.body;

  const validation = validateFile(fileData);
  if (!validation.valid) return res.status(400).json({ message: validation.error });

  try {
    const pool = await getPool();
    await pool.request()
      .input('id',       sql.NVarChar(36),       req.params.id)
      .input('fileData', sql.NVarChar(sql.MAX),   fileData)
      .input('fileName', sql.NVarChar(300),        fileName || `file.${validation.ext}`)
      .input('fileSize', sql.NVarChar(50),         formatFileSize(validation.sizeBytes))
      .input('fileType', sql.NVarChar(20),         validation.ext)
      .query(`UPDATE DC_Documents SET
        FileData=@fileData, FileName=@fileName,
        FileSize=@fileSize, FileType=@fileType
        WHERE Id=@id`);

    const rows = await query('SELECT * FROM DC_Documents WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!rows[0]) return res.status(404).json({ message: 'Document not found' });
    res.json(mapDoc(rows[0]));
  } catch (err) {
    console.error('Document upload error:', err.message);
    res.status(500).json({ message: 'Failed to upload file' });
  }
});

// ── DELETE /api/documents/:id/upload — remove attached file ──────────────────
router.delete('/:id/upload', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute(
      `UPDATE DC_Documents SET FileData=NULL, FileName='', FileSize='', FileType='pdf' WHERE Id=@id`,
      { id: { type: sql.NVarChar, value: req.params.id } }
    );
    res.json({ message: 'File removed' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to remove file' });
  }
});

module.exports = router;
