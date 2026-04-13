/* Comentario PT-PT: ficheiro de codigo da aplicacao LootBox mantido pela equipa. */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Stripe from 'stripe';
import nodemailer from 'nodemailer';
import admin from 'firebase-admin';
import { db, initDb, createId } from './db.mjs';

// Configuracao principal do servidor HTTP e das integracoes externas.
const app = express();
const HOST = process.env.API_HOST || '127.0.0.1';
const PORT = Number(process.env.API_PORT || 8787);
const CLIENT_URL = process.env.CLIENT_URL || 'http://127.0.0.1:4173';
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me';
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || '';
const FIREBASE_CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL || '';
const FIREBASE_PRIVATE_KEY = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || '';
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';
const stripe = stripeSecretKey ? new Stripe(stripeSecretKey) : null;

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'false') === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || '';
const SMS_DEBUG = String(process.env.SMS_DEBUG || 'true') === 'true';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const mailer =
  SMTP_HOST && SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : null;

let firebaseAuth = null;
// O Firebase Admin e opcional no ambiente local, por isso tentamos inicializar sem bloquear o arranque.
if (!admin.apps.length) {
  if (FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: FIREBASE_PROJECT_ID,
        clientEmail: FIREBASE_CLIENT_EMAIL,
        privateKey: FIREBASE_PRIVATE_KEY,
      }),
    });
  } else {
    try {
      admin.initializeApp();
    } catch {
      // Firebase Admin is optional in local dev.
    }
  }
}
if (admin.apps.length > 0) {
  firebaseAuth = admin.auth();
}

function normalizeRole(role) {
  if (role === 'admin') return 'admin';
  return role === 'vendedor' || role === 'destribuidior' ? 'destribuidior' : 'cliente';
}

function normalizeUsername(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9._-]/g, '');
}

function normalizePhone(value) {
  const raw = String(value || '').trim();
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return '';
  if (digits.startsWith('+')) {
    return `+${digits.slice(1).replace(/\D/g, '')}`;
  }
  return digits.replace(/\D/g, '');
}

function maskPhone(phone) {
  const normalized = normalizePhone(phone);
  if (normalized.length <= 4) return normalized;
  return `${'*'.repeat(Math.max(0, normalized.length - 4))}${normalized.slice(-4)}`;
}

function buildUsernameBase(value) {
  const normalized = normalizeUsername(value);
  if (normalized) return normalized.slice(0, 18);
  return 'user';
}

function getNextUserNumber() {
  const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c || 0;
  return total + 1;
}

function buildSequentialUsername() {
  let number = getNextUserNumber();
  while (true) {
    const candidate = `user${number}`;
    const conflict = db.prepare('SELECT id FROM users WHERE username = ?').get(candidate);
    if (!conflict) return candidate;
    number += 1;
  }
}

function ensureUniqueUsername(base, excludeUserId) {
  let candidate = base;
  let suffix = 0;
  while (true) {
    const conflict = db.prepare('SELECT id FROM users WHERE username = ?').get(candidate);
    if (!conflict || conflict.id === excludeUserId) return candidate;
    suffix += 1;
    candidate = `${base}${suffix}`;
  }
}

function ensureUsernameForUser(userId, preferredBase) {
  const row = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
  if (!row) return null;
  if (row.username) return row.username;
  const base = preferredBase ? buildUsernameBase(preferredBase) : '';
  const username = base ? ensureUniqueUsername(base, userId) : buildSequentialUsername();
  db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, userId);
  return username;
}

function normalizeAssignableRole(role) {
  const normalized = normalizeRole(role);
  return normalized === 'admin' ? 'cliente' : normalized;
}

function shouldBootstrapAdmin(email) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get().c;
  const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
  return ADMIN_EMAILS.includes(normalizedEmail) || (adminCount === 0 && userCount === 0);
}

function resolveInitialRole(role, email) {
  if (shouldBootstrapAdmin(email)) return 'admin';
  return normalizeAssignableRole(role);
}

initDb();

// O CORS limita pedidos do frontend configurado para o ambiente atual.
app.use(
  cors({
    origin: CLIENT_URL,
    credentials: true,
  }),
);

// O webhook do Stripe valida a assinatura e fecha encomendas pagas.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  if (!stripe || !stripeWebhookSecret) return res.status(400).send('Stripe webhook not configured');
  const signature = req.headers['stripe-signature'];
  if (!signature) return res.status(400).send('Missing signature');

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, signature, stripeWebhookSecret);
  } catch {
    return res.status(400).send('Invalid signature');
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const orderId = session.metadata?.orderId;
    if (orderId) {
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
      if (order) {
        db.prepare('UPDATE orders SET status = ?, stripe_payment_intent = ? WHERE id = ?').run(
          'paid',
          String(session.payment_intent || ''),
          orderId,
        );
        const items = db.prepare('SELECT product_id FROM order_items WHERE order_id = ?').all(orderId);
        for (const item of items) {
          db.prepare('UPDATE products SET status = ?, buyer_id = ? WHERE id = ?').run(
            'sold',
            order.buyer_id,
            item.product_id,
          );
        }
        db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(order.buyer_id);
      }
    }
  }

  return res.status(200).json({ received: true });
});

app.use(express.json());

// Endpoint simples para confirmar que a API local esta viva e pronta a responder.
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'lootbox-api',
    host: HOST,
    port: PORT,
    time: new Date().toISOString(),
  });
});

// Emite o token JWT usado pelas rotas legadas do backend.
function signToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

