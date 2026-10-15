import 'server-only';
import { z } from 'zod';

export const MAX_SIGNATURE_BYTES = 200 * 1024; // 200 KB
export const PNG_MAGIC_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const CONTROL_CHARS_REGEX = /[\x00-\x1F\x7F]/;

export interface ValidatedDrawnSignature {
  kind: 'drawn';
  buffer: Buffer;
  contentType: 'image/png';
}

export interface ValidatedTypedSignature {
  kind: 'typed';
  text: string;
  buffer: Buffer;
  contentType: 'text/plain';
}

export type ValidatedSignature = ValidatedDrawnSignature | ValidatedTypedSignature;

export const signatureInputSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('drawn'),
    value: z.string().min(1, 'Signature value is required'),
  }),
  z.object({
    kind: z.literal('typed'),
    value: z.string().min(1, 'Signature value is required'),
  }),
]);

export type SignatureInput = z.infer<typeof signatureInputSchema>;

/**
 * Validates drawn or typed signature according to security constraints:
 * - Drawn: must be data:image/png;base64, valid PNG magic bytes, decoded size <= 200 KB.
 * - Typed: 2 to 80 chars, no control characters.
 */
export function validateSignature(input: unknown): ValidatedSignature {
  const parsed = signatureInputSchema.parse(input);

  if (parsed.kind === 'drawn') {
    const raw = parsed.value.trim();
    if (!raw.startsWith('data:image/png;base64,')) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Drawn signature must be a PNG data URL (data:image/png;base64,...)',
        },
      ]);
    }

    const base64Part = raw.slice('data:image/png;base64,'.length);
    if (!base64Part) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Empty base64 data in signature',
        },
      ]);
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(base64Part, 'base64');
    } catch {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Invalid base64 encoding in signature',
        },
      ]);
    }

    if (buffer.length > MAX_SIGNATURE_BYTES) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: `Signature size exceeds maximum limit of 200 KB (${buffer.length} bytes)`,
        },
      ]);
    }

    if (buffer.length < PNG_MAGIC_BYTES.length || !buffer.subarray(0, 8).equals(PNG_MAGIC_BYTES)) {
      throw new z.ZodError([
        {
          code: z.ZodIssueCode.custom,
          path: ['value'],
          message: 'Invalid PNG header magic bytes',
        },
      ]);
    }

    return {
      kind: 'drawn',
      buffer,
      contentType: 'image/png',
    };
  }

  // Typed signature
  const trimmed = parsed.value.trim();
  if (trimmed.length < 2 || trimmed.length > 80) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Typed signature must be between 2 and 80 characters',
      },
    ]);
  }

  if (CONTROL_CHARS_REGEX.test(trimmed)) {
    throw new z.ZodError([
      {
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: 'Typed signature must not contain control characters',
      },
    ]);
  }

  return {
    kind: 'typed',
    text: trimmed,
    buffer: Buffer.from(trimmed, 'utf-8'),
    contentType: 'text/plain',
  };
}
