/**
 * SQLite store for ops messaging.
 * Persists encrypted message bodies; plaintext only flows through `crypto.cjs` decrypt.
 *
 * Schema is created on first open. The DB file lives under server/data/.
 */

const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { encryptMessage, decryptMessage } = require('./crypto.cjs');

const DB_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = process.env.MESSAGES_DB_PATH || path.join(DB_DIR, 'messages.db');

let db = null;

function getDb() {
  if (db) return db;
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  initSchema(db);
  return db;
}

function initSchema(d) {
  d.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      driver_id TEXT NOT NULL,
      driver_name TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_message_at INTEGER,
      last_message_sender_id TEXT,
      last_message_preview_encrypted TEXT,
      last_message_preview_iv TEXT,
      last_message_preview_auth_tag TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_conv_driver ON conversations(driver_id);
    CREATE INDEX IF NOT EXISTS idx_conv_updated ON conversations(updated_at DESC);

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      sender_role TEXT NOT NULL,
      encrypted_body TEXT NOT NULL,
      iv TEXT NOT NULL,
      auth_tag TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      delivered_at INTEGER,
      read_at INTEGER,
      status TEXT NOT NULL DEFAULT 'sent',
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_msg_conv_created ON messages(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS conversation_unread (
      conversation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (conversation_id, user_id),
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);
}

function newId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function conversationIdForDriver(driverId) {
  return `conv-driver-${driverId}`;
}

function ensureDriverConversation(driverId, driverName) {
  const d = getDb();
  const id = conversationIdForDriver(driverId);
  const existing = d.prepare('SELECT id FROM conversations WHERE id = ?').get(id);
  if (existing) {
    if (driverName) {
      d.prepare('UPDATE conversations SET driver_name = ? WHERE id = ?').run(driverName, id);
    }
    return id;
  }
  const now = Date.now();
  d.prepare(
    `INSERT INTO conversations (id, driver_id, driver_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, driverId, driverName || driverId, now, now);
  return id;
}

function decryptPreview(row) {
  if (!row.last_message_preview_encrypted) return null;
  try {
    return decryptMessage({
      encryptedBody: row.last_message_preview_encrypted,
      iv: row.last_message_preview_iv,
      authTag: row.last_message_preview_auth_tag,
    });
  } catch (e) {
    return null;
  }
}

function decryptMessageRow(row) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    senderRole: row.sender_role,
    body: decryptMessage({
      encryptedBody: row.encrypted_body,
      iv: row.iv,
      authTag: row.auth_tag,
    }),
    createdAt: row.created_at,
    deliveredAt: row.delivered_at,
    readAt: row.read_at,
    status: row.status,
  };
}

function getUnreadFor(conversationId, userId) {
  const d = getDb();
  const row = d
    .prepare('SELECT count FROM conversation_unread WHERE conversation_id = ? AND user_id = ?')
    .get(conversationId, userId);
  return row ? row.count : 0;
}

function listConversationsForManager(_viewerUserId) {
  const d = getDb();
  const rows = d
    .prepare(
      `SELECT c.*
         FROM conversations c
         ORDER BY COALESCE(c.last_message_at, c.created_at) DESC`
    )
    .all();
  return rows.map((row) => ({
    id: row.id,
    driverId: row.driver_id,
    driverName: row.driver_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    lastMessageSenderId: row.last_message_sender_id,
    lastMessagePreview: decryptPreview(row),
    unreadCount: getUnreadFor(row.id, '__managers__'),
  }));
}

function listConversationsForDriver(driverId) {
  const d = getDb();
  const id = conversationIdForDriver(driverId);
  const row = d.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  if (!row) return [];
  return [
    {
      id: row.id,
      driverId: row.driver_id,
      driverName: row.driver_name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastMessageAt: row.last_message_at,
      lastMessageSenderId: row.last_message_sender_id,
      lastMessagePreview: decryptPreview(row),
      unreadCount: getUnreadFor(row.id, driverId),
    },
  ];
}

function getConversationById(id) {
  const d = getDb();
  const row = d.prepare('SELECT * FROM conversations WHERE id = ?').get(id);
  if (!row) return null;
  return {
    id: row.id,
    driverId: row.driver_id,
    driverName: row.driver_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastMessageAt: row.last_message_at,
    lastMessageSenderId: row.last_message_sender_id,
  };
}

function listMessages(conversationId, opts = {}) {
  const d = getDb();
  const limit = Math.min(Math.max(opts.limit || 100, 1), 500);
  const before = opts.before;
  let sql = `SELECT * FROM messages WHERE conversation_id = ?`;
  const params = [conversationId];
  if (before && Number.isFinite(before)) {
    sql += ` AND created_at < ?`;
    params.push(before);
  }
  sql += ` ORDER BY created_at ASC LIMIT ?`;
  params.push(limit);
  const rows = d.prepare(sql).all(...params);
  return rows.map(decryptMessageRow);
}

function appendMessage({ conversationId, senderId, senderName, senderRole, body }) {
  const d = getDb();
  const trimmed = String(body || '').trim();
  if (!trimmed) throw new Error('Empty message body');
  const enc = encryptMessage(trimmed);
  const preview = encryptMessage(trimmed.length > 140 ? trimmed.slice(0, 140) : trimmed);
  const id = newId('msg');
  const now = Date.now();
  const insert = d.prepare(
    `INSERT INTO messages
       (id, conversation_id, sender_id, sender_name, sender_role,
        encrypted_body, iv, auth_tag, created_at, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'sent')`
  );
  const updateConv = d.prepare(
    `UPDATE conversations
        SET updated_at = ?, last_message_at = ?, last_message_sender_id = ?,
            last_message_preview_encrypted = ?, last_message_preview_iv = ?, last_message_preview_auth_tag = ?
      WHERE id = ?`
  );
  const incOther = d.prepare(
    `INSERT INTO conversation_unread (conversation_id, user_id, count)
     VALUES (?, ?, 1)
     ON CONFLICT(conversation_id, user_id) DO UPDATE SET count = count + 1`
  );
  const tx = d.transaction(() => {
    insert.run(
      id,
      conversationId,
      senderId,
      senderName,
      senderRole,
      enc.encryptedBody,
      enc.iv,
      enc.authTag,
      now
    );
    updateConv.run(
      now,
      now,
      senderId,
      preview.encryptedBody,
      preview.iv,
      preview.authTag,
      conversationId
    );
    // Increment unread for the *other* side. Conversation has one driver participant
    // and the manager pool collectively. We bucket unread under a synthetic
    // "manager" recipient when sender is the driver, and under driverId when sender is a manager.
    const conv = d.prepare('SELECT driver_id FROM conversations WHERE id = ?').get(conversationId);
    if (!conv) return;
    if (senderRole === 'driver') {
      incOther.run(conversationId, '__managers__');
    } else {
      incOther.run(conversationId, conv.driver_id);
    }
  });
  tx();

  return decryptMessageRow({
    id,
    conversation_id: conversationId,
    sender_id: senderId,
    sender_name: senderName,
    sender_role: senderRole,
    encrypted_body: enc.encryptedBody,
    iv: enc.iv,
    auth_tag: enc.authTag,
    created_at: now,
    delivered_at: null,
    read_at: null,
    status: 'sent',
  });
}

function markRead(conversationId, viewerRole, viewerUserId) {
  const d = getDb();
  const now = Date.now();
  const conv = d.prepare('SELECT driver_id FROM conversations WHERE id = ?').get(conversationId);
  if (!conv) return { ok: false };

  // Mark unread bucket for this viewer scope as zero.
  let unreadKey;
  if (viewerRole === 'driver') {
    unreadKey = conv.driver_id;
  } else if (viewerRole === 'manager' || viewerRole === 'admin') {
    unreadKey = '__managers__';
  } else {
    return { ok: false };
  }
  d.prepare(
    `INSERT INTO conversation_unread (conversation_id, user_id, count)
     VALUES (?, ?, 0)
     ON CONFLICT(conversation_id, user_id) DO UPDATE SET count = 0`
  ).run(conversationId, unreadKey);

  // Mark all messages from the *other* side as read.
  const otherClause = viewerRole === 'driver'
    ? "sender_role <> 'driver'"
    : "sender_role = 'driver'";
  const stmt = d.prepare(
    `UPDATE messages SET read_at = ?, status = 'read'
       WHERE conversation_id = ? AND read_at IS NULL AND ${otherClause}`
  );
  const result = stmt.run(now, conversationId);
  return { ok: true, updated: result.changes };
}

function markDelivered(messageIds) {
  if (!Array.isArray(messageIds) || messageIds.length === 0) return { updated: 0 };
  const d = getDb();
  const now = Date.now();
  const placeholders = messageIds.map(() => '?').join(',');
  const stmt = d.prepare(
    `UPDATE messages SET delivered_at = ?, status = CASE WHEN status = 'sent' THEN 'delivered' ELSE status END
       WHERE delivered_at IS NULL AND id IN (${placeholders})`
  );
  const result = stmt.run(now, ...messageIds);
  return { updated: result.changes };
}

function getUnreadCountForViewer(conversationId, viewerRole, viewerUserId) {
  if (viewerRole === 'driver') return getUnreadFor(conversationId, viewerUserId);
  // Managers + admins bucket under shared __managers__ key.
  return getUnreadFor(conversationId, '__managers__');
}

function getTotalUnreadForManager() {
  const d = getDb();
  const row = d
    .prepare(`SELECT COALESCE(SUM(count), 0) AS total FROM conversation_unread WHERE user_id = '__managers__'`)
    .get();
  return row && row.total ? Number(row.total) : 0;
}

function getTotalUnreadForDriver(driverId) {
  return getUnreadFor(conversationIdForDriver(driverId), driverId);
}

module.exports = {
  getDb,
  conversationIdForDriver,
  ensureDriverConversation,
  listConversationsForManager,
  listConversationsForDriver,
  getConversationById,
  listMessages,
  appendMessage,
  markRead,
  markDelivered,
  getUnreadCountForViewer,
  getTotalUnreadForManager,
  getTotalUnreadForDriver,
};
