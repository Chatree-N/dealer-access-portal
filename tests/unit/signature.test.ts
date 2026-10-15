import { describe, it, expect } from 'vitest';
import { validateSignature, MAX_SIGNATURE_BYTES } from '@/server/signature';

describe('Signature Validation (src/server/signature.ts)', () => {
  const valid1x1PngBase64 =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const validDrawnDataUrl = `data:image/png;base64,${valid1x1PngBase64}`;

  describe('drawn signatures', () => {
    it('validates a valid PNG data URL', () => {
      const result = validateSignature({
        kind: 'drawn',
        value: validDrawnDataUrl,
      });

      expect(result.kind).toBe('drawn');
      expect(result.contentType).toBe('image/png');
      expect(result.buffer).toBeInstanceOf(Buffer);
      expect(result.buffer.subarray(0, 8)).toEqual(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      );
    });

    it('rejects bad mime type (non-PNG)', () => {
      expect(() =>
        validateSignature({
          kind: 'drawn',
          value: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        })
      ).toThrow(/PNG data URL/);

      expect(() =>
        validateSignature({
          kind: 'drawn',
          value: 'data:text/plain;base64,aGVsbG8=',
        })
      ).toThrow(/PNG data URL/);

      expect(() =>
        validateSignature({
          kind: 'drawn',
          value: valid1x1PngBase64, // missing data:image/png;base64, prefix
        })
      ).toThrow(/PNG data URL/);
    });

    it('rejects invalid PNG magic bytes', () => {
      // Fake PNG prefix but invalid body
      const fakePng = Buffer.from('NOTAPNGIMAGEHEADER').toString('base64');
      expect(() =>
        validateSignature({
          kind: 'drawn',
          value: `data:image/png;base64,${fakePng}`,
        })
      ).toThrow(/Invalid PNG header magic bytes/);
    });

    it('rejects oversized signatures exceeding 200 KB', () => {
      // Construct a buffer of (MAX_SIGNATURE_BYTES + 1) with PNG header
      const oversizedBuf = Buffer.alloc(MAX_SIGNATURE_BYTES + 10);
      oversizedBuf.set(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 0);
      const oversizedBase64 = oversizedBuf.toString('base64');

      expect(() =>
        validateSignature({
          kind: 'drawn',
          value: `data:image/png;base64,${oversizedBase64}`,
        })
      ).toThrow(/Signature size exceeds maximum limit of 200 KB/);
    });
  });

  describe('typed signatures', () => {
    it('validates valid typed names between 2 and 80 characters', () => {
      const names = ['Jane Doe', 'Somchai Jaidee', 'กข', 'A'.repeat(80)];
      for (const name of names) {
        const result = validateSignature({
          kind: 'typed',
          value: name,
        });
        expect(result.kind).toBe('typed');
        if (result.kind === 'typed') {
          expect(result.text).toBe(name);
          expect(result.contentType).toBe('text/plain');
          expect(result.buffer.toString('utf-8')).toBe(name);
        }
      }
    });

    it('rejects names shorter than 2 characters or longer than 80 characters', () => {
      expect(() =>
        validateSignature({
          kind: 'typed',
          value: 'A',
        })
      ).toThrow(/between 2 and 80 characters/);

      expect(() =>
        validateSignature({
          kind: 'typed',
          value: '   ',
        })
      ).toThrow();

      expect(() =>
        validateSignature({
          kind: 'typed',
          value: 'A'.repeat(81),
        })
      ).toThrow(/between 2 and 80 characters/);
    });

    it('rejects typed signatures containing control characters', () => {
      const badInputs = [
        'Jane\x00Doe',
        'Jane\nDoe',
        'Jane\rDoe',
        'Jane\tDoe',
        'Jane\x1fDoe',
        'Jane\x7fDoe',
      ];

      for (const bad of badInputs) {
        expect(() =>
          validateSignature({
            kind: 'typed',
            value: bad,
          })
        ).toThrow(/must not contain control characters/);
      }
    });
  });
});