function requireAdmin(req, res, next) {
  const user = db.prepare('SELECT role,is_blocked FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.is_blocked) return res.status(403).json({ error: 'Account blocked' });
  if (normalizeRole(user.role) !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  return next();
}

// Middleware de autenticacao que aceita JWT proprio ou token do Firebase.
function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    return next();
  } catch {
    if (!firebaseAuth) return res.status(401).json({ error: 'Invalid token' });
  }

  return firebaseAuth
    .verifyIdToken(token)
    .then((decoded) => {
      const firebaseUid = decoded.uid;
      const firebaseEmail = (decoded.email || '').toLowerCase().trim();
      const firebaseName = decoded.name || (firebaseEmail ? firebaseEmail.split('@')[0] : 'Utilizador');
      const firebaseAvatar = firebaseName.charAt(0).toUpperCase();

      let user = db.prepare('SELECT id FROM users WHERE id = ?').get(firebaseUid);
      if (!user && firebaseEmail) {
        user = db.prepare('SELECT id FROM users WHERE email = ?').get(firebaseEmail);
      }
      const localUserId = user ? user.id : firebaseUid;

      if (!user) {
        db.prepare(
          `INSERT INTO users
            (id,name,email,password_hash,role,is_blocked,avatar,email_verified,created_at)
            VALUES (?,?,?,?,?,?,?,?,?)`,
        ).run(
          firebaseUid,
          firebaseName,
          firebaseEmail || `${firebaseUid}@firebase.local`,
          'firebase_auth',
          resolveInitialRole('cliente', firebaseEmail),
          0,
          firebaseAvatar,
          decoded.email_verified ? 1 : 0,
          new Date().toISOString(),
        );
      } else {
        db.prepare('UPDATE users SET name = ?, avatar = ?, email_verified = ? WHERE id = ?').run(
          firebaseName,
          firebaseAvatar,
          decoded.email_verified ? 1 : 0,
          localUserId,
        );
        if (firebaseEmail) {
          db.prepare('UPDATE users SET email = ? WHERE id = ?').run(firebaseEmail, localUserId);
        }
      }

      const currentUser = db.prepare('SELECT is_blocked FROM users WHERE id = ?').get(localUserId);
      if (currentUser?.is_blocked) return res.status(403).json({ error: 'Account blocked' });

      req.userId = localUserId;
      return next();
    })
    .catch(() => res.status(401).json({ error: 'Invalid token' }));
}

// Legacy auth endpoints kept for backward compatibility.
// Gera um codigo numerico curto usado em fluxos legados.
function createCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Envia emails transacionais atraves do transporte SMTP configurado.
async function sendMail({ to, subject, text, html }) {
  if (!mailer) throw new Error('SMTP not configured');
  await mailer.sendMail({
    from: SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}

async function sendSms({ to, message }) {
  if (!to || !message) throw new Error('SMS missing data');
  if (!SMS_DEBUG) throw new Error('SMS not configured');
  // Em ambiente local, apenas registamos o codigo.
  console.info(`[SMS DEBUG] Para ${to}: ${message}`);
}

// Normaliza o formato de um metodo de pagamento vindo da base de dados.
function mapPaymentMethod(row) {
  const normalizedType = row.type === 'bank' ? 'multibanco' : row.type;
  return {
    id: row.id,
    type: normalizedType,
    label: row.label,
    isDefault: Boolean(row.is_default),
    brand: row.brand || undefined,
    last4: row.last4 || undefined,
    holderName: row.holder_name || undefined,
    expiresAt: row.expires_at || undefined,
    phone: row.phone || undefined,
    email: row.email || undefined,
    iban: row.iban || undefined,
    details: row.details || undefined,
  };
}

// Recolhe todos os metodos de pagamento associados a um utilizador.
function getPaymentMethods(userId) {
  const rows = db.prepare('SELECT * FROM payment_methods WHERE user_id = ?').all(userId);
  return rows.map(mapPaymentMethod);
}

// Exponibiliza apenas os campos publicos de um utilizador.
function getPublicUser(userId) {
  const row = db
    .prepare('SELECT id,name,email,username,phone,role,is_blocked,avatar,avatar_url,email_verified,phone_verified FROM users WHERE id = ?')
    .get(userId);
  if (!row) return null;
  const ensuredUsername = row.username || ensureUsernameForUser(row.id, row.name || row.email || row.id);
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    username: ensuredUsername || undefined,
    phone: row.phone || undefined,
    role: normalizeRole(row.role),
    isBlocked: Boolean(row.is_blocked),
    avatar: row.avatar,
    avatarUrl: row.avatar_url || undefined,
    emailVerified: Boolean(row.email_verified),
    phoneVerified: Boolean(row.phone_verified),
    paymentMethods: getPaymentMethods(userId),
  };
}

function upsertClientSyncedUser({ uid, email, name, role, emailVerified, username, phone }) {
  const normalizedEmail = String(email || '').toLowerCase().trim();
  const displayName = String(name || normalizedEmail.split('@')[0] || 'Utilizador').trim() || 'Utilizador';
  const avatar = displayName.charAt(0).toUpperCase();
  const normalizedUsername = normalizeUsername(username);
  const normalizedPhone = normalizePhone(phone);

  let existing = db.prepare('SELECT id,role,is_blocked FROM users WHERE id = ?').get(uid);
  if (!existing && normalizedEmail) {
    existing = db.prepare('SELECT id,role,is_blocked FROM users WHERE email = ?').get(normalizedEmail);
  }

  if (!existing) {
    const assignedRole = resolveInitialRole(role, normalizedEmail);
    const baseUsername = normalizedUsername ? buildUsernameBase(normalizedUsername) : '';
    const uniqueUsername = baseUsername ? ensureUniqueUsername(baseUsername, uid) : buildSequentialUsername();
    db.prepare(
      `INSERT INTO users
        (id,name,email,username,phone,password_hash,role,is_blocked,avatar,email_verified,phone_verified,created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(
      uid,
      displayName,
      normalizedEmail || `${uid}@firebase.local`,
      uniqueUsername,
      normalizedPhone || null,
      'firebase_auth',
      assignedRole,
      0,
      avatar,
      emailVerified ? 1 : 0,
      0,
      new Date().toISOString(),
    );
    return getPublicUser(uid);
  }

  if (existing.is_blocked) {
    return { blocked: true };
  }

  const nextRole =
    existing.role === 'admin' ? 'admin' : role ? normalizeAssignableRole(role) : normalizeRole(existing.role);

  db.prepare(
    'UPDATE users SET name = ?, email = ?, avatar = ?, email_verified = ?, role = ? WHERE id = ?',
  ).run(
    displayName,
    normalizedEmail || `${existing.id}@firebase.local`,
    avatar,
    emailVerified ? 1 : 0,
    nextRole,
    existing.id,
  );

  if (normalizedUsername) {
    const conflict = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(normalizedUsername, existing.id);
    if (!conflict) {
      db.prepare('UPDATE users SET username = ? WHERE id = ?').run(normalizedUsername, existing.id);
    }
  } else {
    ensureUsernameForUser(existing.id, displayName || normalizedEmail || existing.id);
  }
  if (normalizedPhone) {
    const conflict = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(normalizedPhone, existing.id);
    if (!conflict) {
      db.prepare('UPDATE users SET phone = ?, phone_verified = 0 WHERE id = ?').run(normalizedPhone, existing.id);
    }
  }
  return getPublicUser(existing.id);
}

function mapProduct(row) {
  const seller = getPublicUser(row.seller_id);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: row.price,
    category: row.category,
    image: row.image,
    sellerId: row.seller_id,
    buyerId: row.buyer_id || undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at || row.created_at,
    seller,
  };
}

function getOrderItems(orderId) {
  return db
    .prepare(
      `SELECT oi.product_id, oi.price, p.name, p.image, p.category, p.seller_id
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
    )
    .all(orderId);
}

function mapOrder(row) {
  const items = getOrderItems(row.id);
  const sellerIds = Array.from(new Set(items.map((item) => item.seller_id)));
  let evidence = null;
  if (row.dispute_evidence) {
    try {
      const parsed = JSON.parse(row.dispute_evidence);
      evidence = Array.isArray(parsed) ? parsed : null;
    } catch {
      evidence = null;
    }
  }
  return {
    id: row.id,
    itemIds: items.map((item) => item.product_id),
    items: items.map((item) => ({
      product_id: item.product_id,
      price: item.price,
      name: item.name,
      image: item.image,
      category: item.category,
    })),
    buyerId: row.buyer_id,
    sellerIds,
    subtotal: row.subtotal,
    serviceFee: row.service_fee,
    total: row.total,
    paymentMethodId: row.payment_method_id || undefined,
    paymentMethodLabel: row.payment_method_label || undefined,
    shippingAddress: row.shipping_address,
    note: row.note || undefined,
    status: row.status,
    createdAt: row.created_at,
    shippedAt: row.shipped_at || undefined,
    completedAt: row.completed_at || undefined,
    trackingCode: row.tracking_code || undefined,
    shippingCarrier: row.shipping_carrier || undefined,
    shippingProof: row.shipping_proof || undefined,
    shippingNote: row.shipping_note || undefined,
    dispute:
      row.dispute_status
        ? {
            id: `disp_${row.id}`,
            status: row.dispute_status,
            openedBy: row.dispute_opened_by,
            reason: row.dispute_reason,
            details: row.dispute_details || undefined,
            evidence: evidence || undefined,
            resolutionNote: row.dispute_resolution_note || undefined,
            createdAt: row.dispute_created_at,
            resolvedAt: row.dispute_resolved_at || undefined,
          }
        : undefined,
  };
}

function userCanManageOrder(userId, orderId) {
  const order = db.prepare('SELECT buyer_id FROM orders WHERE id = ?').get(orderId);
  if (!order) return false;
  const sellerHit = db
    .prepare(
      `SELECT 1 as ok
       FROM order_items oi
       JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ? AND p.seller_id = ?
       LIMIT 1`,
    )
    .get(orderId, userId);
  return Boolean(sellerHit);
}

function deleteUserAccount(userId) {
  const orderIds = db.prepare('SELECT id FROM orders WHERE buyer_id = ?').all(userId).map((row) => row.id);
  if (orderIds.length > 0) {
    const deleteOrderItems = db.prepare('DELETE FROM order_items WHERE order_id = ?');
    const deleteOrder = db.prepare('DELETE FROM orders WHERE id = ?');
    for (const orderId of orderIds) {
      deleteOrderItems.run(orderId);
      deleteOrder.run(orderId);
    }
  }

  const productIds = db
    .prepare('SELECT id FROM products WHERE seller_id = ?')
    .all(userId)
    .map((row) => row.id);
  if (productIds.length > 0) {
    const deleteFavoriteByProduct = db.prepare('DELETE FROM favorites WHERE product_id = ?');
    const deleteCartByProduct = db.prepare('DELETE FROM cart_items WHERE product_id = ?');
    const deleteOrderItemsByProduct = db.prepare('DELETE FROM order_items WHERE product_id = ?');
    const deleteConversationByProduct = db.prepare('DELETE FROM conversations WHERE product_id = ?');
    const deleteProduct = db.prepare('DELETE FROM products WHERE id = ?');

    for (const productId of productIds) {
      deleteFavoriteByProduct.run(productId);
      deleteCartByProduct.run(productId);
      deleteOrderItemsByProduct.run(productId);
      deleteConversationByProduct.run(productId);
      deleteProduct.run(productId);
    }
  }

  db.prepare("UPDATE products SET buyer_id = NULL, status = 'available' WHERE buyer_id = ?").run(userId);

  const conversationIds = db
    .prepare(
      `SELECT DISTINCT conversation_id
       FROM conversation_participants
       WHERE user_id = ?
       UNION
       SELECT DISTINCT conversation_id
       FROM messages
       WHERE sender_id = ?`,
    )
    .all(userId, userId)
    .map((row) => row.conversation_id);

  if (conversationIds.length > 0) {
    const deleteMessages = db.prepare('DELETE FROM messages WHERE conversation_id = ?');
    const deleteParticipants = db.prepare('DELETE FROM conversation_participants WHERE conversation_id = ?');
    const deleteConversation = db.prepare('DELETE FROM conversations WHERE id = ?');
    for (const conversationId of conversationIds) {
      deleteMessages.run(conversationId);
      deleteParticipants.run(conversationId);
      deleteConversation.run(conversationId);
    }
  }

  db.prepare('DELETE FROM favorites WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM payment_methods WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM conversation_participants WHERE user_id = ?').run(userId);
  db.prepare('DELETE FROM messages WHERE sender_id = ?').run(userId);
  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, smtpConfigured: Boolean(mailer) });
});

