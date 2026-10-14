import { describe, it, expect } from "vitest";
import { 
  step1Schema, step2Schema, step3Schema 
} from "../schema";

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
