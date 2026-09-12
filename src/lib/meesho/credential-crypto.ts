/**
 * Meesho Credential Encryption Utility
 * Server-side ONLY. AES-256-GCM authenticated encryption for Meesho login credentials.
 *
 * SECURITY CONTRACT:
 * - Uses MEESHO_ENCRYPTION_KEY exclusively. NO fallback to NEXTAUTH_SECRET.
 * - Versioned payload format (v1:iv:tag:ciphertext) for future key rotation.
 * - Random IV per encryption call.
 * - Authentication tag prevents undetected tampering.
 * - Never call from client components. Never log return values.
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce (standard for AES-GCM)
const TAG_LENGTH = 16; // 128-bit auth tag
const CURRENT_VERSION = 'v1';

/**
 * Derives the 32-byte encryption key from MEESHO_ENCRYPTION_KEY env var.
 * Throws clearly if key is not configured — never silently uses a fallback.
 */
function getCredentialKey(): Buffer {
  const rawKey = process.env.MEESHO_ENCRYPTION_KEY;
  if (!rawKey || rawKey.trim().length === 0) {
    throw new Error(
      '[Credential Crypto] MEESHO_ENCRYPTION_KEY is not set. ' +
        'Configure a 32-byte hex or ASCII key in server environment. ' +
        'Run: node -e "require(\'crypto\').randomBytes(32).toString(\'hex\')" to generate one.'
    );
  }
  // If it looks like a 64-char hex string, decode as hex (32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(rawKey.trim())) {
    return Buffer.from(rawKey.trim(), 'hex');
  }
  // Otherwise, hash to produce deterministic 32-byte key
  return crypto.createHash('sha256').update(rawKey).digest();
}

/**
 * Encrypts a plaintext credential string using AES-256-GCM.
 * Returns a versioned, self-describing string: "v1:<iv_hex>:<tag_hex>:<ciphertext_hex>"
 *
 * @param plaintext - The credential to encrypt (login identifier or password).
 * @returns Versioned encrypted string, safe for database storage.
 */
export function encryptCredential(plaintext: string): string {
  if (!plaintext || plaintext.length === 0) {
    throw new Error('[Credential Crypto] Cannot encrypt empty credential.');
  }

  const key = getCredentialKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');

  return `${CURRENT_VERSION}:${iv.toString('hex')}:${authTag}:${ciphertext}`;
}

/**
 * Decrypts a versioned credential string produced by encryptCredential().
 * Throws if:
 * - Format is invalid
 * - Version is unsupported
 * - Authentication tag fails (tampering detected)
 * - Decryption key is wrong
 *
 * @param encryptedString - The versioned encrypted string from the database.
 * @returns Decrypted plaintext credential string.
 */
export function decryptCredential(encryptedString: string): string {
  if (!encryptedString) {
    throw new Error('[Credential Crypto] Cannot decrypt empty string.');
  }

  const parts = encryptedString.split(':');

  // v1 format: version:iv:tag:ciphertext (4 parts)
  if (parts.length !== 4) {
    throw new Error(
      '[Credential Crypto] Malformed credential string. Expected version:iv:tag:ciphertext.'
    );
  }

  const [version, ivHex, tagHex, ciphertextHex] = parts;

  if (version !== 'v1') {
    throw new Error(
      `[Credential Crypto] Unsupported credential format version: "${version}". Only "v1" is supported.`
    );
  }

  const key = getCredentialKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });

  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * Returns true if MEESHO_ENCRYPTION_KEY is configured and usable.
 * Safe to call from middleware/startup checks.
 */
export function isCredentialKeyConfigured(): boolean {
  try {
    getCredentialKey();
    return true;
  } catch {
    return false;
  }
}
