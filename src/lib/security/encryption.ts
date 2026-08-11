import { encryption } from '../utils';

// Encryption service for sensitive data
export class EncryptionService {
  private key: CryptoKey | null = null;
  private initialized = false;
  private initPromise: Promise<void> | null = null;

  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    this.initPromise ??= this._initialize();
    await this.initPromise;
  }

  private async _initialize(): Promise<void> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(process.env.ENCRYPTION_KEY || 'default-fallback-key'),
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );

    this.key = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new TextEncoder().encode('todo-phoenix-alpha-salt'), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    this.initialized = true;
  }

  async encrypt(data: string): Promise<string> {
    await this.ensureInitialized();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      this.key!,
      new TextEncoder().encode(data)
    );

    // Combine IV and encrypted data, then Base64 encode
    const combined = new Uint8Array(iv.length + (encrypted as ArrayBuffer).byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(encrypted as ArrayBuffer), iv.length);

    return btoa(String.fromCharCode(...combined));
  }

  async decrypt(encryptedData: string): Promise<string> {
    await this.ensureInitialized();
    // Decode Base64
    const decoded = atob(encryptedData);
    const combined = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) {
      combined[i] = decoded.charCodeAt(i);
    }

    const iv = combined.slice(0, 12);
    const actualEncrypted = combined.slice(12);

    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      this.key!,
      actualEncrypted
    );

    return new TextDecoder().decode(decrypted);
  }
}

// Export singleton instance - initialize lazily
export const encryptionService = new EncryptionService();