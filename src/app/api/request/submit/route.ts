import { NextResponse } from 'next/server';
import { submitInputSchema, submitRequest } from '@/server/submit';
import { checkRateLimit, hashIdentifier, getClientIp } from '@/server/rate-limit';
import { logEvent } from '@/server/logger';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    logEvent('submit_bad_json', 400);
    return NextResponse.json({ message: 'Invalid JSON request body' }, { status: 400 });
  }

  // Rate limiting check
  const clientIp = getClientIp(req);
  const rateLimitKey = hashIdentifier(clientIp, 'request_submit');
  const rateResult = await checkRateLimit(rateLimitKey, {
    limit: 10,
    windowMs: 60_000,
  });

  if (!rateResult.allowed) {
    logEvent('submit_rate_limited', 429);
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

  const parsed = submitInputSchema.safeParse(body);
  if (!parsed.success) {
    logEvent('submit_validation_failed', 400);
    return NextResponse.json({ message: 'Invalid submission data' }, { status: 400 });
  }

  const userAgent = req.headers.get('user-agent');
  const result = await submitRequest(parsed.data, clientIp, userAgent);

  if (!result.success) {
    logEvent(`submit_${result.reason}`, result.status);
    return NextResponse.json({ message: result.message }, { status: result.status });
  }

  logEvent('submit_success', 200);
  return NextResponse.json({ requestId: result.requestId }, { status: 200 });
}