app.post('/api/auth/client-sync', (req, res) => {
  const { uid, email, name, role, emailVerified, username, phone } = req.body;
  if (!uid || !email) return res.status(400).json({ error: 'Missing fields' });
  const synced = upsertClientSyncedUser({
    uid: String(uid),
    email: String(email),
    name: String(name || ''),
    role: role ? String(role) : undefined,
    emailVerified: Boolean(emailVerified),
    username,
    phone,
  });
  if (!synced) return res.status(500).json({ error: 'Failed to sync user' });
  if ('blocked' in synced) return res.status(403).json({ error: 'Account blocked' });
  return res.json({ token: signToken(synced.id), user: synced });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, role, username, phone } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Missing fields' });
  if (!mailer) return res.status(500).json({ error: 'SMTP not configured on server' });
  const normalizedEmail = String(email).toLowerCase().trim();
  const normalizedUsername = normalizeUsername(username);
  const normalizedPhone = normalizePhone(phone);
  const normalizedRole = resolveInitialRole(role, normalizedEmail);

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (exists) return res.status(409).json({ error: 'Email already exists' });
  if (normalizedUsername) {
    const usernameExists = db.prepare('SELECT id FROM users WHERE username = ?').get(normalizedUsername);
    if (usernameExists) return res.status(409).json({ error: 'Username already exists' });
  }
  if (normalizedPhone) {
    const phoneExists = db.prepare('SELECT id FROM users WHERE phone = ?').get(normalizedPhone);
    if (phoneExists) return res.status(409).json({ error: 'Phone already exists' });
  }

  const userId = createId('u');
  const code = createCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const phoneCode = normalizedPhone ? createCode() : null;
  const phoneExpiresAt = normalizedPhone ? new Date(Date.now() + 10 * 60 * 1000).toISOString() : null;
  const baseUsername = normalizedUsername ? buildUsernameBase(normalizedUsername) : '';
  const uniqueUsername = baseUsername ? ensureUniqueUsername(baseUsername, userId) : buildSequentialUsername();

  db.prepare(
    `INSERT INTO users
      (id,name,email,username,phone,password_hash,role,is_blocked,avatar,email_verified,email_verify_token,email_verify_expires_at,phone_verified,phone_verify_token,phone_verify_expires_at,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    userId,
    String(name).trim(),
    normalizedEmail,
    uniqueUsername,
    normalizedPhone || null,
    bcrypt.hashSync(String(password), 10),
    normalizedRole,
    0,
    String(name).trim().charAt(0).toUpperCase(),
    0,
    code,
    expiresAt,
    normalizedPhone ? 0 : 1,
    phoneCode,
    phoneExpiresAt,
    new Date().toISOString(),
  );

  try {
    await sendMail({
      to: normalizedEmail,
      subject: 'LOOT BOX - Verificação de email',
      text: `O teu código de verificação é: ${code}. Expira em 10 minutos.`,
      html: `<p>O teu código de verificação é: <b>${code}</b></p><p>Expira em 10 minutos.</p>`,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to send verification email' });
  }

  if (normalizedPhone && phoneCode) {
    try {
      await sendSms({
        to: normalizedPhone,
        message: `O teu código LOOT BOX é: ${phoneCode}. Expira em 10 minutos.`,
      });
    } catch {
      // Mantemos o registo mesmo sem SMS, devolvendo o codigo para debug local.
    }
  }

  return res.json({
    success: true,
    requiresVerification: true,
    phoneMasked: normalizedPhone ? maskPhone(normalizedPhone) : undefined,
    debugSmsCode: SMS_DEBUG ? phoneCode || undefined : undefined,
  });
});

app.post('/api/auth/verify-email', (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Missing fields' });
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = db
    .prepare('SELECT id,email_verify_token,email_verify_expires_at,email_verified FROM users WHERE email = ?')
    .get(normalizedEmail);
  if (!user) return res.status(404).json({ error: 'Email not found' });
  if (user.email_verified) return res.json({ success: true });
  if (!user.email_verify_token || String(code).trim() !== String(user.email_verify_token)) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }
  if (!user.email_verify_expires_at || Date.now() > new Date(user.email_verify_expires_at).getTime()) {
    return res.status(400).json({ error: 'Verification code expired' });
  }

  db.prepare('UPDATE users SET email_verified = 1, email_verify_token = NULL, email_verify_expires_at = NULL WHERE id = ?').run(user.id);
  return res.json({ success: true });
});

app.post('/api/auth/resend-verification', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  if (!mailer) return res.status(500).json({ error: 'SMTP not configured on server' });
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = db.prepare('SELECT id,email_verified FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) return res.status(404).json({ error: 'Email not found' });
  if (user.email_verified) return res.json({ success: true });

  const code = createCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET email_verify_token = ?, email_verify_expires_at = ? WHERE id = ?').run(
    code,
    expiresAt,
    user.id,
  );

  try {
    await sendMail({
      to: normalizedEmail,
      subject: 'LOOT BOX - Novo código de verificação',
      text: `O teu novo código é: ${code}.`,
      html: `<p>O teu novo código é: <b>${code}</b></p>`,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to send verification email' });
  }
  return res.json({ success: true });
});

app.post('/api/auth/resolve-identifier', (req, res) => {
  const { identifier } = req.body;
  if (!identifier) return res.status(400).json({ error: 'Missing identifier' });
  const normalizedEmail = String(identifier).toLowerCase().trim();
  const normalizedPhone = normalizePhone(identifier);
  const normalizedUsername = normalizeUsername(identifier);
  const row =
    db.prepare('SELECT email FROM users WHERE email = ?').get(normalizedEmail) ||
    (normalizedPhone ? db.prepare('SELECT email FROM users WHERE phone = ?').get(normalizedPhone) : null) ||
    (normalizedUsername ? db.prepare('SELECT email FROM users WHERE username = ?').get(normalizedUsername) : null);
  if (!row) return res.status(404).json({ error: 'Identifier not found' });
  return res.json({ email: row.email });
});

app.post('/api/auth/request-phone-verification', auth, async (req, res) => {
  const { phone } = req.body;
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return res.status(400).json({ error: 'Phone invalid' });

  const conflict = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(normalizedPhone, req.userId);
  if (conflict) return res.status(409).json({ error: 'Phone already exists' });

  const code = createCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET phone = ?, phone_verified = 0, phone_verify_token = ?, phone_verify_expires_at = ? WHERE id = ?').run(
    normalizedPhone,
    code,
    expiresAt,
    req.userId,
  );

  try {
    await sendSms({
      to: normalizedPhone,
      message: `O teu código LOOT BOX é: ${code}. Expira em 10 minutos.`,
    });
  } catch {
    // Sem SMS configurado, seguimos em modo de desenvolvimento.
  }

  return res.json({ success: true, phoneMasked: maskPhone(normalizedPhone), debugSmsCode: SMS_DEBUG ? code : undefined });
});

app.post('/api/auth/verify-phone', auth, (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Missing code' });
  const user = db
    .prepare('SELECT id,phone_verify_token,phone_verify_expires_at FROM users WHERE id = ?')
    .get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.phone_verify_token || String(code).trim() !== String(user.phone_verify_token)) {
    return res.status(400).json({ error: 'Invalid verification code' });
  }
  if (!user.phone_verify_expires_at || Date.now() > new Date(user.phone_verify_expires_at).getTime()) {
    return res.status(400).json({ error: 'Verification code expired' });
  }

  db.prepare('UPDATE users SET phone_verified = 1, phone_verify_token = NULL, phone_verify_expires_at = NULL WHERE id = ?').run(user.id);
  return res.json({ success: true });
});

app.post('/api/auth/request-password-reset', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  if (!mailer) return res.status(500).json({ error: 'SMTP not configured on server' });

  const normalizedEmail = String(email).toLowerCase().trim();
  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) return res.status(404).json({ error: 'Email not found' });

  const code = createCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare('UPDATE users SET reset_token = ?, reset_expires_at = ? WHERE id = ?').run(code, expiresAt, user.id);

  try {
    await sendMail({
      to: normalizedEmail,
      subject: 'LOOT BOX - Recuperação de password',
      text: `O teu código de recuperação é: ${code}.`,
      html: `<p>O teu código de recuperação é: <b>${code}</b></p>`,
    });
  } catch {
    return res.status(500).json({ error: 'Failed to send reset email' });
  }

  return res.json({ success: true });
});

app.post('/api/auth/reset-password', (req, res) => {
  const { email, code, newPassword } = req.body;
  if (!email || !code || !newPassword) return res.status(400).json({ error: 'Missing fields' });
  const normalizedEmail = String(email).toLowerCase().trim();
  const user = db.prepare('SELECT id,reset_token,reset_expires_at FROM users WHERE email = ?').get(normalizedEmail);
  if (!user) return res.status(404).json({ error: 'Email not found' });
  if (!user.reset_token || String(code).trim() !== String(user.reset_token)) {
    return res.status(400).json({ error: 'Invalid reset code' });
  }
  if (!user.reset_expires_at || Date.now() > new Date(user.reset_expires_at).getTime()) {
    return res.status(400).json({ error: 'Reset code expired' });
  }

  db.prepare(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_expires_at = NULL WHERE id = ?',
  ).run(bcrypt.hashSync(String(newPassword), 10), user.id);
  return res.json({ success: true });
});

app.post('/api/auth/login', (req, res) => {
  const { identifier, email, password } = req.body;
  const identifierValue = identifier || email;
  if (!identifierValue || !password) return res.status(400).json({ error: 'Missing fields' });
  const normalizedEmail = String(identifierValue).toLowerCase().trim();
  const normalizedPhone = normalizePhone(identifierValue);
  const normalizedUsername = normalizeUsername(identifierValue);
  const userRow =
    db.prepare('SELECT id,password_hash,email_verified,phone_verified,phone,is_blocked FROM users WHERE email = ?').get(normalizedEmail) ||
    (normalizedPhone
      ? db.prepare('SELECT id,password_hash,email_verified,phone_verified,phone,is_blocked FROM users WHERE phone = ?').get(normalizedPhone)
      : null) ||
    (normalizedUsername
      ? db.prepare('SELECT id,password_hash,email_verified,phone_verified,phone,is_blocked FROM users WHERE username = ?').get(normalizedUsername)
      : null);
  if (!userRow || !bcrypt.compareSync(String(password), userRow.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (userRow.is_blocked) {
    return res.status(403).json({ error: 'Account blocked' });
  }
  if (!userRow.email_verified) {
    return res.status(403).json({ error: 'Email not verified' });
  }
  if (userRow.phone && !userRow.phone_verified) {
    return res.status(403).json({ error: 'Phone not verified' });
  }
  return res.json({ token: signToken(userRow.id), user: getPublicUser(userRow.id) });
});

app.get('/api/auth/me', auth, (req, res) => {
  const user = getPublicUser(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  return res.json({ user });
});

app.delete('/api/auth/account', auth, (req, res) => {
  const current = db.prepare('SELECT id FROM users WHERE id = ?').get(req.userId);
  if (!current) return res.status(404).json({ error: 'User not found' });
  db.transaction(() => deleteUserAccount(req.userId))();
  return res.json({ success: true });
});

app.post('/api/auth/profile', auth, (req, res) => {
  const { name, role, username, phone, avatarUrl } = req.body;
  const current = db.prepare('SELECT id,name,role,username,phone,avatar_url FROM users WHERE id = ?').get(req.userId);
  if (!current) return res.status(404).json({ error: 'User not found' });
  const requester = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
  const requesterIsAdmin = normalizeRole(requester?.role) === 'admin';

  const nextName = String(name || current.name).trim() || current.name;
  const nextRole =
    current.role === 'admin'
      ? 'admin'
      : role
        ? requesterIsAdmin
          ? normalizeRole(role)
          : normalizeAssignableRole(role)
        : null;

  const normalizedUsername = username ? normalizeUsername(username) : null;
  const normalizedPhone = phone === '' || phone === null ? null : phone ? normalizePhone(phone) : undefined;
  const normalizedAvatarUrl = typeof avatarUrl === 'string' ? avatarUrl.trim() : undefined;
  if (normalizedAvatarUrl && normalizedAvatarUrl.length > 10_000_000) {
    return res.status(400).json({ error: 'Avatar too large' });
  }

  if (normalizedUsername) {
    const conflict = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(normalizedUsername, req.userId);
    if (conflict) return res.status(409).json({ error: 'Username already exists' });
  }
  if (normalizedPhone) {
    const conflict = db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').get(normalizedPhone, req.userId);
    if (conflict) return res.status(409).json({ error: 'Phone already exists' });
  }

  if (nextRole) {
    db.prepare('UPDATE users SET name = ?, avatar = ?, role = ? WHERE id = ?').run(
      nextName,
      nextName.charAt(0).toUpperCase(),
      nextRole,
      req.userId,
    );
  } else {
    db.prepare('UPDATE users SET name = ?, avatar = ? WHERE id = ?').run(
      nextName,
      nextName.charAt(0).toUpperCase(),
      req.userId,
    );
  }

  if (normalizedUsername) {
    db.prepare('UPDATE users SET username = ? WHERE id = ?').run(normalizedUsername, req.userId);
  }
  if (normalizedPhone !== undefined) {
    db.prepare('UPDATE users SET phone = ?, phone_verified = 0 WHERE id = ?').run(normalizedPhone, req.userId);
  }
  if (normalizedAvatarUrl !== undefined) {
    db.prepare('UPDATE users SET avatar_url = ? WHERE id = ?').run(normalizedAvatarUrl || null, req.userId);
  }

  if (!normalizedUsername) {
    ensureUsernameForUser(req.userId, nextName || current.email || req.userId);
  }

  return res.json({ user: getPublicUser(req.userId) });
});

app.get('/api/payment-methods', auth, (req, res) => res.json({ paymentMethods: getPaymentMethods(req.userId) }));

app.post('/api/payment-methods', auth, (req, res) => {
  const { type, label, brand, last4, holderName, expiresAt, phone, email, iban, details } = req.body;
  if (!type || !label) return res.status(400).json({ error: 'Missing fields' });
  const hasDefault = db.prepare('SELECT id FROM payment_methods WHERE user_id = ? AND is_default = 1').get(req.userId);
  db.prepare(
    `INSERT INTO payment_methods
      (id,user_id,type,label,is_default,brand,last4,holder_name,expires_at,phone,email,iban,details)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    createId('pm'),
    req.userId,
    type,
    label,
    hasDefault ? 0 : 1,
    brand || null,
    last4 || null,
    holderName || null,
    expiresAt || null,
    phone || null,
    email || null,
    iban || null,
    details || null,
  );
  return res.json({ paymentMethods: getPaymentMethods(req.userId) });
});

