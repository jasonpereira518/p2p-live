/**
 * AES-256-GCM encryption-at-rest for message bodies.
 * Uses MESSAGE_ENCRYPTION_KEY (hex 64 chars or base64 32 bytes) from environment.
 * Plaintext is never logged or returned by anything except authorized read paths.
 */

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_BYTES = 32;

let cachedKey = null;

function deriveKey() {
  if (cachedKey) return cachedKey;
  const raw = process.env.MESSAGE_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'MESSAGE_ENCRYPTION_KEY is not set. Generate with: openssl rand -hex 32'
    );
  }
  let buf;
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length === KEY_BYTES * 2) {
    buf = Buffer.from(raw, 'hex');
  } else {
    try {
      buf = Buffer.from(raw, 'base64');
    } catch (_) {
      buf = Buffer.from(raw, 'utf8');
    }
  }
  if (buf.length < KEY_BYTES) {
    // Stretch shorter input to 32 bytes via SHA-256 so dev keys still work.
    buf = crypto.createHash('sha256').update(buf).digest();
  } else if (buf.length > KEY_BYTES) {
    buf = buf.subarray(0, KEY_BYTES);
  }
  cachedKey = buf;
  return cachedKey;
}

function encryptMessage(plainText) {
  if (typeof plainText !== 'string') {
    throw new Error('encryptMessage expects a string');
  }
  const key = deriveKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plainText, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return {
    encryptedBody: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  };
}

function decryptMessage(payload) {
  if (!payload || !payload.encryptedBody || !payload.iv || !payload.authTag) {
    throw new Error('decryptMessage: missing payload fields');
  }
  const key = deriveKey();
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const ciphertext = Buffer.from(payload.encryptedBody, 'base64');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString('utf8');
}

function isConfigured() {
  try {
    deriveKey();
    return true;
  } catch (_) {
    return false;
  }
}

module.exports = { encryptMessage, decryptMessage, isConfigured };
