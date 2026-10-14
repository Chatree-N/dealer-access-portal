import { describe, it, expect } from "vitest";
import { 
  OTP_RULES, sendOtp, verifyOtp, canResendOtp, 
  step1Schema, step2Schema, step3Schema 
} from "../schema";

describe("OTP Logic", () => {
  it("generates a new state with expiry", () => {
    const now = 1000;
    const state = sendOtp(now);
    expect(state.attempts).toBe(0);
    expect(state.expiresAt).toBe(1000 + OTP_RULES.EXPIRY_MS);
    expect(state.isVerified).toBe(false);
  });

  it("prevents resend before cooldown", () => {
    const now = 1000;
    const state = sendOtp(now);
    expect(canResendOtp(state, now + 1000)).toBe(false);
    expect(canResendOtp(state, now + OTP_RULES.COOLDOWN_MS)).toBe(true);
  });

  it("verifies mock OTP correctly", () => {
    const now = 1000;
    const state = sendOtp(now);
    const result = verifyOtp(state, OTP_RULES.MOCK_CODE, now + 1000);
    expect(result.success).toBe(true);
    expect(result.newState.isVerified).toBe(true);
  });

  it("fails verification for wrong code and increments attempts", () => {
    const now = 1000;
    const state = sendOtp(now);
    const result = verifyOtp(state, "000000", now + 1000);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("invalid");
    }
    expect(result.newState.attempts).toBe(1);
  });

  it("fails verification if max attempts reached", () => {
    const now = 1000;
    let state = sendOtp(now);
    state = verifyOtp(state, "000000", now + 1000).newState;
    state = verifyOtp(state, "000000", now + 2000).newState;
    state = verifyOtp(state, "000000", now + 3000).newState;
    
    // 4th attempt
    const result = verifyOtp(state, OTP_RULES.MOCK_CODE, now + 4000);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("max_attempts");
    }
  });

  it("fails verification if expired", () => {
    const now = 1000;
    const state = sendOtp(now);
    const result = verifyOtp(state, OTP_RULES.MOCK_CODE, now + OTP_RULES.EXPIRY_MS + 1000);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.reason).toBe("expired");
    }
  });
});

describe("Client Zod Schemas", () => {
  it("validates step 1", () => {
    expect(step1Schema.safeParse({ branchCode: "1234" }).success).toBe(true);
    expect(step1Schema.safeParse({ branchCode: "" }).success).toBe(false);
    expect(step1Schema.safeParse({ branchCode: "1234", honeypot: "bot" }).success).toBe(true);
  });

  it("validates step 2", () => {
    expect(step2Schema.safeParse({ firstName: "A", lastName: "B", email: "a@b.com" }).success).toBe(true);
    expect(step2Schema.safeParse({ firstName: "", lastName: "B", email: "a@b.com" }).success).toBe(false);
  });

  it("validates step 3", () => {
    expect(step3Schema.safeParse({ consent: true, signature: { type: "typed", value: "Name" } }).success).toBe(true);
    expect(step3Schema.safeParse({ consent: false, signature: { type: "drawn", value: "data" } }).success).toBe(false);
  });
});
