import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Get encryption key from environment.
 * For production, use a secure key management service.
 */
function getEncryptionKey(): Buffer {
    const key = process.env.ENCRYPTION_KEY;
    if (!key) {
        // Fallback for development - generate a deterministic key
        // In production, this should fail or use a proper key
        console.warn('[Encryption] ENCRYPTION_KEY not set, using fallback key');
        return crypto.scryptSync('podcastpitch-dev-key', 'salt', 32);
    }
    // If key is hex-encoded 32 bytes
    if (key.length === 64) {
        return Buffer.from(key, 'hex');
    }
    // Derive key from passphrase
    return crypto.scryptSync(key, 'podcastpitch-salt', 32);
}

/**
 * Encrypt sensitive data using AES-256-GCM
 */
export function encrypt(plaintext: string): string {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    const authTag = cipher.getAuthTag();

    // Combine IV + AuthTag + Encrypted data
    const combined = Buffer.concat([
        iv,
        authTag,
        Buffer.from(encrypted, 'base64')
    ]);

    return combined.toString('base64');
}

/**
 * Decrypt data that was encrypted with encrypt()
 */
export function decrypt(encryptedData: string): string {
    const key = getEncryptionKey();
    const combined = Buffer.from(encryptedData, 'base64');

    // Extract IV, AuthTag, and encrypted data
    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);

    return decrypted.toString('utf8');
}

/**
 * Encrypt an object as JSON
 */
export function encryptObject(obj: Record<string, unknown>): string {
    return encrypt(JSON.stringify(obj));
}

/**
 * Decrypt to an object
 */
export function decryptObject<T = Record<string, unknown>>(encryptedData: string): T {
    return JSON.parse(decrypt(encryptedData));
}
