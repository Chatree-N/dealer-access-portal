import { createHmac } from 'node:crypto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  generateOtpCode,
  hashCode,
  createOtpProof,
  verifyOtpProof,
  getOtpProofSecret,
  OTP_RULES,
} from '@/server/otp';

describe('OTP Unit Tests', () => {
  describe('generateOtpCode', () => {
    it('generates a 6-digit numeric string', () => {
      for (let i = 0; i < 50; i++) {
        const code = generateOtpCode();
        expect(code).toMatch(/^\d{6}$/);
        const num = parseInt(code, 10);
        expect(num).toBeGreaterThanOrEqual(100000);
        expect(num).toBeLessThan(1000000);
      }
    });
  });

  describe('hashCode', () => {
    it('generates deterministic SHA-256 hash for code and email', () => {
      const hash1 = hashCode('123456', 'user@example.com');
      const hash2 = hashCode('123456', 'user@example.com');
      const hashUpper = hashCode('123456', 'USER@EXAMPLE.COM');
      expect(hash1).toBe(hash2);
      expect(hash1).toBe(hashUpper);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('generates different hashes for different codes or emails', () => {
      const hash1 = hashCode('123456', 'user@example.com');
      const hash2 = hashCode('654321', 'user@example.com');
      const hash3 = hashCode('123456', 'other@example.com');
      expect(hash1).not.toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });
  });

  describe('Proof Token signing and verification', () => {
    it('creates a valid proof token that verifies successfully', () => {
      const email = 'coordinator@dealer.example';
      const proof = createOtpProof(email);
      expect(proof).toContain('.');
      const isValid = verifyOtpProof(proof, email);
      expect(isValid).toBe(true);
    });

    it('normalizes email casing when verifying proof', () => {
      const proof = createOtpProof('Jane.Doe@Dealer.Example');
      expect(verifyOtpProof(proof, 'jane.doe@dealer.example')).toBe(true);
    });

    it('rejects proof token when email does not match', () => {
      const proof = createOtpProof('user1@example.com');
      expect(verifyOtpProof(proof, 'user2@example.com')).toBe(false);
    });

    it('rejects tampered proof signature', () => {
      const proof = createOtpProof('user@example.com');
      const [payload, sig] = proof.split('.');
      const tamperedSig = sig.slice(0, -4) + 'abcd';
      expect(verifyOtpProof(`${payload}.${tamperedSig}`, 'user@example.com')).toBe(false);
    });

    it('rejects malformed proof strings', () => {
      expect(verifyOtpProof('', 'user@example.com')).toBe(false);
      expect(verifyOtpProof('nodotatall', 'user@example.com')).toBe(false);
      expect(verifyOtpProof('part1.part2.part3', 'user@example.com')).toBe(false);
    });

    it('rejects expired proof tokens', () => {
      const email = 'user@example.com';
      const pastPayload = {
        email,
        verifiedAt: Date.now() - OTP_RULES.PROOF_VALIDITY_MS - 1000,
        exp: Date.now() - 1000,
      };
      const serialized = Buffer.from(JSON.stringify(pastPayload)).toString('base64url');
      const signature = createHmac('sha256', getOtpProofSecret())
        .update(serialized)
        .digest('base64url');
      const expiredProof = `${serialized}.${signature}`;

      expect(verifyOtpProof(expiredProof, email)).toBe(false);
    });
  });

  describe('getOtpProofSecret environment handling', () => {
    beforeEach(() => {
      vi.unstubAllEnvs();
    });

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('returns dev fallback in dev/test when OTP_PROOF_SECRET is missing', () => {
      vi.stubEnv('OTP_PROOF_SECRET', '');
      vi.stubEnv('NODE_ENV', 'test');
      expect(getOtpProofSecret()).toBe('dev-insecure-otp-proof-secret');
    });

    it('throws in production when OTP_PROOF_SECRET is missing', () => {
      vi.stubEnv('OTP_PROOF_SECRET', '');
      vi.stubEnv('NODE_ENV', 'production');
      expect(() => getOtpProofSecret()).toThrow(
        /OTP_PROOF_SECRET environment variable is required in production/
      );
    });

    it('returns configured secret when provided', () => {
      vi.stubEnv('OTP_PROOF_SECRET', 'custom-production-secret-999');
      expect(getOtpProofSecret()).toBe('custom-production-secret-999');
    });
  });
});
