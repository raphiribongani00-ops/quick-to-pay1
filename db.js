const Database = require('better-sqlite3');
const path = require('path');

// Use local directory (not /data/) – this works on Render's free tier
// The database will be created in your project folder
const dbPath = './database.sqlite';
console.log(`📁 Using database at: ${dbPath}`);

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT CHECK(role IN ('customer', 'merchant', 'admin')) NOT NULL,
    name TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
  );

  CREATE TABLE IF NOT EXISTS merchants (
    user_id TEXT PRIMARY KEY,
    store_name TEXT NOT NULL,
    store_qr_code TEXT UNIQUE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS global_products (
    barcode TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT
  );

  CREATE TABLE IF NOT EXISTS merchant_products (
    merchant_id TEXT,
    barcode TEXT,
    price INTEGER NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (merchant_id, barcode),
    FOREIGN KEY (merchant_id) REFERENCES merchants(user_id),
    FOREIGN KEY (barcode) REFERENCES global_products(barcode)
  );

  CREATE TABLE IF NOT EXISTS merchant_custom_products (
    id TEXT PRIMARY KEY,
    merchant_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL,
    image_url TEXT,
    qr_code_token TEXT UNIQUE NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (merchant_id) REFERENCES merchants(user_id)
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY,
    customer_id TEXT,
    merchant_id TEXT,
    total_cents INTEGER NOT NULL,
    status TEXT DEFAULT 'paid',
    payment_aggregator_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    completed_at INTEGER,
    FOREIGN KEY (customer_id) REFERENCES users(id),
    FOREIGN KEY (merchant_id) REFERENCES merchants(user_id)
  );

  CREATE TABLE IF NOT EXISTS transaction_items (
    transaction_id TEXT,
    barcode TEXT,
    quantity INTEGER NOT NULL,
    price_cents INTEGER NOT NULL,
    PRIMARY KEY (transaction_id, barcode),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id),
    FOREIGN KEY (barcode) REFERENCES global_products(barcode)
  );

  CREATE TABLE IF NOT EXISTS complaints (
    id TEXT PRIMARY KEY,
    from_user_id TEXT,
    merchant_id TEXT,
    transaction_id TEXT,
    message TEXT,
    resolved INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (from_user_id) REFERENCES users(id),
    FOREIGN KEY (merchant_id) REFERENCES merchants(user_id),
    FOREIGN KEY (transaction_id) REFERENCES transactions(id)
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    merchant_id TEXT,
    period_start INTEGER,
    period_end INTEGER,
    total_platform_fee_cents INTEGER,
    payout_amount_cents INTEGER,
    paid INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (merchant_id) REFERENCES merchants(user_id)
  );
`);

console.log('✅ SQLite database tables ready');

// Export the database instance
module.exports = db;