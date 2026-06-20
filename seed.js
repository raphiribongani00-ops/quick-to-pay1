const db = require('./db');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

async function seed() {
  console.log('🌱 Seeding database...');

  // Check if merchant exists
  const merchant = db.prepare("SELECT user_id FROM merchants LIMIT 1").get();
  let merchantId;

  if (!merchant) {
    const userId = uuidv4();
    const storeQr = uuidv4();
    const hashed = await bcrypt.hash('store123', 10);

    db.prepare("INSERT INTO users (id, email, password_hash, role, name) VALUES (?, ?, ?, 'merchant', ?)")
      .run(userId, 'store@example.com', hashed, 'Test Store');
    db.prepare("INSERT INTO merchants (user_id, store_name, store_qr_code) VALUES (?, ?, ?)")
      .run(userId, 'Test Store', storeQr);
    merchantId = userId;
    console.log('✅ Test merchant created: store@example.com / store123');
  } else {
    merchantId = merchant.user_id;
  }

  // Insert global products
  db.exec(`
    INSERT OR IGNORE INTO global_products (barcode, name, image_url) VALUES 
    ('123456789012', 'Test Product A', 'https://picsum.photos/id/1/100/100'),
    ('234567890123', 'Test Product B', 'https://picsum.photos/id/2/100/100'),
    ('345678901234', 'Test Product C', 'https://picsum.photos/id/3/100/100')
  `);

  // Insert merchant products
  db.prepare(`
    INSERT OR IGNORE INTO merchant_products (merchant_id, barcode, price, stock) VALUES
    (?, '123456789012', 1299, 10),
    (?, '234567890123', 2499, 5),
    (?, '345678901234', 599, 20)
  `).run(merchantId, merchantId, merchantId);

  console.log('✅ Demo products added');
  console.log('✅ Seeding complete!');
}

seed().catch(console.error);