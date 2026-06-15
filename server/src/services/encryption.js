const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) throw new Error('ENCRYPTION_KEY env var is not set');
  // Accept a 64-char hex string or 32-byte base64
  if (raw.length === 64) return Buffer.from(raw, 'hex');
  return Buffer.from(raw, 'base64').slice(0, KEY_LENGTH);
}

function getHmacKey() {
  const raw = process.env.HMAC_KEY;
  if (!raw) throw new Error('HMAC_KEY env var is not set');
  return Buffer.from(raw, 'hex');
}

function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) return null;
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: iv(12) + tag(16) + ciphertext, base64-encoded
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function decrypt(ciphertext) {
  if (!ciphertext) return null;
  const key = getKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.slice(0, IV_LENGTH);
  const tag = buf.slice(IV_LENGTH, IV_LENGTH + 16);
  const data = buf.slice(IV_LENGTH + 16);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(data) + decipher.final('utf8');
}

function hmacToken(plaintext) {
  if (!plaintext) return null;
  return crypto.createHmac('sha256', getHmacKey()).update(String(plaintext).toLowerCase().trim()).digest('hex');
}

function encryptParticipant(data) {
  return {
    firstNameEnc: encrypt(data.firstName),
    lastNameEnc: encrypt(data.lastName),
    phoneEnc: encrypt(data.phone),
    familyEnc: encrypt(data.family),
    whatsImportantEnc: encrypt(data.whatsImportant),
    whyJoinedEnc: encrypt(data.whyJoined),
    whatAccomplishEnc: encrypt(data.whatAccomplish),
    firstNameToken: hmacToken(data.firstName),
    lastNameToken: hmacToken(data.lastName),
  };
}

function decryptParticipant(row) {
  if (!row) return null;
  return {
    id: row.id,
    programId: row.programId,
    groupId: row.groupId,
    firstName: decrypt(row.firstNameEnc),
    lastName: decrypt(row.lastNameEnc),
    phone: decrypt(row.phoneEnc),
    family: decrypt(row.familyEnc),
    whatsImportant: decrypt(row.whatsImportantEnc),
    whyJoined: decrypt(row.whyJoinedEnc),
    whatAccomplish: decrypt(row.whatAccomplishEnc),
    isDeleted: row.isDeleted,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    project: row.project,
    group: row.group,
  };
}

module.exports = { encrypt, decrypt, hmacToken, encryptParticipant, decryptParticipant };