app.patch('/api/payment-methods/:id/default', auth, (req, res) => {
  const method = db.prepare('SELECT id FROM payment_methods WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!method) return res.status(404).json({ error: 'Method not found' });
  db.prepare('UPDATE payment_methods SET is_default = 0 WHERE user_id = ?').run(req.userId);
  db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(req.params.id);
  return res.json({ paymentMethods: getPaymentMethods(req.userId) });
});

app.delete('/api/payment-methods/:id', auth, (req, res) => {
  const current = db.prepare('SELECT id,is_default FROM payment_methods WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!current) return res.status(404).json({ error: 'Method not found' });
  db.prepare('DELETE FROM payment_methods WHERE id = ? AND user_id = ?').run(req.params.id, req.userId);
  if (current.is_default) {
    const fallback = db.prepare('SELECT id FROM payment_methods WHERE user_id = ? LIMIT 1').get(req.userId);
    if (fallback) db.prepare('UPDATE payment_methods SET is_default = 1 WHERE id = ?').run(fallback.id);
  }
  return res.json({ paymentMethods: getPaymentMethods(req.userId) });
});

app.get('/api/products', (_req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY datetime(created_at) DESC').all();
  res.json({ products: rows.map(mapProduct) });
});

app.post('/api/products', auth, (req, res) => {
  const seller = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
  if (!seller || normalizeRole(seller.role) !== 'destribuidior') return res.status(403).json({ error: 'Seller access required' });
  const { name, description, price, category, image, images, status } = req.body;
  const primaryImage = image || (Array.isArray(images) ? images.filter(Boolean)[0] : '');
  if (!name || !description || !price || !category || !primaryImage) return res.status(400).json({ error: 'Missing fields' });
  const id = createId('p');
  db.prepare(
    `INSERT INTO products
      (id,name,description,price,category,image,seller_id,buyer_id,status,created_at,updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
  ).run(
    id,
    String(name),
    String(description),
    Number(price),
    String(category),
    String(primaryImage),
    req.userId,
    null,
    status || 'pending_review',
    new Date().toISOString(),
    new Date().toISOString(),
  );
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
  return res.status(201).json({ product: mapProduct(product) });
});

app.patch('/api/products/:id', auth, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const current = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
  const role = normalizeRole(current?.role);
  const canManage = role === 'admin' || (role === 'destribuidior' && product.seller_id === req.userId);
  if (!canManage) return res.status(403).json({ error: 'Forbidden' });

  const next = {
    name: req.body.name ?? product.name,
    description: req.body.description ?? product.description,
    price: req.body.price ?? product.price,
    category: req.body.category ?? product.category,
    image: req.body.image ?? (Array.isArray(req.body.images) ? req.body.images.filter(Boolean)[0] : product.image) ?? product.image,
    status: req.body.status ?? product.status,
  };

  db.prepare(
    `UPDATE products
     SET name = ?, description = ?, price = ?, category = ?, image = ?, status = ?, updated_at = ?
     WHERE id = ?`,
  ).run(
    String(next.name),
    String(next.description),
    Number(next.price),
    String(next.category),
    String(next.image),
    String(next.status),
    new Date().toISOString(),
    req.params.id,
  );
  return res.json({ product: mapProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id)) });
});

app.delete('/api/products/:id', auth, (req, res) => {
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  const current = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
  const role = normalizeRole(current?.role);
  const canManage = role === 'admin' || (role === 'destribuidior' && product.seller_id === req.userId);
  if (!canManage) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
  return res.json({ success: true });
});

app.get('/api/admin/users', auth, requireAdmin, (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id,u.name,u.email,u.role,u.is_blocked,u.avatar,u.avatar_url,u.created_at,
              (SELECT COUNT(*) FROM products p WHERE p.seller_id = u.id) AS products_count
       FROM users u
       ORDER BY datetime(u.created_at) DESC`,
    )
    .all();
  res.json({
    users: rows.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: normalizeRole(row.role),
      isBlocked: Boolean(row.is_blocked),
      avatar: row.avatar || undefined,
      avatarUrl: row.avatar_url || undefined,
      createdAt: row.created_at,
      productsCount: Number(row.products_count || 0),
    })),
  });
});

