import { NextResponse } from 'next/server';
import { checksRequestSchema, checkEmailDomain, checkDuplicateRequest } from '@/server/checks';
import { checkRateLimit, hashIdentifier, getClientIp } from '@/server/rate-limit';
import { logEvent } from '@/server/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logEvent('checks_bad_request', 400);
    return NextResponse.json({ message: 'Invalid JSON request body' }, { status: 400 });
  }

  const parsed = checksRequestSchema.safeParse(body);
  if (!parsed.success) {
    logEvent('checks_validation_failed', 400);
    return NextResponse.json(
      { message: 'Invalid branch code or email address' },
      { status: 400 }
    );
  }

  const { branchCode, email } = parsed.data;

  // Rate limiting check
  const clientIp = getClientIp(req);
  const rateLimitKey = hashIdentifier(clientIp, 'server_checks');
  const rateResult = await checkRateLimit(rateLimitKey, {
    limit: 20,
    windowMs: 60_000,
  });

  if (!rateResult.allowed) {
    logEvent('checks_rate_limited', 429);
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

  const [domainCheck, duplicateCheck] = await Promise.all([
    checkEmailDomain(branchCode, email),
    checkDuplicateRequest(branchCode, email),
  ]);

  logEvent('checks_completed', 200);

  return NextResponse.json(
    {
      isDomainMismatch: domainCheck.isDomainMismatch,
      isDuplicate: duplicateCheck.isDuplicate,
    },
    { status: 200 }
  );
}
