const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const auth = require('../auth');

router.get('/', (req, res) => {
  res.render('landing');
});

// ============ CUSTOMER ============
router.get('/customer/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Customer Login - Scan to Pay</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-black text-white"><div class="container mx-auto max-w-md p-6 mt-20"><h1 class="text-2xl font-bold text-yellow-400 mb-6">Customer Login</h1>
    <form method="POST" action="/customer/login"><input type="email" name="email" placeholder="Email" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="password" name="password" placeholder="Password" class="w-full p-3 mb-3 rounded bg-gray-800" required><button type="submit" class="w-full bg-yellow-500 text-black py-3 rounded font-bold">Login</button></form>
    <p class="mt-4 text-center">No account? <a href="/customer/register" class="text-yellow-400">Register</a></p><p class="mt-4 text-center"><a href="/" class="text-gray-400">Back</a></p></div></body></html>
  `);
});
router.post('/customer/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND role = 'customer'").get(email);
  if (!user) return res.send('Invalid credentials');
  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) return res.send('Invalid credentials');
  const token = auth.generateToken(user.id, 'customer');
  res.cookie('token', token, { httpOnly: true });
  res.redirect('/customer/dashboard');
});
router.get('/customer/register', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Customer Register - Scan to Pay</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-black text-white"><div class="container mx-auto max-w-md p-6 mt-20"><h1 class="text-2xl font-bold text-yellow-400 mb-6">Customer Register</h1>
    <form method="POST" action="/customer/register"><input type="text" name="name" placeholder="Full Name" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="email" name="email" placeholder="Email" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="password" name="password" placeholder="Password" class="w-full p-3 mb-3 rounded bg-gray-800" required><button type="submit" class="w-full bg-yellow-500 text-black py-3 rounded font-bold">Register</button></form>
    <p class="mt-4 text-center">Already have an account? <a href="/customer/login" class="text-yellow-400">Login</a></p><p class="mt-4 text-center"><a href="/" class="text-gray-400">Back</a></p></div></body></html>
  `);
});
router.post('/customer/register', (req, res) => {
  const { email, password, name } = req.body;
  const hashed = bcrypt.hashSync(password, 10);
  const id = uuidv4();
  try {
    db.prepare("INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, 'customer', ?)")
      .run(id, email, hashed, name);
    const token = auth.generateToken(id, 'customer');
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/customer/dashboard');
  } catch (err) {
    res.send('Email already exists');
  }
});

// ============ MERCHANT ============
router.get('/merchant/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Merchant Login - Scan to Pay</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-black text-white"><div class="container mx-auto max-w-md p-6 mt-20"><h1 class="text-2xl font-bold text-yellow-400 mb-6">Merchant Login</h1>
    <form method="POST" action="/merchant/login"><input type="email" name="email" placeholder="Email" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="password" name="password" placeholder="Password" class="w-full p-3 mb-3 rounded bg-gray-800" required><button type="submit" class="w-full bg-yellow-500 text-black py-3 rounded font-bold">Login</button></form>
    <p class="mt-4 text-center">No account? <a href="/merchant/register" class="text-yellow-400">Register</a></p><p class="mt-4 text-center"><a href="/" class="text-gray-400">Back</a></p></div></body></html>
  `);
});
router.post('/merchant/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND role = 'merchant'").get(email);
  if (!user) return res.send('Invalid credentials');
  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) return res.send('Invalid credentials');
  const token = auth.generateToken(user.id, 'merchant');
  res.cookie('token', token, { httpOnly: true });
  res.redirect('/merchant/dashboard');
});
router.get('/merchant/register', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Merchant Register - Scan to Pay</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-black text-white"><div class="container mx-auto max-w-md p-6 mt-20"><h1 class="text-2xl font-bold text-yellow-400 mb-6">Merchant Registration</h1>
    <form method="POST" action="/merchant/register"><input type="text" name="store_name" placeholder="Store Name" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="email" name="email" placeholder="Email" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="password" name="password" placeholder="Password" class="w-full p-3 mb-3 rounded bg-gray-800" required><button type="submit" class="w-full bg-yellow-500 text-black py-3 rounded font-bold">Register</button></form>
    <p class="mt-4 text-center">Already registered? <a href="/merchant/login" class="text-yellow-400">Login</a></p><p class="mt-4 text-center"><a href="/" class="text-gray-400">Back</a></p></div></body></html>
  `);
});
router.post('/merchant/register', (req, res) => {
  const { email, password, store_name } = req.body;
  const hashed = bcrypt.hashSync(password, 10);
  const userId = uuidv4();
  const storeQr = uuidv4();
  try {
    db.prepare("INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, 'merchant', ?)")
      .run(userId, email, hashed, store_name);
    db.prepare("INSERT INTO merchants (user_id, store_name, store_qr_code) VALUES (?, ?, ?)")
      .run(userId, store_name, storeQr);
    const token = auth.generateToken(userId, 'merchant');
    res.cookie('token', token, { httpOnly: true });
    res.redirect('/merchant/dashboard');
  } catch (err) {
    res.send('Email already exists');
  }
});

// ============ ADMIN ============
router.get('/admin/login', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Admin Login - Scan to Pay</title><script src="https://cdn.tailwindcss.com"></script></head>
    <body class="bg-black text-white"><div class="container mx-auto max-w-md p-6 mt-20"><h1 class="text-2xl font-bold text-yellow-400 mb-6">Admin Login</h1>
    <form method="POST" action="/admin/login"><input type="email" name="email" placeholder="Email" class="w-full p-3 mb-3 rounded bg-gray-800" required><input type="password" name="password" placeholder="Password" class="w-full p-3 mb-3 rounded bg-gray-800" required><button type="submit" class="w-full bg-yellow-500 text-black py-3 rounded font-bold">Login</button></form>
    <p class="mt-4 text-center"><a href="/" class="text-gray-400">Back</a></p></div></body></html>
  `);
});
router.post('/admin/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND role = 'admin'").get(email);
  if (!user) return res.send('Invalid admin credentials');
  const match = bcrypt.compareSync(password, user.password_hash);
  if (!match) return res.send('Invalid credentials');
  const token = auth.generateToken(user.id, 'admin');
  res.cookie('token', token, { httpOnly: true });
  res.redirect('/admin/dashboard');
});

// ============ LOGOUT ============
router.get('/customer/logout', (req, res) => { res.clearCookie('token'); res.redirect('/'); });
router.get('/merchant/logout', (req, res) => { res.clearCookie('token'); res.redirect('/'); });
router.get('/admin/logout', (req, res) => { res.clearCookie('token'); res.redirect('/'); });

module.exports = router;