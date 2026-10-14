import { z } from "zod";

// Step 1: Branch Code + Honeypot
export const step1Schema = z.object({
  branchCode: z.string().min(1, "Branch code is required"),
  honeypot: z.string().optional(),
});

// Step 2: Details
export const step2Schema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
});

// Step 3: Consent + Signature
export const step3Schema = z.object({
  consent: z.boolean().refine(val => val === true, "Consent is required"),
  signature: z.object({
    type: z.enum(["drawn", "typed"]),
    value: z.string().min(1, "Signature is required"),
  }),
});

// Masked lookup result shape for client state
export type LookupResult =
  | { status: "found"; maskedDealer: string; maskedBranch: string }
  | { status: "notfound" };

// Logic: OTP Rules (pure functions)
export type OtpState = {
  attempts: number;
  sentAt: number | null;
  expiresAt: number | null;
  isVerified: boolean;
};

export const OTP_RULES = {
  MAX_ATTEMPTS: 3,
  EXPIRY_MS: 10 * 60 * 1000, // 10 minutes
  COOLDOWN_MS: 60 * 1000, // 1 minute
  MOCK_CODE: "123456",
};

export function canResendOtp(state: OtpState, now: number): boolean {
  if (!state.sentAt) return true;
  return now - state.sentAt >= OTP_RULES.COOLDOWN_MS;
}

export function sendOtp(now: number): OtpState {
  return {
    attempts: 0,
    sentAt: now,
    expiresAt: now + OTP_RULES.EXPIRY_MS,
    isVerified: false,
  };
}

export type VerifyOtpResult =
  | { success: true; newState: OtpState }
  | { success: false; reason: "expired" | "max_attempts" | "invalid"; newState: OtpState };

export function verifyOtp(state: OtpState, code: string, now: number): VerifyOtpResult {
  if (state.isVerified) return { success: true, newState: state };

  if (!state.expiresAt || now > state.expiresAt) {
    return { success: false, reason: "expired", newState: state };
  }

  if (state.attempts >= OTP_RULES.MAX_ATTEMPTS) {
    return { success: false, reason: "max_attempts", newState: state };
  }

  const newAttempts = state.attempts + 1;
  const newState = { ...state, attempts: newAttempts };

  if (code.trim() === OTP_RULES.MOCK_CODE) {
    newState.isVerified = true;
    return { success: true, newState };
  }

  return {
    success: false,
    reason: newAttempts >= OTP_RULES.MAX_ATTEMPTS ? "max_attempts" : "invalid",
    newState,
  };
}
