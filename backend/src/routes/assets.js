const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, sql } = require('../config/db');

const mapAsset = (r) => ({
  id: r.Id, name: r.Name, description: r.Description,
  category: r.Category, directorId: r.DirectorId,
  serialNumber: r.SerialNumber,
  purchaseDate: r.PurchaseDate ? r.PurchaseDate.toISOString().split('T')[0] : null,
  purchaseValue: parseFloat(r.PurchaseValue || 0),
  currentValue: parseFloat(r.CurrentValue || 0),
  currency: r.Currency, status: r.Status, location: r.Location,
  warrantyExpiry: r.WarrantyExpiry ? r.WarrantyExpiry.toISOString().split('T')[0] : null,
  assignedTo: r.AssignedTo, createdBy: r.CreatedBy, createdAt: r.CreatedAt,
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { directorId, category, status } = req.query;
    const targetId = req.user.role === 'director' ? req.user.id : (directorId || null);
    let q = 'SELECT * FROM DC_Assets WHERE 1=1';
    const params = {};
    if (targetId) { q += ' AND DirectorId=@id'; params.id = { type: sql.NVarChar, value: targetId }; }
    if (category && category !== 'all') { q += ' AND Category=@cat'; params.cat = { type: sql.NVarChar, value: category }; }
    if (status && status !== 'all') { q += ' AND Status=@status'; params.status = { type: sql.NVarChar, value: status }; }
    q += ' ORDER BY CreatedAt DESC';
    const rows = await query(q, params);
    res.json(rows.map(mapAsset));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch assets' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { name, description, category, directorId, serialNumber, purchaseDate, purchaseValue, currency, location, warrantyExpiry, assignedTo } = req.body;
  if (!name || !directorId) return res.status(400).json({ message: 'Name and directorId are required' });
  try {
    const id = uuidv4();
    const pv = purchaseValue ? Number(purchaseValue) : 0;
    await execute(
      `INSERT INTO DC_Assets (Id,Name,Description,Category,DirectorId,SerialNumber,PurchaseDate,PurchaseValue,CurrentValue,Currency,Status,Location,WarrantyExpiry,AssignedTo,CreatedBy)
       VALUES (@id,@name,@desc,@category,@directorId,@serial,@purchaseDate,@pv,@pv,@currency,'active',@location,@warrantyExpiry,@assignedTo,@createdBy)`,
      {
        id: { type: sql.NVarChar, value: id },
        name: { type: sql.NVarChar, value: name },
        desc: { type: sql.NVarChar, value: description || '' },
        category: { type: sql.NVarChar, value: category || 'General' },
        directorId: { type: sql.NVarChar, value: directorId },
        serial: { type: sql.NVarChar, value: serialNumber || '' },
        purchaseDate: { type: sql.Date, value: purchaseDate ? new Date(purchaseDate) : null },
        pv: { type: sql.Float, value: pv },
        currency: { type: sql.NVarChar, value: currency || '₹' },
        location: { type: sql.NVarChar, value: location || '' },
        warrantyExpiry: { type: sql.Date, value: warrantyExpiry ? new Date(warrantyExpiry) : null },
        assignedTo: { type: sql.NVarChar, value: assignedTo || '' },
        createdBy: { type: sql.NVarChar, value: req.user.id },
      }
    );
    const created = await queryOne('SELECT * FROM DC_Assets WHERE Id=@id', { id: { type: sql.NVarChar, value: id } });
    res.status(201).json(mapAsset(created));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to create asset' });
  }
});

router.patch('/:id/status', authenticateToken, requireAdmin, async (req, res) => {
  const { status } = req.body;
  try {
    await execute('UPDATE DC_Assets SET Status=@status WHERE Id=@id', {
      id: { type: sql.NVarChar, value: req.params.id },
      status: { type: sql.NVarChar, value: status },
    });
    const updated = await queryOne('SELECT * FROM DC_Assets WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Asset not found' });
    res.json(mapAsset(updated));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update asset status' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { name, description, category, serialNumber, purchaseDate, purchaseValue, currentValue, currency, location, warrantyExpiry, assignedTo } = req.body;
  try {
    await execute(
      'UPDATE DC_Assets SET Name=@name,Description=@desc,Category=@category,SerialNumber=@serial,PurchaseDate=@purchaseDate,PurchaseValue=@pv,CurrentValue=@cv,Currency=@currency,Location=@location,WarrantyExpiry=@warrantyExpiry,AssignedTo=@assignedTo WHERE Id=@id',
      {
        id: { type: sql.NVarChar, value: req.params.id },
        name: { type: sql.NVarChar, value: name },
        desc: { type: sql.NVarChar, value: description || '' },
        category: { type: sql.NVarChar, value: category || 'General' },
        serial: { type: sql.NVarChar, value: serialNumber || '' },
        purchaseDate: { type: sql.Date, value: purchaseDate ? new Date(purchaseDate) : null },
        pv: { type: sql.Float, value: purchaseValue ? Number(purchaseValue) : 0 },
        cv: { type: sql.Float, value: currentValue ? Number(currentValue) : (purchaseValue ? Number(purchaseValue) : 0) },
        currency: { type: sql.NVarChar, value: currency || '₹' },
        location: { type: sql.NVarChar, value: location || '' },
        warrantyExpiry: { type: sql.Date, value: warrantyExpiry ? new Date(warrantyExpiry) : null },
        assignedTo: { type: sql.NVarChar, value: assignedTo || '' },
      }
    );
    const updated = await queryOne('SELECT * FROM DC_Assets WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Asset not found' });
    res.json(mapAsset(updated));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update asset' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM DC_Assets WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    res.json({ message: 'Asset deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete asset' });
  }
});

module.exports = router;
