import * as crypto from 'crypto';

export interface EncryptedData {
    salt: string;
    iv: string;
    authTag: string;
    encrypted: string;
}

/**
 * Encrypts a string using AES-256-GCM.
 * @param content The original HTML content to encrypt
 * @param password The user-provided password
 * @returns The encrypted data package
 */
export function encryptContent(content: string, password: string): EncryptedData {
    // 1. Generate random salt (16 bytes)
    const salt = crypto.randomBytes(16);

    // 2. Derive strong key (PBKDF2, 100,000 iterations, SHA-256)
    // Parameters must match the frontend decryption
    const key = crypto.pbkdf2Sync(password, salt as any, 100000, 32, 'sha256') as any;

    // 3. Generate initialization vector IV (12 bytes)
    const iv = crypto.randomBytes(12) as any;

    // 4. Create cipher instance (AES-256-GCM)
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // 5. Encrypt
    let encrypted = cipher.update(content, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // 6. Get auth tag (for integrity check)
    const authTag = cipher.getAuthTag();

    // 7. Return result
    return {
        salt: salt.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        encrypted: encrypted
    };
}
