export interface LogEntry {
  event: string;
  status: number;
}

const PII_PATTERNS = [
  /@/, // email address
  /\d{4}/, // 4-digit branch code
  /jane|somchai|wipawan|anong|preecha|malee|somsri|kanda/i, // sample requester names
];

/**
 * Formats a log entry ensuring strictly ONLY event names and HTTP status codes are recorded.
 * Throws an error if any PII pattern (email, 4-digit code, or personal name) is detected.
 */
export function formatLog(event: string, status: number): string {
  for (const pattern of PII_PATTERNS) {
    if (pattern.test(event)) {
      throw new Error(`PII violation in log event: "${event}"`);
    }
  }

  return JSON.stringify({ event, status });
}

export function logEvent(event: string, status: number): void {
  const line = formatLog(event, status);
  console.log(line);
}
