import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sendOtpRecord } from '@/server/otp';
import { checkRateLimit, hashIdentifier, getClientIp } from '@/server/rate-limit';
import { logEvent } from '@/server/logger';

export const dynamic = 'force-dynamic';

const sendOtpRequestSchema = z.object({
  email: z.string().trim().email('Invalid email address'),
  honeypot: z.string().optional(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logEvent('otp_send_bad_request', 400);
    return NextResponse.json({ message: 'Invalid JSON request body' }, { status: 400 });
  }

  const parsed = sendOtpRequestSchema.safeParse(body);
  if (!parsed.success) {
    logEvent('otp_send_validation_failed', 400);
    return NextResponse.json({ message: 'Invalid email address' }, { status: 400 });
  }

  const { email, honeypot } = parsed.data;

  // Honeypot check
  if (honeypot && honeypot.trim().length > 0) {
    logEvent('otp_send_honeypot_rejected', 200);
    return NextResponse.json({ message: 'Verification code sent' }, { status: 200 });
  }

  // Rate limit
  const clientIp = getClientIp(req);
  const rateLimitKey = hashIdentifier(clientIp, 'otp_send');
  const rateResult = await checkRateLimit(rateLimitKey, {
    limit: 10,
    windowMs: 60_000,
  });

  if (!rateResult.allowed) {
    logEvent('otp_send_rate_limited', 429);
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

  const result = await sendOtpRecord(email);

  if (!result.success) {
    if (result.reason === 'cooldown') {
      logEvent('otp_send_cooldown', 429);
      return NextResponse.json(
        {
          message: 'Please wait before requesting another code.',
          retryAfterMs: result.retryAfterMs,
        },
        { status: 429 }
      );
    }
    if (result.reason === 'locked') {
      logEvent('otp_send_locked', 429);
      return NextResponse.json(
        { message: 'Too many attempts. Please try again later.' },
        { status: 429 }
      );
    }
    logEvent('otp_send_limit_reached', 400);
    return NextResponse.json(
      { message: 'Maximum resend limit reached. Please contact support.' },
      { status: 400 }
    );
  }

  logEvent('otp_send_success', 200);
  return NextResponse.json(
    { message: 'Verification code sent', cooldownSeconds: 60 },
    { status: 200 }
  );
}
