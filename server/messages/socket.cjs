/**
 * Socket.IO realtime layer for ops messaging.
 * - JWT-authenticates connections (token via auth.token or Authorization header).
 * - Joins authorized rooms per conversation/role.
 * - Emits message:new, message:delivered, message:read, typing:start, typing:stop.
 */

const { Server } = require('socket.io');
const auth = require('./auth.cjs');
const access = require('./access.cjs');
const store = require('./store.cjs');

const MANAGER_ROOM = 'role:manager';

function conversationRoom(id) {
  return `conv:${id}`;
}

function attach(httpServer, opts = {}) {
  const io = new Server(httpServer, {
    cors: {
      origin: opts.allowedOrigins || true,
      credentials: false,
      methods: ['GET', 'POST'],
    },
    path: '/socket.io',
    transports: ['websocket', 'polling'],
  });

  io.use((socket, next) => {
    const tokenFromAuth = socket.handshake.auth && socket.handshake.auth.token;
    const tokenFromHeader = (() => {
      const h = socket.handshake.headers && socket.handshake.headers.authorization;
      if (!h || typeof h !== 'string') return null;
      const m = h.match(/^Bearer\s+(.+)$/i);
      return m ? m[1].trim() : null;
    })();
    const token = tokenFromAuth || tokenFromHeader;
    const user = auth.verifyToken(token);
    if (!user) return next(new Error('unauthorized'));
    if (user.role === 'admin') return next(new Error('forbidden'));
    if (!access.isMessagingMember(user.role)) return next(new Error('forbidden'));
    socket.data.user = user;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user;
    if (!user) {
      socket.disconnect(true);
      return;
    }

    if (user.role === 'manager') {
      socket.join(MANAGER_ROOM);
    } else if (user.role === 'driver') {
      const id = store.ensureDriverConversation(user.id, user.name);
      socket.join(conversationRoom(id));
    }

    socket.emit('connection:ready', {
      user: { id: user.id, role: user.role, name: user.name },
    });

    socket.on('conversation:join', (payload, ack) => {
      try {
        const conversationId = payload && payload.conversationId;
        if (!conversationId) return ack && ack({ ok: false, error: 'conversationId required' });
        const check = access.enforceConversationAccess(user, conversationId);
        if (!check.allowed) return ack && ack({ ok: false, error: check.error });
        socket.join(conversationRoom(conversationId));
        if (ack) ack({ ok: true });
      } catch (_) {
        if (ack) ack({ ok: false, error: 'internal' });
      }
    });

    socket.on('conversation:leave', (payload, ack) => {
      const conversationId = payload && payload.conversationId;
      if (conversationId) socket.leave(conversationRoom(conversationId));
      if (ack) ack({ ok: true });
    });

    socket.on('typing:start', (payload) => {
      const conversationId = payload && payload.conversationId;
      if (!conversationId) return;
      const check = access.enforceConversationAccess(user, conversationId);
      if (!check.allowed) return;
      socket.to(conversationRoom(conversationId)).emit('typing:start', {
        conversationId,
        userId: user.id,
        role: user.role,
        name: user.name,
      });
      if (user.role === 'driver') {
        socket.to(MANAGER_ROOM).emit('typing:start', {
          conversationId,
          userId: user.id,
          role: user.role,
          name: user.name,
        });
      }
    });

    socket.on('typing:stop', (payload) => {
      const conversationId = payload && payload.conversationId;
      if (!conversationId) return;
      socket.to(conversationRoom(conversationId)).emit('typing:stop', {
        conversationId,
        userId: user.id,
      });
      if (user.role === 'driver') {
        socket.to(MANAGER_ROOM).emit('typing:stop', { conversationId, userId: user.id });
      }
    });

    socket.on('message:delivered', (payload, ack) => {
      const conversationId = payload && payload.conversationId;
      const messageIds = Array.isArray(payload && payload.messageIds) ? payload.messageIds : [];
      if (!conversationId || messageIds.length === 0) return ack && ack({ ok: false });
      const check = access.enforceConversationAccess(user, conversationId);
      if (!check.allowed) return ack && ack({ ok: false });
      const result = store.markDelivered(messageIds);
      io.to(conversationRoom(conversationId)).emit('message:delivered', {
        conversationId,
        messageIds,
        at: Date.now(),
      });
      io.to(MANAGER_ROOM).emit('message:delivered', {
        conversationId,
        messageIds,
        at: Date.now(),
      });
      if (ack) ack({ ok: true, updated: result.updated });
    });
  });

  function broadcast(event, conversationId, payload) {
    if (!conversationId) return;
    const room = conversationRoom(conversationId);
    io.to(room).emit(event, { conversationId, ...payload });
    io.to(MANAGER_ROOM).emit(event, { conversationId, ...payload });
  }

  return { io, broadcast };
}

module.exports = { attach };
