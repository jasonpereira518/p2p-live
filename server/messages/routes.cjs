/**
 * REST handlers for the secure messaging module.
 * Mounted from server/index.cjs. All paths require a Bearer JWT.
 */

const auth = require('./auth.cjs');
const access = require('./access.cjs');
const store = require('./store.cjs');

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let total = 0;
    const MAX = 64 * 1024;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (_) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
}

const messageRouteRe = /^\/api\/messages\/conversations\/([^\/]+)\/messages\/?$/;
const readRouteRe = /^\/api\/messages\/conversations\/([^\/]+)\/read\/?$/;
const conversationDetailRe = /^\/api\/messages\/conversations\/([^\/]+)\/?$/;

async function handleAuthLogin(req, res) {
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return send(res, 400, { error: e.message || 'Invalid JSON' });
  }
  const { username, password } = body || {};
  const user = auth.findUserByCredentials(username, password);
  if (!user) {
    return send(res, 401, { error: 'Invalid credentials' });
  }
  const token = auth.signToken(user);
  return send(res, 200, {
    token,
    expiresIn: auth.TOKEN_TTL_SEC,
    user,
  });
}

async function handleAuthMe(req, res) {
  const user = auth.authenticateRequest(req);
  if (!user) return auth.sendUnauthorized(res);
  return send(res, 200, { user });
}

async function handleListConversations(req, res) {
  const user = auth.authenticateRequest(req);
  if (!user) return auth.sendUnauthorized(res);
  if (!access.canListConversations(user)) return auth.sendForbidden(res);

  if (user.role === 'driver') {
    store.ensureDriverConversation(user.id, user.name);
    return send(res, 200, {
      conversations: store.listConversationsForDriver(user.id),
      totalUnread: store.getTotalUnreadForDriver(user.id),
    });
  }
  if (user.role === 'manager') {
    return send(res, 200, {
      conversations: store.listConversationsForManager(user.id),
      totalUnread: store.getTotalUnreadForManager(),
    });
  }
  return auth.sendForbidden(res);
}

async function handleListMessages(req, res, conversationId) {
  const user = auth.authenticateRequest(req);
  if (!user) return auth.sendUnauthorized(res);
  const check = access.enforceConversationAccess(user, conversationId);
  if (!check.allowed) return send(res, check.status, { error: check.error });

  const url = new URL(req.url, 'http://localhost');
  const limit = parseInt(url.searchParams.get('limit') || '100', 10);
  const before = parseInt(url.searchParams.get('before') || '0', 10);

  const messages = store.listMessages(conversationId, {
    limit: Number.isFinite(limit) ? limit : 100,
    before: Number.isFinite(before) && before > 0 ? before : undefined,
  });
  return send(res, 200, {
    conversation: check.conversation,
    messages,
    unreadCount: store.getUnreadCountForViewer(conversationId, user.role, user.id),
  });
}

async function handlePostMessage(req, res, conversationId, broadcastFn) {
  const user = auth.authenticateRequest(req);
  if (!user) return auth.sendUnauthorized(res);
  const check = access.enforceConversationAccess(user, conversationId);
  if (!check.allowed) return send(res, check.status, { error: check.error });

  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return send(res, 400, { error: e.message || 'Invalid JSON' });
  }
  const text = body && typeof body.body === 'string' ? body.body : '';
  const clientMessageId = body && typeof body.clientMessageId === 'string' ? body.clientMessageId : null;
  if (!text.trim()) return send(res, 400, { error: 'Message body is required' });
  if (text.length > 4000) return send(res, 413, { error: 'Message too long' });

  const message = store.appendMessage({
    conversationId,
    senderId: user.id,
    senderName: user.name,
    senderRole: user.role,
    body: text,
  });

  if (typeof broadcastFn === 'function') {
    try {
      broadcastFn('message:new', conversationId, { message, clientMessageId });
    } catch (_) {}
  }

  return send(res, 201, { message, clientMessageId });
}

