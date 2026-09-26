/**
 * Server-side auth: JWT issuance + verification, role guards.
 * Single source of truth for `req.user` on protected endpoints and Socket.IO connections.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const TOKEN_TTL_SEC = 12 * 60 * 60; // 12 hours

let cachedSecret = null;

function getJwtSecret() {
  if (cachedSecret) return cachedSecret;
  const raw =
    process.env.JWT_SECRET ||
    process.env.MESSAGE_JWT_SECRET ||
    process.env.SESSION_SECRET;
  if (!raw) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET is not set');
    }
    // Dev-only ephemeral secret. Tokens won't survive a server restart, which is fine.
    console.warn('[auth] JWT_SECRET not set; generating ephemeral dev secret');
    cachedSecret = crypto.randomBytes(48).toString('hex');
    return cachedSecret;
  }
  cachedSecret = raw;
  return cachedSecret;
}

const VALID_ROLES = new Set(['admin', 'manager', 'driver', 'student']);

const DEFAULT_USERS = [
  { id: 'admin-1', name: 'Morgan Reeves', role: 'admin', email: 'mreeves@p2plive.unc.edu', password: 'admin' },
  { id: 'manager-1', name: 'James Chen', role: 'manager', email: 'jchen@p2plive.unc.edu', password: 'manager' },
  { id: 'driver-1', name: 'Marcus Williams', role: 'driver', email: 'mwilliams@p2plive.unc.edu', password: 'driver' },
  { id: 'driver-2', name: 'Elena Vasquez', role: 'driver', email: 'evasquez@p2plive.unc.edu', password: 'driver' },
  { id: 'driver-3', name: 'David Okonkwo', role: 'driver', email: 'dokonkwo@p2plive.unc.edu', password: 'driver' },
  { id: 'driver-4', name: 'Priya Sharma', role: 'driver', email: 'psharma@p2plive.unc.edu', password: 'driver' },
  { id: 'driver-5', name: 'Ryan Foster', role: 'driver', email: 'rfoster@p2plive.unc.edu', password: 'driver' },
  { id: 'student-1', name: 'Alex Rivera', role: 'student', email: 'arivera@unc.edu', password: 'student' },
];

function findUserByCredentials(usernameRaw, password) {
  if (!usernameRaw || typeof password !== 'string') return null;
  const u = String(usernameRaw).trim().toLowerCase();
  const found = DEFAULT_USERS.find(
    (x) =>
      (x.role === u || x.id === u || x.email.toLowerCase() === u || x.name.toLowerCase().includes(u)) &&
      x.password === password
  );
  if (found) {
    return { id: found.id, name: found.name, role: found.role, email: found.email };
  }
  return null;
}

function findUserById(id) {
  const found = DEFAULT_USERS.find((x) => x.id === id);
  if (!found) return null;
  return { id: found.id, name: found.name, role: found.role, email: found.email };
}

function listManagedUsers(role) {
  return DEFAULT_USERS
    .filter((u) => u.role === role)
    .map((u) => ({ id: u.id, name: u.name, role: u.role, email: u.email }));
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
    },
    getJwtSecret(),
    { expiresIn: TOKEN_TTL_SEC, algorithm: 'HS256' }
  );
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] });
    if (!decoded || typeof decoded !== 'object') return null;
    if (!VALID_ROLES.has(decoded.role)) return null;
    return {
      id: decoded.sub,
      name: decoded.name,
      role: decoded.role,
      email: decoded.email,
    };
  } catch (_) {
    return null;
  }
}

function extractBearerToken(req) {
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header || typeof header !== 'string') return null;
  const m = header.match(/^Bearer\s+(.+)$/i);
  if (!m) return null;
  return m[1].trim();
}

function authenticateRequest(req) {
  const token = extractBearerToken(req);
  return verifyToken(token);
}

function sendUnauthorized(res, message) {
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message || 'Unauthorized' }));
}

function sendForbidden(res, message) {
  res.writeHead(403, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: message || 'Forbidden' }));
}

function isMessagingRole(role) {
  return role === 'driver' || role === 'manager' || role === 'admin';
}

module.exports = {
  TOKEN_TTL_SEC,
  findUserByCredentials,
  findUserById,
  listManagedUsers,
  signToken,
  verifyToken,
  extractBearerToken,
  authenticateRequest,
  sendUnauthorized,
  sendForbidden,
  isMessagingRole,
};
