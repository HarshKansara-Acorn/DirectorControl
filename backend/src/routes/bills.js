const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { query, queryOne, execute, sql } = require('../config/db');

const mapBill = (r) => ({
  id: r.Id, title: r.Title, vendor: r.Vendor, category: r.Category,
  directorId: r.DirectorId, amount: parseFloat(r.Amount), currency: r.Currency,
  dueDate: r.DueDate ? r.DueDate.toISOString().split('T')[0] : null,
  dueTime: r.DueTime || null,
  status: r.Status, invoiceNumber: r.InvoiceNumber, notes: r.Notes,
  paidDate: r.PaidDate ? r.PaidDate.toISOString().split('T')[0] : null,
  createdBy: r.CreatedBy, createdAt: r.CreatedAt,
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { directorId, status } = req.query;
    const targetId = req.user.role === 'director' ? req.user.id : (directorId || null);
    let q = 'SELECT * FROM DC_Bills WHERE 1=1';
    const params = {};
    if (targetId) { q += ' AND DirectorId=@id'; params.id = { type: sql.NVarChar, value: targetId }; }
    if (status && status !== 'all') { q += ' AND Status=@status'; params.status = { type: sql.NVarChar, value: status }; }
    q += ' ORDER BY DueDate';
    const rows = await query(q, params);
    res.json(rows.map(mapBill));
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bills' });
  }
});

router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  const { title, vendor, category, directorId, amount, currency, dueDate, dueTime, invoiceNumber, notes } = req.body;
  if (!title || !directorId || !amount) return res.status(400).json({ message: 'Title, directorId and amount are required' });
  try {
    const id = uuidv4();
    await execute(
      `INSERT INTO DC_Bills (Id,Title,Vendor,Category,DirectorId,Amount,Currency,DueDate,DueTime,Status,InvoiceNumber,Notes,CreatedBy)
       VALUES (@id,@title,@vendor,@category,@directorId,@amount,@currency,@dueDate,@dueTime,'pending',@invoiceNumber,@notes,@createdBy)`,
      {
        id: { type: sql.NVarChar, value: id },
        title: { type: sql.NVarChar, value: title },
        vendor: { type: sql.NVarChar, value: vendor || '' },
        category: { type: sql.NVarChar, value: category || 'General' },
        directorId: { type: sql.NVarChar, value: directorId },
        amount: { type: sql.Float, value: Number(amount) },
        currency: { type: sql.NVarChar, value: currency || '₹' },
        dueDate: { type: sql.Date, value: dueDate ? new Date(dueDate) : null },
        dueTime: { type: sql.NVarChar, value: dueTime || null },
        invoiceNumber: { type: sql.NVarChar, value: invoiceNumber || '' },
        notes: { type: sql.NVarChar, value: notes || '' },
        createdBy: { type: sql.NVarChar, value: req.user.id },
      }
    );
    const created = await queryOne('SELECT * FROM DC_Bills WHERE Id=@id', { id: { type: sql.NVarChar, value: id } });
    res.status(201).json(mapBill(created));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Failed to create bill' });
  }
});

router.patch('/:id/status', authenticateToken, async (req, res) => {
  const { status, paidDate } = req.body;
  try {
    const pd = status === 'paid' ? (paidDate ? new Date(paidDate) : new Date()) : null;
    await execute(
      'UPDATE DC_Bills SET Status=@status, PaidDate=@paidDate WHERE Id=@id',
      {
        id: { type: sql.NVarChar, value: req.params.id },
        status: { type: sql.NVarChar, value: status },
        paidDate: { type: sql.Date, value: pd },
      }
    );
    const updated = await queryOne('SELECT * FROM DC_Bills WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Bill not found' });
    res.json(mapBill(updated));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update bill status' });
  }
});

router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { title, vendor, category, amount, currency, dueDate, dueTime, invoiceNumber, notes } = req.body;
  try {
    await execute(
      'UPDATE DC_Bills SET Title=@title,Vendor=@vendor,Category=@category,Amount=@amount,Currency=@currency,DueDate=@dueDate,DueTime=@dueTime,InvoiceNumber=@invoiceNumber,Notes=@notes WHERE Id=@id',
      {
        id: { type: sql.NVarChar, value: req.params.id },
        title: { type: sql.NVarChar, value: title },
        vendor: { type: sql.NVarChar, value: vendor || '' },
        category: { type: sql.NVarChar, value: category || 'General' },
        amount: { type: sql.Float, value: Number(amount) },
        currency: { type: sql.NVarChar, value: currency || '₹' },
        dueDate: { type: sql.Date, value: dueDate ? new Date(dueDate) : null },
        dueTime: { type: sql.NVarChar, value: dueTime || null },
        invoiceNumber: { type: sql.NVarChar, value: invoiceNumber || '' },
        notes: { type: sql.NVarChar, value: notes || '' },
      }
    );
    const updated = await queryOne('SELECT * FROM DC_Bills WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    if (!updated) return res.status(404).json({ message: 'Bill not found' });
    res.json(mapBill(updated));
  } catch (err) {
    res.status(500).json({ message: 'Failed to update bill' });
  }
});

router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    await execute('DELETE FROM DC_Bills WHERE Id=@id', { id: { type: sql.NVarChar, value: req.params.id } });
    res.json({ message: 'Bill deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete bill' });
  }
});

module.exports = router;
