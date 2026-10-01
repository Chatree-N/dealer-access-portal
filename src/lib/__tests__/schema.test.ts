import { describe, it, expect } from "vitest";
import { lookupBranch, isDomainWarning, OTP_RULES, sendOtp, verifyOtp, canResendOtp, step1Schema, step2Schema, step3Schema } from "../schema";

describe("Branch Lookup Logic", () => {
  it("returns found with masked values for valid branch 1234", () => {
    const result = lookupBranch("1234");
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.dealerDomains).toContain("lotustelecom.example");
      expect(result.dealerName).toBe("Lotus T…");
      expect(result.branchName).toBe("LOTUS C…");
    }
  });

  it("returns found with masked values for valid branch 5678", () => {
    const result = lookupBranch("5678");
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.dealerName).toBe("Harbor M…");
      expect(result.branchName).toBe("HARBOR W…");
    }
  });

  it("returns found with masked values for valid branch 0042", () => {
    const result = lookupBranch("0042");
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.branchName).toBe("LOTUS H…");
    }
  });

  it("returns found with masked values for long branch name 6001", () => {
    const result = lookupBranch("6001");
    expect(result.status).toBe("found");
    if (result.status === "found") {
      expect(result.branchName).toBe("ORCHID S…");
    }
  });

  it("returns notfound for inactive branch 9999", () => {
    expect(lookupBranch("9999").status).toBe("notfound");
  });

  it("returns notfound for empty, whitespace, or unknown branch", () => {
    expect(lookupBranch("").status).toBe("notfound");
    expect(lookupBranch("   ").status).toBe("notfound");
    expect(lookupBranch("9998").status).toBe("notfound");
    expect(lookupBranch("abcd").status).toBe("notfound");
  });
});

describe("Domain Warning Logic", () => {
  it("warns when domain does not match", () => {
    expect(isDomainWarning("test@mail.example", ["lotustelecom.example"])).toBe(true);
  });

  it("does not warn when domain matches exactly or with different case", () => {
    expect(isDomainWarning("test@lotustelecom.example", ["lotustelecom.example"])).toBe(false);
    expect(isDomainWarning("TEST@LOTUSTELECOM.EXAMPLE", ["lotustelecom.example"])).toBe(false);
  });
  
  it("does not warn for second domain (lotus-retail.example)", () => {
    expect(isDomainWarning("test@lotus-retail.example", ["lotustelecom.example", "lotus-retail.example"])).toBe(false);
  });
  
  it("does not warn when dealer has no domains (maple)", () => {
    expect(isDomainWarning("test@maple.example", [])).toBe(false);
  });

  it("handles invalid emails gracefully", () => {
    expect(isDomainWarning("invalidemail", ["lotustelecom.example"])).toBe(false);
    expect(isDomainWarning("", ["lotustelecom.example"])).toBe(false);
  });
});

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

describe("Zod Schemas", () => {
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
