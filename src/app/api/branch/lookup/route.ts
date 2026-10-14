import { NextResponse } from 'next/server';
import { lookupRequestSchema, lookupBranch } from '@/server/lookup';
import { checkRateLimit, hashIdentifier, getClientIp } from '@/server/rate-limit';
import { logEvent } from '@/server/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logEvent('branch_lookup_bad_request', 400);
    return NextResponse.json({ message: 'Invalid JSON request body' }, { status: 400 });
  }

  const parsed = lookupRequestSchema.safeParse(body);
  if (!parsed.success) {
    logEvent('branch_lookup_validation_failed', 400);
    return NextResponse.json(
      { message: 'Invalid branch code. Must be 4 digits.' },
      { status: 400 }
    );
  }

  const { branchCode, honeypot } = parsed.data;

  // Honeypot check: silently succeed-looking but rejected server-side without DB lookup
  if (honeypot && honeypot.trim().length > 0) {
    logEvent('branch_lookup_honeypot_rejected', 200);
    return NextResponse.json({ status: 'not_found' }, { status: 200 });
  }

  // Rate limiting check
  const clientIp = getClientIp(req);
  const rateLimitKey = hashIdentifier(clientIp, 'branch_lookup');
  const rateResult = await checkRateLimit(rateLimitKey, {
    limit: 10,
    windowMs: 60_000,
  });

  if (!rateResult.allowed) {
    logEvent('branch_lookup_rate_limited', 429);
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

  // Perform server-side lookup
  const result = await lookupBranch(branchCode);
  logEvent('branch_lookup_completed', 200);

  return NextResponse.json(result, { status: 200 });
}