app.patch('/api/admin/users/:id', auth, requireAdmin, (req, res) => {
  const target = db.prepare('SELECT id,role,is_blocked FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  const { name, email, avatar, isBlocked } = req.body;
  if (target.id === req.userId && isBlocked === true) {
    return res.status(400).json({ error: 'Cannot block the current admin account' });
  }
  const allowProfileEdit = target.id === req.userId;
  const nextName = allowProfileEdit && name ? String(name).trim() : null;
  const nextEmail = allowProfileEdit && email ? String(email).trim().toLowerCase() : null;
  const nextAvatar = allowProfileEdit && avatar ? String(avatar).trim().charAt(0).toUpperCase() : null;
  if (nextEmail) {
    const exists = db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').get(nextEmail, target.id);
    if (exists) return res.status(409).json({ error: 'Email already exists' });
  }

  db.prepare(
    `UPDATE users
     SET name = COALESCE(?, name),
         email = COALESCE(?, email),
         avatar = COALESCE(?, avatar),
         is_blocked = ?
     WHERE id = ?`,
  ).run(
    nextName,
    nextEmail,
    nextAvatar,
    isBlocked === undefined ? target.is_blocked : isBlocked ? 1 : 0,
    target.id,
  );
  return res.json({ user: getPublicUser(target.id) });
});

app.delete('/api/admin/users/:id', auth, requireAdmin, (req, res) => {
  const target = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.id === req.userId) {
    return res.status(400).json({ error: 'Cannot delete the current admin account' });
  }
  db.transaction(() => deleteUserAccount(target.id))();
  return res.json({ success: true });
});

