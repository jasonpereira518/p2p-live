/**
 * Centralized access checks for the messaging module.
 * Every API handler MUST call `enforceConversationAccess` before reading or writing.
 */

const store = require('./store.cjs');

function isMessagingMember(role) {
  return role === 'driver' || role === 'manager';
}

/**
 * Validates that `user` is allowed to interact with `conversationId`.
 * Returns { allowed: true, conversation } or { allowed: false, status, error }.
 *
 * Rules:
 *  - Drivers may access only their own conversation (`conv.driver_id === user.id`).
 *  - Managers may access any driver-dispatch conversation.
 *  - Admins are explicitly denied (audit-only role; no message body access).
 *  - Other roles (student, etc.) are denied.
 */
function enforceConversationAccess(user, conversationId, opts = {}) {
  if (!user) return { allowed: false, status: 401, error: 'Unauthorized' };
  if (user.role === 'admin') {
    return { allowed: false, status: 403, error: 'Admins cannot read messages' };
  }
  if (!isMessagingMember(user.role)) {
    return { allowed: false, status: 403, error: 'Forbidden' };
  }

  // For drivers, the conversation id is fully determined by their user id. If they are
  // hitting their own dispatch conversation we transparently create it on first access.
  if (user.role === 'driver') {
    const expectedId = store.conversationIdForDriver(user.id);
    if (conversationId !== expectedId) {
      return { allowed: false, status: 403, error: 'Forbidden' };
    }
    if (opts.autoCreate !== false) {
      store.ensureDriverConversation(user.id, user.name);
    }
  }

  const conversation = store.getConversationById(conversationId);
  if (!conversation) return { allowed: false, status: 404, error: 'Conversation not found' };
  if (user.role === 'driver' && conversation.driverId !== user.id) {
    return { allowed: false, status: 403, error: 'Forbidden' };
  }
  return { allowed: true, conversation };
}

function canListConversations(user) {
  if (!user) return false;
  if (user.role === 'admin') return false;
  return isMessagingMember(user.role);
}

module.exports = {
  enforceConversationAccess,
  canListConversations,
  isMessagingMember,
};
