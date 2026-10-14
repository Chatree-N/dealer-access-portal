import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtpRecord } from '@/server/otp';
import { checkRateLimit, hashIdentifier, getClientIp } from '@/server/rate-limit';
import { logEvent } from '@/server/logger';

export const dynamic = 'force-dynamic';

const verifyOtpRequestSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  code: z.string().trim().regex(/^\d{6}$/, 'Code must be exactly 6 digits'),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logEvent('otp_verify_bad_request', 400);
    return NextResponse.json({ message: 'Invalid JSON request body' }, { status: 400 });
  }

  const parsed = verifyOtpRequestSchema.safeParse(body);
  if (!parsed.success) {
    logEvent('otp_verify_validation_failed', 400);
    return NextResponse.json({ message: 'Invalid verification code' }, { status: 400 });
  }

  const { email, code } = parsed.data;

  // Rate limit
  const clientIp = getClientIp(req);
  const rateLimitKey = hashIdentifier(clientIp, 'otp_verify');
  const rateResult = await checkRateLimit(rateLimitKey, {
    limit: 10,
    windowMs: 60_000,
  });

  if (!rateResult.allowed) {
    logEvent('otp_verify_rate_limited', 429);
    return NextResponse.json(
      { message: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateResult.retryAfter ?? 60),
        },
      }
    );
  }

  const result = await verifyOtpRecord(email, code);

  if (!result.success) {
    if (result.reason === 'invalid') {
      logEvent('otp_verify_invalid', 400);
      return NextResponse.json(
        {
          success: false,
          reason: 'invalid',
          message: "That code doesn't match.",
          remainingAttempts: result.remainingAttempts,
        },
        { status: 400 }
      );
    }

    if (result.reason === 'max_attempts' || result.reason === 'locked') {
      logEvent('otp_verify_locked', 403);
      return NextResponse.json(
        {
          success: false,
          reason: 'max_attempts',
          message: 'Expired or too many attempts.',
        },
        { status: 403 }
      );
    }

    logEvent('otp_verify_expired', 400);
    return NextResponse.json(
      {
        success: false,
        reason: 'expired',
        message: 'Expired or too many attempts.',
      },
      { status: 400 }
    );
  }

  logEvent('otp_verify_success', 200);
  return NextResponse.json(
    {
      success: true,
      proof: result.proof,
    },
    { status: 200 }
  );
}
