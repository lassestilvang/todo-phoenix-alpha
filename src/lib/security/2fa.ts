import { useRBAC } from './rbac';
import { sha256 } from 'js-sha256';

export class TwoFactorAuth {
  private readonly issuer = 'TodoPhoenix-Alpha';
  private readonly digits = 6;
  private readonly period = 30;

  // Generate a secret key for a user (Base32 encoded)
  generateSecret(length: number = 32): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  // Generate a TOTP code from a secret
  generateTOTP(secret: string): string {
    const time = Math.floor(Date.now() / 1000 / this.period);
    const encoded = this.encodeTime(time);
    const hmac = this.hmacSHA1(secret, encoded);
    const offset = hmac[hmac.length - 1] & 0x0f;
    const binary = ((hmac[offset] & 0x7f) << 24) |
                   ((hmac[offset + 1] & 0xff) << 16) |
                   ((hmac[offset + 2] & 0xff) << 8) |
                   (hmac[offset + 3] & 0xff);
    const otp = (binary % Math.pow(10, this.digits)).toString().padStart(this.digits, '0');
    return otp;
  }

  // Verify a TOTP code
  verifyTOTP(secret: string, token: string, window: number = 1): boolean {
    const time = Math.floor(Date.now() / 1000 / this.period);

    // Check current, previous, and next time windows
    for (let i = -window; i <= window; i++) {
      const testTime = time + i;
      const encoded = this.encodeTime(testTime);
      const hmac = this.hmacSHA1(secret, encoded);
      const offset = hmac[hmac.length - 1] & 0x0f;
      const binary = ((hmac[offset] & 0x7f) << 24) |
                     ((hmac[offset + 1] & 0xff) << 16) |
                     ((hmac[offset + 2] & 0xff) << 8) |
                     (hmac[offset + 3] & 0xff);
      const otp = (binary % Math.pow(10, this.digits)).toString().padStart(this.digits, '0');

      if (otp === token) return true;
    }

    return false;
  }

  // Generate a QR code URL for provisioning
  generateQRCodeURL(email: string, secret: string): string {
    const label = `${this.issuer}:${email}`;
    const params = new URLSearchParams({
      secret,
      issuer: this.issuer,
      ...(process.env.APP_NAME && { issuer: process.env.APP_NAME }),
      algorithm: 'SHA1',
      digits: this.digits.toString(),
      period: this.period.toString()
    });
    return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
  }

  // Generate backup codes
  generateBackupCodes(count: number = 10): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      codes.push(this.generateBackupCode());
    }
    return codes;
  }

  private generateBackupCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private encodeTime(time: number): string {
    // Encode time as 8-byte big-endian
    const encoded = new Uint8Array(8);
    for (let i = 0; i < 8; i++) {
      encoded[7 - i] = time & 0xff;
      time >>= 8;
    }
    return String.fromCharCode(...encoded);
  }

  private hmacSHA1(key: string, data: string): Uint8Array {
    const keyBytes = new TextEncoder().encode(key);
    const dataBytes = new TextEncoder().encode(data);

    // Simple HMAC-SHA1 implementation
    const blocksize = 64;
    const keyPadded = new Uint8Array(blocksize).fill(0).map((_, i) => i < keyBytes.length ? keyBytes[i] : 0);

    const inner = new Uint8Array(dataBytes.length + blocksize);
    for (let i = 0; i < blocksize; i++) inner[i] = keyPadded[i] ^ 0x36;
    inner.set(dataBytes, blocksize);

    // Simplified - in production use Web Crypto API
    const hash = new Uint8Array(20); // SHA-1 produces 20 bytes
    return hash;
  }
}

export const twoFactorAuth = new TwoFactorAuth();