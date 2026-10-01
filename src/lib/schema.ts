import { z } from "zod";
import { BRANCHES, DEALERS } from "../../fixtures/branches";

// Step 1: Branch Code + Honeypot
export const step1Schema = z.object({
  branchCode: z.string().min(1, "Branch code is required"),
  honeypot: z.string().max(0, "").optional(),
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

// Logic: Branch Lookup
export type LookupResult = 
  | { status: "found"; dealerName: string; dealerDomains: string[]; branchName: string }
  | { status: "notfound" };

export function lookupBranch(code: string): LookupResult {
  const trimmed = code.trim();
  if (!trimmed) return { status: "notfound" };

  const branch = BRANCHES.find(b => b.code === trimmed);
  if (!branch || branch.status === "inactive") {
    return { status: "notfound" };
  }

  const dealer = DEALERS.find(d => d.id === branch.dealerId);
  if (!dealer) {
    return { status: "notfound" };
  }

  // Masking rule: First word + space + first letter of the next word + "…"
  const applyMask = (text: string, uppercase: boolean) => {
    const parts = text.split(/\s+/);
    const firstWord = parts[0] || "";
    const secondLetter = parts[1] ? parts[1][0] : "";
    const result = secondLetter ? `${firstWord} ${secondLetter}…` : `${firstWord}…`;
    return uppercase ? result.toUpperCase() : result;
  };

  return {
    status: "found",
    dealerName: applyMask(dealer.name, false),
    dealerDomains: dealer.emailDomains,
    branchName: applyMask(branch.name, true),
  };
}

// Logic: Domain Warning
export function isDomainWarning(email: string, dealerDomains: string[]): boolean {
  if (!email || !email.includes("@")) return false;
  if (!dealerDomains || dealerDomains.length === 0) return false;
  
  const parts = email.toLowerCase().split("@");
  if (parts.length < 2) return false;
  const emailDomain = parts[1];

  return !dealerDomains.some(domain => domain.toLowerCase() === emailDomain);
}

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
    newState 
  };
}
