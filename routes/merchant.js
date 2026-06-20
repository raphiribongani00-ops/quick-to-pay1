const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const auth = require('../auth');

router.use(auth.authMiddleware(['merchant']));

router.get('/dashboard', (req, res) => {
  res.render('merchant-dashboard', { user: req.user });
});

router.get('/api/info', (req, res) => {
  const merchantId = req.user.userId;
  const merchant = db.prepare("SELECT store_name, store_qr_code FROM merchants WHERE user_id = ?").get(merchantId);
  if (!merchant) return res.status(500).json({ error: 'Merchant not found' });
  res.json(merchant);
});

// Standard products
router.get('/api/products', (req, res) => {
  const merchantId = req.user.userId;
  const products = db.prepare(`
    SELECT mp.barcode, gp.name, mp.price, mp.stock, gp.image_url
    FROM merchant_products mp
    JOIN global_products gp ON mp.barcode = gp.barcode
    WHERE mp.merchant_id = ?
    ORDER BY gp.name
  `).all(merchantId);
  res.json(products);
});

router.post('/api/product', (req, res) => {
  const { barcode, price, stock } = req.body;
  const merchantId = req.user.userId;
  if (!barcode || price === undefined) return res.status(400).json({ error: 'Missing barcode or price' });

  // Ensure product exists in global_products
  const existing = db.prepare("SELECT barcode FROM global_products WHERE barcode = ?").get(barcode);
  if (!existing) {
    db.prepare("INSERT INTO global_products (barcode, name) VALUES (?, ?)").run(barcode, `Product ${barcode}`);
  }

  const finalStock = (stock !== undefined && stock !== null) ? stock : 999;
  db.prepare(`
    INSERT INTO merchant_products (merchant_id, barcode, price, stock) 
    VALUES (?, ?, ?, ?) 
    ON CONFLICT(merchant_id, barcode) DO UPDATE SET price = excluded.price, stock = excluded.stock
  `).run(merchantId, barcode, price, finalStock);
  res.json({ success: true });
});

router.delete('/api/product/:barcode', (req, res) => {
  const merchantId = req.user.userId;
  const barcode = req.params.barcode;
  db.prepare("DELETE FROM merchant_products WHERE merchant_id = ? AND barcode = ?").run(merchantId, barcode);
  res.json({ success: true });
});

// Custom products
router.get('/api/custom-products', (req, res) => {
  const merchantId = req.user.userId;
  const products = db.prepare("SELECT * FROM merchant_custom_products WHERE merchant_id = ? ORDER BY created_at DESC").all(merchantId);
  res.json(products);
});

router.post('/api/custom-products', (req, res) => {
  const { name, description, price_cents, image_url } = req.body;
  const merchantId = req.user.userId;
  if (!name || !price_cents) return res.status(400).json({ error: 'Name and price required' });
  const id = uuidv4();
  const token = uuidv4();
  db.prepare(`
    INSERT INTO merchant_custom_products (id, merchant_id, name, description, price_cents, image_url, qr_code_token)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, merchantId, name, description || '', price_cents, image_url || '', token);
  res.json({ success: true, productId: id, qrToken: token });
});

router.put('/api/custom-products/:id', (req, res) => {
  const { name, description, price_cents, image_url } = req.body;
  const productId = req.params.id;
  const merchantId = req.user.userId;
  db.prepare(`
    UPDATE merchant_custom_products SET name = ?, description = ?, price_cents = ?, image_url = ? WHERE id = ? AND merchant_id = ?
  `).run(name, description || '', price_cents, image_url || '', productId, merchantId);
  res.json({ success: true });
});

router.delete('/api/custom-products/:id', (req, res) => {
  const productId = req.params.id;
  const merchantId = req.user.userId;
  db.prepare("DELETE FROM merchant_custom_products WHERE id = ? AND merchant_id = ?").run(productId, merchantId);
  res.json({ success: true });
});

// Transactions & reports
router.get('/api/transactions', (req, res) => {
  const merchantId = req.user.userId;
  const transactions = db.prepare(`
    SELECT t.id, t.total_cents, t.created_at, t.status, u.name as customer_name
    FROM transactions t
    JOIN users u ON t.customer_id = u.id
    WHERE t.merchant_id = ?
    ORDER BY t.created_at DESC LIMIT 50
  `).all(merchantId);
  res.json(transactions);
});

router.get('/api/transaction/:id', (req, res) => {
  const transactionId = req.params.id;
  const merchantId = req.user.userId;
  const transaction = db.prepare("SELECT * FROM transactions WHERE id = ? AND merchant_id = ?").get(transactionId, merchantId);
  if (!transaction) return res.status(404).json({ error: 'Transaction not found' });
  const items = db.prepare(`
    SELECT ti.*, gp.name, gp.image_url
    FROM transaction_items ti
    JOIN global_products gp ON ti.barcode = gp.barcode
    WHERE ti.transaction_id = ?
  `).all(transactionId);
  res.json({ transaction, items });
});

router.get('/api/revenue', (req, res) => {
  const merchantId = req.user.userId;
  const now = Math.floor(Date.now() / 1000);
  const startOfDay = new Date().setHours(0,0,0,0) / 1000;
  const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime() / 1000;
  const result = db.prepare(`
    SELECT 
      SUM(CASE WHEN created_at >= ? THEN total_cents ELSE 0 END) as today,
      SUM(CASE WHEN created_at >= ? THEN total_cents ELSE 0 END) as this_month,
      SUM(total_cents) as total
    FROM transactions
    WHERE merchant_id = ? AND status = 'paid'
  `).get(startOfDay, startOfMonth, merchantId);
  res.json({
    today: result.today || 0,
    this_month: result.this_month || 0,
    total: result.total || 0
  });
});

router.get('/api/complaints', (req, res) => {
  const merchantId = req.user.userId;
  const complaints = db.prepare(`
    SELECT c.id, c.message, c.resolved, c.created_at, u.name as customer_name
    FROM complaints c
    JOIN users u ON c.from_user_id = u.id
    WHERE c.merchant_id = ?
    ORDER BY c.created_at DESC
  `).all(merchantId);
  res.json(complaints);
});

router.post('/api/verify-payment', (req, res) => {
  const { transactionId } = req.body;
  const merchantId = req.user.userId;
  const transaction = db.prepare("SELECT * FROM transactions WHERE id = ? AND merchant_id = ? AND status = 'paid'").get(transactionId, merchantId);
  if (!transaction) return res.json({ success: false, message: 'Invalid or already verified' });
  const items = db.prepare(`
    SELECT ti.*, gp.name, gp.image_url
    FROM transaction_items ti
    JOIN global_products gp ON ti.barcode = gp.barcode
    WHERE ti.transaction_id = ?
  `).all(transactionId);
  res.json({ success: true, transaction, items });
});

router.post('/api/confirm-release', (req, res) => {
  const { transactionId } = req.body;
  const merchantId = req.user.userId;
  const now = Math.floor(Date.now() / 1000);
  const result = db.prepare(`
    UPDATE transactions SET status = 'completed', completed_at = ? WHERE id = ? AND merchant_id = ? AND status = 'paid'
  `).run(now, transactionId, merchantId);
  if (result.changes === 0) return res.status(400).json({ success: false, message: 'Could not confirm' });
  res.json({ success: true });
});

router.get('/api/search-global', (req, res) => {
  const query = req.query.q || '';
  const products = db.prepare(`
    SELECT barcode, name, image_url FROM global_products WHERE barcode LIKE ? OR name LIKE ? LIMIT 10
  `).all(`%${query}%`, `%${query}%`);
  res.json(products);
});

module.exports = router;