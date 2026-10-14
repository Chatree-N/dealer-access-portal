import { describe, it, expect, vi } from "vitest";
import { formatLog, logEvent } from "@/server/logger";

describe("Sanitized Logging (Zero PII)", () => {
  it("formats log with strictly only event name and status code", () => {
    const raw = formatLog("branch_lookup_completed", 200);
    const parsed = JSON.parse(raw);
    expect(parsed).toEqual({
      event: "branch_lookup_completed",
      status: 200,
    });
    // Ensure no additional fields exist
    expect(Object.keys(parsed)).toEqual(["event", "status"]);
  });

  it("fails and throws if a log line contains a 4-digit branch code", () => {
    expect(() => formatLog("lookup_branch_1234_found", 200)).toThrow(/PII violation/);
    expect(() => formatLog("branch_0042_not_found", 404)).toThrow(/PII violation/);
    expect(() => formatLog("code_9999_inactive", 200)).toThrow(/PII violation/);
  });

  it("fails and throws if a log line contains an email address", () => {
    expect(() => formatLog("request_user@example.com_created", 200)).toThrow(/PII violation/);
    expect(() => formatLog("otp_sent_to_test@lotustelecom.example", 200)).toThrow(/PII violation/);
  });

  it("fails and throws if a log line contains a personal name", () => {
    expect(() => formatLog("request_from_jane_received", 200)).toThrow(/PII violation/);
    expect(() => formatLog("request_from_somchai_approved", 200)).toThrow(/PII violation/);
  });

  it("ensures console output from logEvent never contains branch code, email, or names", () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    logEvent("branch_lookup_rate_limited", 429);
    logEvent("checks_completed", 200);

    for (const call of consoleSpy.mock.calls) {
      const output = String(call[0]);
      expect(output).not.toMatch(/@/);
      expect(output).not.toMatch(/\b\d{4}\b/);
      expect(output).not.toMatch(/jane|somchai|wipawan/i);
    }

    consoleSpy.mockRestore();
  });
});
