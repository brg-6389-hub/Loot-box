/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Garante que a pasta de dados existe antes de abrir a base de dados SQLite.
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(path.join(dataDir, 'lootbox.db'));
db.pragma('foreign_keys = ON');

// Gera identificadores curtos com um prefixo para distinguir entidades.
function uid(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 11)}`;
}

// Cria a estrutura principal da base de dados e aplica pequenas migracoes incrementais.
function createSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      username TEXT,
      phone TEXT,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'cliente',
      is_blocked INTEGER NOT NULL DEFAULT 0,
      avatar TEXT,
      avatar_url TEXT,
      email_verified INTEGER NOT NULL DEFAULT 1,
      email_verify_token TEXT,
      email_verify_expires_at TEXT,
      phone_verified INTEGER NOT NULL DEFAULT 0,
      phone_verify_token TEXT,
      phone_verify_expires_at TEXT,
      reset_token TEXT,
      reset_expires_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_methods (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      label TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      brand TEXT,
      last4 TEXT,
      holder_name TEXT,
      expires_at TEXT,
      phone TEXT,
      email TEXT,
      iban TEXT,
      details TEXT,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      price REAL NOT NULL,
      category TEXT NOT NULL,
      image TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      buyer_id TEXT,
      status TEXT NOT NULL DEFAULT 'available',
      created_at TEXT NOT NULL,
      FOREIGN KEY(seller_id) REFERENCES users(id),
      FOREIGN KEY(buyer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS favorites (
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      PRIMARY KEY(user_id, product_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      user_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY(user_id, product_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      buyer_id TEXT NOT NULL,
      subtotal REAL NOT NULL,
      service_fee REAL NOT NULL,
      total REAL NOT NULL,
      payment_method_id TEXT,
      payment_method_label TEXT,
      shipping_address TEXT NOT NULL,
      note TEXT,
      status TEXT NOT NULL,
      shipped_at TEXT,
      completed_at TEXT,
      tracking_code TEXT,
      shipping_carrier TEXT,
      shipping_proof TEXT,
      shipping_note TEXT,
      dispute_status TEXT,
      dispute_opened_by TEXT,
      dispute_reason TEXT,
      dispute_details TEXT,
      dispute_evidence TEXT,
      dispute_resolution_note TEXT,
      dispute_created_at TEXT,
      dispute_resolved_at TEXT,
      stripe_session_id TEXT,
      stripe_payment_intent TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(buyer_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      price REAL NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      product_id TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(product_id) REFERENCES products(id)
    );

    CREATE TABLE IF NOT EXISTS conversation_participants (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      PRIMARY KEY(conversation_id, user_id),
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
      FOREIGN KEY(sender_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      seller_id TEXT NOT NULL,
      buyer_id TEXT NOT NULL,
      rating INTEGER NOT NULL,
      comment TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY(seller_id) REFERENCES users(id),
      FOREIGN KEY(buyer_id) REFERENCES users(id)
    );
  `);

  const userColumns = db.prepare(`PRAGMA table_info(users)`).all();
  const names = new Set(userColumns.map((c) => c.name));
  if (!names.has('email_verified')) {
    db.exec(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1;`);
  }
  if (!names.has('is_blocked')) {
    db.exec(`ALTER TABLE users ADD COLUMN is_blocked INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!names.has('role')) {
    db.exec(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'cliente';`);
    db.exec(`
      UPDATE users
      SET role = 'destribuidior'
      WHERE id IN (SELECT DISTINCT seller_id FROM products);
    `);
  }
  db.exec(`UPDATE users SET role = 'cliente' WHERE role = 'comprador';`);
  db.exec(`UPDATE users SET role = 'destribuidior' WHERE role = 'vendedor';`);
  if (!names.has('email_verify_token')) {
    db.exec(`ALTER TABLE users ADD COLUMN email_verify_token TEXT;`);
  }
  if (!names.has('email_verify_expires_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN email_verify_expires_at TEXT;`);
  }
  if (!names.has('username')) {
    db.exec(`ALTER TABLE users ADD COLUMN username TEXT;`);
  }
  if (!names.has('phone')) {
    db.exec(`ALTER TABLE users ADD COLUMN phone TEXT;`);
  }
  if (!names.has('phone_verified')) {
    db.exec(`ALTER TABLE users ADD COLUMN phone_verified INTEGER NOT NULL DEFAULT 0;`);
  }
  if (!names.has('phone_verify_token')) {
    db.exec(`ALTER TABLE users ADD COLUMN phone_verify_token TEXT;`);
  }
  if (!names.has('phone_verify_expires_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN phone_verify_expires_at TEXT;`);
  }
  if (!names.has('reset_token')) {
    db.exec(`ALTER TABLE users ADD COLUMN reset_token TEXT;`);
  }
  if (!names.has('reset_expires_at')) {
    db.exec(`ALTER TABLE users ADD COLUMN reset_expires_at TEXT;`);
  }
  if (!names.has('avatar_url')) {
    db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`);
  }

  const paymentColumns = db.prepare(`PRAGMA table_info(payment_methods)`).all();
  const paymentNames = new Set(paymentColumns.map((c) => c.name));
  if (!paymentNames.has('iban')) {
    db.exec(`ALTER TABLE payment_methods ADD COLUMN iban TEXT;`);
  }
  if (!paymentNames.has('details')) {
    db.exec(`ALTER TABLE payment_methods ADD COLUMN details TEXT;`);
  }
  db.exec(`UPDATE payment_methods SET type = 'multibanco' WHERE type = 'bank';`);

  const productColumns = db.prepare(`PRAGMA table_info(products)`).all();
  const productNames = new Set(productColumns.map((c) => c.name));
  if (!productNames.has('updated_at')) {
    db.exec(`ALTER TABLE products ADD COLUMN updated_at TEXT;`);
    db.exec(`UPDATE products SET updated_at = created_at WHERE updated_at IS NULL;`);
  }

  const orderColumns = db.prepare(`PRAGMA table_info(orders)`).all();
  const orderNames = new Set(orderColumns.map((c) => c.name));
  const addOrderColumn = (name, definition) => {
    if (!orderNames.has(name)) db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${definition};`);
  };
  addOrderColumn('payment_method_label', 'TEXT');
  addOrderColumn('shipped_at', 'TEXT');
  addOrderColumn('completed_at', 'TEXT');
  addOrderColumn('tracking_code', 'TEXT');
  addOrderColumn('shipping_carrier', 'TEXT');
  addOrderColumn('shipping_proof', 'TEXT');
  addOrderColumn('shipping_note', 'TEXT');
  addOrderColumn('dispute_status', 'TEXT');
  addOrderColumn('dispute_opened_by', 'TEXT');
  addOrderColumn('dispute_reason', 'TEXT');
  addOrderColumn('dispute_details', 'TEXT');
  addOrderColumn('dispute_evidence', 'TEXT');
  addOrderColumn('dispute_resolution_note', 'TEXT');
  addOrderColumn('dispute_created_at', 'TEXT');
  addOrderColumn('dispute_resolved_at', 'TEXT');
}

function seed() {
  // A base deve arrancar vazia para refletir apenas dados reais criados na app.
}

export function initDb() {
  createSchema();
  seed();
}

export function createId(prefix) {
  return uid(prefix);
}
