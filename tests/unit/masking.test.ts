import { describe, it, expect } from "vitest";
import { maskName, branchCodeSchema, lookupRequestSchema } from "@/server/lookup";
import { checksRequestSchema } from "@/server/checks";

describe("Masking Rules", () => {
  it("masks dealer name correctly: first word + space + first letter of second word + …", () => {
    expect(maskName("Lotus Telecom", false)).toBe("Lotus T…");
    expect(maskName("Harbor Motor Sales", false)).toBe("Harbor M…");
    expect(maskName("Apex Auto Group", false)).toBe("Apex A…");
  });

  it("masks branch name with uppercase flag", () => {
    expect(maskName("Lotus Central Nakhonsawan", true)).toBe("LOTUS C…");
    expect(maskName("Harbor West Sathon", true)).toBe("HARBOR W…");
    expect(maskName("Lotus Hub (Riverside)", true)).toBe("LOTUS H…");
    expect(maskName("Orchid South Phuket Very Long Branch Name", true)).toBe("ORCHID S…");
  });

  it("handles single-word names gracefully", () => {
    expect(maskName("Lotus", false)).toBe("Lotus…");
    expect(maskName("Lotus", true)).toBe("LOTUS…");
    expect(maskName("Apex", false)).toBe("Apex…");
  });

  it("handles whitespace variations cleanly", () => {
    expect(maskName("  Lotus    Telecom  ", false)).toBe("Lotus T…");
  });
});

describe("Server Zod Schemas", () => {
  describe("branchCodeSchema (4 digits)", () => {
    it("accepts valid 4-digit codes including leading zeros", () => {
      expect(branchCodeSchema.safeParse("1234").success).toBe(true);
      expect(branchCodeSchema.safeParse("0042").success).toBe(true);
      expect(branchCodeSchema.safeParse("9999").success).toBe(true);
      expect(branchCodeSchema.safeParse("0000").success).toBe(true);
    });

    it("rejects non-4-digit codes", () => {
      expect(branchCodeSchema.safeParse("").success).toBe(false);
      expect(branchCodeSchema.safeParse("123").success).toBe(false);
      expect(branchCodeSchema.safeParse("12345").success).toBe(false);
      expect(branchCodeSchema.safeParse("abcd").success).toBe(false);
      expect(branchCodeSchema.safeParse("12a4").success).toBe(false);
    });
  });

  describe("lookupRequestSchema", () => {
    it("accepts payload with 4-digit branchCode and optional honeypot", () => {
      expect(lookupRequestSchema.safeParse({ branchCode: "1234" }).success).toBe(true);
      expect(lookupRequestSchema.safeParse({ branchCode: "1234", honeypot: "" }).success).toBe(true);
      expect(lookupRequestSchema.safeParse({ branchCode: "1234", honeypot: "bot-trap" }).success).toBe(true);
    });

    it("rejects payload missing or invalid branchCode", () => {
      expect(lookupRequestSchema.safeParse({}).success).toBe(false);
      expect(lookupRequestSchema.safeParse({ branchCode: "99" }).success).toBe(false);
    });
  });

  describe("checksRequestSchema", () => {
    it("accepts valid branchCode and email", () => {
      expect(
        checksRequestSchema.safeParse({ branchCode: "1234", email: "user@lotustelecom.example" }).success
      ).toBe(true);
    });

    it("rejects invalid email or branchCode", () => {
      expect(
        checksRequestSchema.safeParse({ branchCode: "1234", email: "notanemail" }).success
      ).toBe(false);
      expect(
        checksRequestSchema.safeParse({ branchCode: "12", email: "user@example.com" }).success
      ).toBe(false);
    });
  });
});
