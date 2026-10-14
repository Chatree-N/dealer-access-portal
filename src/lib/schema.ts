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

// OTP Types and UI Constants
export type OtpState = {
  attempts: number;
  sentAt: number | null;
  expiresAt?: number | null;
  isVerified: boolean;
};

export const OTP_RULES = {
  MAX_ATTEMPTS: 3,
  EXPIRY_MS: 10 * 60 * 1000, // 10 minutes
  COOLDOWN_MS: 60 * 1000, // 1 minute
};