app.get('/api/favorites', auth, (req, res) => {
  const favorites = db.prepare('SELECT product_id FROM favorites WHERE user_id = ?').all(req.userId).map((row) => row.product_id);
  res.json({ favorites });
});

app.post('/api/favorites/:productId/toggle', auth, (req, res) => {
  const existing = db.prepare('SELECT product_id FROM favorites WHERE user_id = ? AND product_id = ?').get(req.userId, req.params.productId);
  if (existing) db.prepare('DELETE FROM favorites WHERE user_id = ? AND product_id = ?').run(req.userId, req.params.productId);
  else db.prepare('INSERT INTO favorites (user_id,product_id) VALUES (?,?)').run(req.userId, req.params.productId);
  const favorites = db.prepare('SELECT product_id FROM favorites WHERE user_id = ?').all(req.userId).map((row) => row.product_id);
  res.json({ favorites });
});

app.get('/api/cart', auth, (req, res) => {
  const cart = db.prepare('SELECT product_id as productId, quantity FROM cart_items WHERE user_id = ?').all(req.userId);
  res.json({ cart });
});

app.post('/api/cart', auth, (req, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: 'productId required' });
  const current = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
  if (!current || normalizeRole(current.role) !== 'cliente') return res.status(403).json({ error: 'Customer access required' });
  const product = db.prepare('SELECT * FROM products WHERE id = ?').get(productId);
  if (!product || product.status !== 'available') return res.status(400).json({ error: 'Product unavailable' });
  if (product.seller_id === req.userId) return res.status(400).json({ error: 'Cannot buy your own product' });
  db.prepare(
    'INSERT INTO cart_items (user_id,product_id,quantity) VALUES (?,?,1) ON CONFLICT(user_id,product_id) DO UPDATE SET quantity=1',
  ).run(req.userId, productId);
  return res.json({ ok: true });
});

