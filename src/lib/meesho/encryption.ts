/**
 * AES-256-GCM Session Encryption Service
 * Strictly protects sensitive marketplace credentials and session tokens at rest.
 * Uses authenticated encryption (AEAD) to prevent tampering and disclosure.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // Standard 96-bit IV for AES-GCM
const TAG_LENGTH = 16; // Standard 128-bit auth tag

/**
 * Derives a 32-byte cryptographic key from environment variables.
 * Prefers MEESHO_ENCRYPTION_KEY, falls back to NEXTAUTH_SECRET.
 */
function getEncryptionKey(): Buffer {
  const secret = process.env.MEESHO_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error(
      'Session encryption key is not configured. Set MEESHO_ENCRYPTION_KEY or NEXTAUTH_SECRET in server environment.'
    );
  }
  // Deterministically hash the secret to produce a 256-bit (32-byte) key
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts arbitrary plaintext or JSON string into an authenticated ciphertext string.
 * Output format: iv:tag:ciphertext (hex-encoded)
 */
export function encryptSession(data: string | object): string {
  const key = getEncryptionKey();
  const plaintext = typeof data === 'string' ? data : JSON.stringify(data);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an authenticated ciphertext string back into plaintext or parsed JSON.
 * Throws if tampering is detected or if decryption fails.
 */
export function decryptSession<T = any>(encryptedString: string): T {
  if (!encryptedString || !encryptedString.includes(':')) {
    throw new Error('Invalid encrypted session string format.');
  }

  const parts = encryptedString.split(':');
  if (parts.length !== 3) {
    throw new Error('Malformed encrypted session string. Expected iv:tag:ciphertext.');
  }

  const [ivHex, tagHex, ciphertextHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return decrypted as unknown as T;
  }
}

