const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const auth = require('../auth');

router.use(auth.authMiddleware(['admin']));

router.get('/dashboard', (req, res) => {
  res.render('admin-dashboard', { user: req.user });
});

// Products
router.get('/api/products', (req, res) => {
  const products = db.prepare("SELECT barcode, name, image_url FROM global_products ORDER BY name").all();
  res.json(products);
});

router.post('/api/products', (req, res) => {
  const { barcode, name, image_url } = req.body;
  if (!barcode || !name) return res.status(400).json({ error: 'Barcode and name required' });
  try {
    db.prepare("INSERT INTO global_products (barcode, name, image_url) VALUES (?, ?, ?)").run(barcode, name, image_url || '');
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/api/products/:barcode', (req, res) => {
  const { name, image_url } = req.body;
  const barcode = req.params.barcode;
  db.prepare("UPDATE global_products SET name = ?, image_url = ? WHERE barcode = ?").run(name, image_url || '', barcode);
  res.json({ success: true });
});

router.delete('/api/products/:barcode', (req, res) => {
  const barcode = req.params.barcode;
  db.prepare("DELETE FROM global_products WHERE barcode = ?").run(barcode);
  res.json({ success: true });
});

// Merchants
router.get('/api/merchants', (req, res) => {
  const merchants = db.prepare(`
    SELECT u.id, u.email, u.name as store_name, m.store_qr_code, u.created_at
    FROM users u JOIN merchants m ON u.id = m.user_id
    WHERE u.role = 'merchant' ORDER BY u.created_at DESC
  `).all();
  res.json(merchants);
});

router.delete('/api/merchants/:userId', (req, res) => {
  const userId = req.params.userId;
  const result = db.prepare("DELETE FROM users WHERE id = ? AND role = 'merchant'").run(userId);
  if (result.changes === 0) return res.status(404).json({ error: 'Merchant not found' });
  res.json({ success: true });
});

router.get('/api/merchant-products/:merchantId', (req, res) => {
  const merchantId = req.params.merchantId;
  const products = db.prepare(`
    SELECT mp.barcode, gp.name, mp.price, mp.stock, gp.image_url
    FROM merchant_products mp
    JOIN global_products gp ON mp.barcode = gp.barcode
    WHERE mp.merchant_id = ?
    ORDER BY gp.name
  `).all(merchantId);
  res.json(products);
});

router.get('/api/merchant-customers/:merchantId', (req, res) => {
  const merchantId = req.params.merchantId;
  const result = db.prepare("SELECT COUNT(DISTINCT customer_id) as count FROM transactions WHERE merchant_id = ?").get(merchantId);
  res.json({ count: result.count || 0 });
});

// Transactions
router.get('/api/transactions', (req, res) => {
  const transactions = db.prepare(`
    SELECT t.id, t.total_cents, t.status, t.created_at, t.completed_at, u.name as customer_name, m.store_name
    FROM transactions t
    JOIN users u ON t.customer_id = u.id
    JOIN merchants m ON t.merchant_id = m.user_id
    ORDER BY t.created_at DESC LIMIT 100
  `).all();
  res.json(transactions);
});

router.get('/api/transaction-items/:transactionId', (req, res) => {
  const transactionId = req.params.transactionId;
  const items = db.prepare(`
    SELECT ti.*, gp.name, gp.image_url
    FROM transaction_items ti
    JOIN global_products gp ON ti.barcode = gp.barcode
    WHERE ti.transaction_id = ?
  `).all(transactionId);
  res.json(items);
});

// Invoices
router.get('/api/invoices', (req, res) => {
  const invoices = db.prepare(`
    SELECT i.*, m.store_name FROM invoices i JOIN merchants m ON i.merchant_id = m.user_id ORDER BY i.created_at DESC
  `).all();
  res.json(invoices);
});

router.post('/api/invoices', (req, res) => {
  const { merchant_id, period_start, period_end, total_platform_fee_cents, payout_amount_cents } = req.body;
  const id = uuidv4();
  const now = Math.floor(Date.now() / 1000);
  db.prepare(`
    INSERT INTO invoices (id, merchant_id, period_start, period_end, total_platform_fee_cents, payout_amount_cents, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, merchant_id, period_start, period_end, total_platform_fee_cents, payout_amount_cents, now);
  res.json({ success: true, invoiceId: id });
});

router.post('/api/invoices/:id/pay', (req, res) => {
  const id = req.params.id;
  db.prepare("UPDATE invoices SET paid = 1 WHERE id = ?").run(id);
  res.json({ success: true });
});

// Complaints
router.get('/api/complaints', (req, res) => {
  const complaints = db.prepare(`
    SELECT c.*, u.name as customer_name, m.store_name
    FROM complaints c
    JOIN users u ON c.from_user_id = u.id
    JOIN merchants m ON c.merchant_id = m.user_id
    ORDER BY c.created_at DESC
  `).all();
  res.json(complaints);
});

router.post('/api/complaints/:id/resolve', (req, res) => {
  const id = req.params.id;
  db.prepare("UPDATE complaints SET resolved = 1 WHERE id = ?").run(id);
  res.json({ success: true });
});

// Reports
router.get('/api/reports/platform-revenue', (req, res) => {
  const result = db.prepare(`
    SELECT SUM(total_cents) as total_volume, COUNT(*) as total_transactions, AVG(total_cents) as avg_transaction
    FROM transactions WHERE status = 'paid'
  `).get();
  res.json(result);
});

module.exports = router;