app.delete('/api/cart/:productId', auth, (req, res) => {
  db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(req.userId, req.params.productId);
  res.json({ ok: true });
});

app.post('/api/orders/checkout-session', auth, async (req, res) => {
  const current = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
  if (!current || normalizeRole(current.role) !== 'cliente') return res.status(403).json({ error: 'Customer access required' });
  const { paymentMethodId, paymentMethodLabel, shippingAddress, note } = req.body;
  if (!paymentMethodId || !shippingAddress) return res.status(400).json({ error: 'Missing checkout fields' });

  const cartRows = db
    .prepare(
      `SELECT p.* FROM cart_items c
       JOIN products p ON p.id = c.product_id
       WHERE c.user_id = ? AND p.status = 'available' AND p.seller_id <> ?`,
    )
    .all(req.userId, req.userId);
  if (cartRows.length === 0) return res.status(400).json({ error: 'Cart is empty' });

  const subtotal = cartRows.reduce((sum, p) => sum + Number(p.price), 0);
  const serviceFee = subtotal * 0.04;
  const total = subtotal + serviceFee;
  const orderId = createId('ord');

  const transaction = db.transaction(() => {
    db.prepare(
      `INSERT INTO orders
      (id,buyer_id,subtotal,service_fee,total,payment_method_id,payment_method_label,shipping_address,note,status,stripe_session_id,stripe_payment_intent,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(orderId, req.userId, subtotal, serviceFee, total, paymentMethodId, paymentMethodLabel || null, shippingAddress, note || null, stripe ? 'processing' : 'paid', null, null, new Date().toISOString());
    const ins = db.prepare('INSERT INTO order_items (id,order_id,product_id,price) VALUES (?,?,?,?)');
    for (const product of cartRows) ins.run(createId('oi'), orderId, product.id, Number(product.price));
    if (!stripe) {
      for (const product of cartRows) {
        db.prepare('UPDATE products SET status = ?, buyer_id = ?, updated_at = ? WHERE id = ?').run(
          'sold',
          req.userId,
          new Date().toISOString(),
          product.id,
        );
      }
      db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(req.userId);
    }
  });
  transaction();

  if (!stripe) {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    return res.json({ success: true, order: mapOrder(order) });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      ...cartRows.map((p) => ({
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(Number(p.price) * 100),
          product_data: { name: p.name, description: p.description.slice(0, 200), images: p.image ? [p.image] : [] },
        },
      })),
      {
        quantity: 1,
        price_data: {
          currency: 'eur',
          unit_amount: Math.round(serviceFee * 100),
          product_data: { name: 'Taxa de serviço LOOT BOX' },
        },
      },
    ],
    metadata: { orderId },
    success_url: `${CLIENT_URL}/?checkout=success&order_id=${orderId}`,
    cancel_url: `${CLIENT_URL}/?checkout=cancel&order_id=${orderId}`,
  });

  db.prepare('UPDATE orders SET stripe_session_id = ? WHERE id = ?').run(session.id, orderId);
  return res.json({ url: session.url, orderId });
});

app.get('/api/orders/my', auth, (req, res) => {
  const orderRows = db.prepare('SELECT * FROM orders WHERE buyer_id = ? ORDER BY datetime(created_at) DESC').all(req.userId);
  const orders = orderRows.map(mapOrder);
  res.json({ orders });
});

app.get('/api/orders/relevant', auth, (req, res) => {
  const orderRows = db
    .prepare(
      `SELECT DISTINCT o.*
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       LEFT JOIN products p ON p.id = oi.product_id
       WHERE o.buyer_id = ? OR p.seller_id = ?
       ORDER BY datetime(o.created_at) DESC`,
    )
    .all(req.userId, req.userId);
  return res.json({ orders: orderRows.map(mapOrder) });
});

app.patch('/api/orders/:id/status', auth, (req, res) => {
  const { status } = req.body;
  if (!['paid', 'processing', 'shipped', 'completed'].includes(String(status))) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  if (!userCanManageOrder(req.userId, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('UPDATE orders SET status = ?, shipped_at = CASE WHEN ? = "shipped" THEN ? ELSE shipped_at END, completed_at = CASE WHEN ? = "completed" THEN ? ELSE completed_at END WHERE id = ?').run(
    status,
    status,
    new Date().toISOString(),
    status,
    new Date().toISOString(),
    req.params.id,
  );
  return res.json({ order: mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)) });
});

app.patch('/api/orders/:id/shipment', auth, (req, res) => {
  if (!userCanManageOrder(req.userId, req.params.id)) return res.status(403).json({ error: 'Forbidden' });
  const { trackingCode, shippingCarrier, shippingProof, shippingNote } = req.body;
  if (!trackingCode) return res.status(400).json({ error: 'trackingCode required' });
  db.prepare(
    `UPDATE orders
     SET tracking_code = ?, shipping_carrier = ?, shipping_proof = ?, shipping_note = ?, status = 'shipped', shipped_at = ?
     WHERE id = ?`,
  ).run(
    String(trackingCode).trim(),
    shippingCarrier ? String(shippingCarrier).trim() : null,
    shippingProof ? String(shippingProof).trim() : null,
    shippingNote ? String(shippingNote).trim() : null,
    new Date().toISOString(),
    req.params.id,
  );
  return res.json({ order: mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)) });
});

app.patch('/api/orders/:id/confirm', auth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.buyer_id !== req.userId) return res.status(403).json({ error: 'Forbidden' });
  db.prepare(`UPDATE orders SET status = 'completed', completed_at = ? WHERE id = ?`).run(new Date().toISOString(), req.params.id);
  return res.json({ order: mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)) });
});

app.patch('/api/orders/:id/dispute', auth, (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  const { openedBy, reason, details, status, resolutionNote, evidence } = req.body;
  const current = db.prepare('SELECT role FROM users WHERE id = ?').get(req.userId);
  const isAdmin = normalizeRole(current?.role) === 'admin';
  if (isAdmin) {
    db.prepare(
      `UPDATE orders
       SET dispute_status = ?, dispute_resolution_note = ?, dispute_resolved_at = ?
       WHERE id = ?`,
    ).run(String(status), resolutionNote ? String(resolutionNote).trim() : null, new Date().toISOString(), req.params.id);
    return res.json({ order: mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)) });
  }

  const canOpen = order.buyer_id === req.userId || userCanManageOrder(req.userId, req.params.id);
  if (!canOpen) return res.status(403).json({ error: 'Forbidden' });
  if (!reason) return res.status(400).json({ error: 'Reason required' });
  const evidencePayload = Array.isArray(evidence) ? JSON.stringify(evidence.slice(0, 5)) : null;
  db.prepare(
    `UPDATE orders
     SET dispute_status = 'open',
         dispute_opened_by = ?,
         dispute_reason = ?,
         dispute_details = ?,
         dispute_evidence = ?,
         dispute_created_at = ?,
         dispute_resolution_note = NULL,
         dispute_resolved_at = NULL
     WHERE id = ?`,
  ).run(
    String(openedBy),
    String(reason).trim(),
    details ? String(details).trim() : null,
    evidencePayload,
    new Date().toISOString(),
    req.params.id,
  );
  return res.json({ order: mapOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)) });
});

app.get('/api/reviews', (_req, res) => {
  const reviews = db
    .prepare('SELECT * FROM reviews ORDER BY datetime(created_at) DESC')
    .all()
    .map((row) => ({
      id: row.id,
      orderId: row.order_id,
      sellerId: row.seller_id,
      buyerId: row.buyer_id,
      rating: row.rating,
      comment: row.comment || undefined,
      createdAt: row.created_at,
    }));
  res.json({ reviews });
});

app.post('/api/reviews', auth, (req, res) => {
  const { orderId, sellerId, rating, comment } = req.body;
  if (!orderId || !sellerId || !rating) return res.status(400).json({ error: 'Missing fields' });
  const exists = db.prepare('SELECT id FROM reviews WHERE order_id = ? AND seller_id = ? AND buyer_id = ?').get(orderId, sellerId, req.userId);
  if (exists) return res.status(409).json({ error: 'Review already exists' });
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
  if (!order || order.buyer_id !== req.userId || order.status !== 'completed') return res.status(400).json({ error: 'Review not allowed' });
  db.prepare(
    `INSERT INTO reviews (id,order_id,seller_id,buyer_id,rating,comment,created_at)
     VALUES (?,?,?,?,?,?,?)`,
  ).run(createId('rev'), orderId, sellerId, req.userId, Number(rating), comment ? String(comment).trim() : null, new Date().toISOString());
  return res.json({ success: true });
});

app.get('/api/conversations', auth, (req, res) => {
  const convRows = db
    .prepare(
      `SELECT c.* FROM conversations c
       JOIN conversation_participants cp ON cp.conversation_id = c.id
       WHERE cp.user_id = ?
       ORDER BY datetime(c.updated_at) DESC`,
    )
    .all(req.userId);
  const conversations = convRows.map((conv) => {
    const participants = db.prepare('SELECT user_id FROM conversation_participants WHERE conversation_id = ?').all(conv.id).map((row) => row.user_id);
    const messages = db
      .prepare('SELECT id,sender_id,text,created_at FROM messages WHERE conversation_id = ? ORDER BY datetime(created_at)')
      .all(conv.id)
      .map((m) => ({ id: m.id, senderId: m.sender_id, text: m.text, createdAt: m.created_at }));
    return { id: conv.id, participantIds: participants, productId: conv.product_id || undefined, messages, updatedAt: conv.updated_at };
  });
  res.json({ conversations });
});

app.post('/api/conversations/start', auth, (req, res) => {
  const { otherUserId, productId } = req.body;
  if (!otherUserId || otherUserId === req.userId) return res.status(400).json({ error: 'Invalid user' });
  const existing = db
    .prepare(
      `SELECT c.id FROM conversations c
       JOIN conversation_participants cp1 ON cp1.conversation_id = c.id
       JOIN conversation_participants cp2 ON cp2.conversation_id = c.id
       WHERE cp1.user_id = ? AND cp2.user_id = ? AND IFNULL(c.product_id,'') = IFNULL(?, '')`,
    )
    .get(req.userId, otherUserId, productId || null);
  if (existing) return res.json({ conversationId: existing.id });
  const id = createId('conv');
  db.prepare('INSERT INTO conversations (id,product_id,updated_at) VALUES (?,?,?)').run(id, productId || null, new Date().toISOString());
  db.prepare('INSERT INTO conversation_participants (conversation_id,user_id) VALUES (?,?)').run(id, req.userId);
  db.prepare('INSERT INTO conversation_participants (conversation_id,user_id) VALUES (?,?)').run(id, otherUserId);
  res.json({ conversationId: id });
});

app.post('/api/conversations/:id/messages', auth, (req, res) => {
  const { text } = req.body;
  if (!text || !String(text).trim()) return res.status(400).json({ error: 'Empty message' });
  const isParticipant = db.prepare('SELECT 1 as ok FROM conversation_participants WHERE conversation_id = ? AND user_id = ?').get(req.params.id, req.userId);
  if (!isParticipant) return res.status(403).json({ error: 'Forbidden' });
  db.prepare('INSERT INTO messages (id,conversation_id,sender_id,text,created_at) VALUES (?,?,?,?,?)').run(
    createId('msg'),
    req.params.id,
    req.userId,
    String(text).trim(),
    new Date().toISOString(),
  );
  db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(new Date().toISOString(), req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, HOST, () => {
  console.log(`API running on http://${HOST}:${PORT}`);
});
