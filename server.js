require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const db = require('./db');
const auth = require('./auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

const publicRoutes = require('./routes/public');
const customerRoutes = require('./routes/customer');
const merchantRoutes = require('./routes/merchant');
const adminRoutes = require('./routes/admin');

app.use('/', publicRoutes);
app.use('/customer', customerRoutes);
app.use('/merchant', merchantRoutes);
app.use('/admin', adminRoutes);

// Seed admin if not exists
const adminRow = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
if (!adminRow) {
  const hashed = bcrypt.hashSync('admin123', 10);
  const adminId = uuidv4();
  db.prepare("INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, 'admin', ?)")
    .run(adminId, 'admin@quick2pay.com', hashed, 'Super Admin');
  console.log('Default admin created: admin@quick2pay.com / admin123');
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Scan to Pay running at http://localhost:${PORT}`);
});