async function handleMarkRead(req, res, conversationId, broadcastFn) {
  const user = auth.authenticateRequest(req);
  if (!user) return auth.sendUnauthorized(res);
  const check = access.enforceConversationAccess(user, conversationId);
  if (!check.allowed) return send(res, check.status, { error: check.error });

  const result = store.markRead(conversationId, user.role, user.id);
  if (typeof broadcastFn === 'function' && result.updated > 0) {
    try {
      broadcastFn('message:read', conversationId, {
        readerId: user.id,
        readerRole: user.role,
        at: Date.now(),
      });
    } catch (_) {}
  }
  return send(res, 200, {
    ok: true,
    updated: result.updated || 0,
    unreadCount: store.getUnreadCountForViewer(conversationId, user.role, user.id),
  });
}

async function handleStartConversation(req, res) {
  const user = auth.authenticateRequest(req);
  if (!user) return auth.sendUnauthorized(res);
  if (user.role !== 'manager') return auth.sendForbidden(res, 'Only managers can start conversations');
  let body;
  try {
    body = await readJsonBody(req);
  } catch (e) {
    return send(res, 400, { error: e.message || 'Invalid JSON' });
  }
  const driverId = body && typeof body.driverId === 'string' ? body.driverId.trim() : '';
  const driverName = body && typeof body.driverName === 'string' ? body.driverName.trim() : '';
  if (!driverId) return send(res, 400, { error: 'driverId is required' });

  const id = store.ensureDriverConversation(driverId, driverName || driverId);
  const conv = store.getConversationById(id);
  return send(res, 200, { conversation: conv });
}

async function handleListDrivers(req, res) {
  const user = auth.authenticateRequest(req);
  if (!user) return auth.sendUnauthorized(res);
  if (user.role !== 'manager' && user.role !== 'admin') return auth.sendForbidden(res);
  return send(res, 200, { drivers: auth.listManagedUsers('driver') });
}

/**
 * Returns true if the request was handled (caller must early-return).
 */
async function tryHandle(req, res, broadcastFn) {
  const url = req.url || '';
  const method = req.method || 'GET';

  // Auth endpoints (open).
  if (url === '/api/auth/login' && method === 'POST') {
    await handleAuthLogin(req, res);
    return true;
  }
  if (url === '/api/auth/me' && method === 'GET') {
    await handleAuthMe(req, res);
    return true;
  }

  if (!url.startsWith('/api/messages')) return false;

  if (url === '/api/messages/conversations' && method === 'GET') {
    await handleListConversations(req, res);
    return true;
  }
  if (url === '/api/messages/conversations' && method === 'POST') {
    await handleStartConversation(req, res);
    return true;
  }
  if (url === '/api/messages/drivers' && method === 'GET') {
    await handleListDrivers(req, res);
    return true;
  }

  // Path-only match (strip query string).
  const pathOnly = url.split('?')[0];

  let m = pathOnly.match(messageRouteRe);
  if (m) {
    const conversationId = decodeURIComponent(m[1]);
    if (method === 'GET') {
      await handleListMessages(req, res, conversationId);
      return true;
    }
    if (method === 'POST') {
      await handlePostMessage(req, res, conversationId, broadcastFn);
      return true;
    }
  }

  m = pathOnly.match(readRouteRe);
  if (m && method === 'POST') {
    const conversationId = decodeURIComponent(m[1]);
    await handleMarkRead(req, res, conversationId, broadcastFn);
    return true;
  }

  m = pathOnly.match(conversationDetailRe);
  if (m && method === 'GET') {
    const conversationId = decodeURIComponent(m[1]);
    const user = auth.authenticateRequest(req);
    if (!user) {
      auth.sendUnauthorized(res);
      return true;
    }
    const check = access.enforceConversationAccess(user, conversationId);
    if (!check.allowed) {
      send(res, check.status, { error: check.error });
      return true;
    }
    send(res, 200, {
      conversation: check.conversation,
      unreadCount: store.getUnreadCountForViewer(conversationId, user.role, user.id),
    });
    return true;
  }

  return false;
}

module.exports = { tryHandle };
