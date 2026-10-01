import { describe, it, expect } from "vitest";
import { toggleSignatureMode, getCountdownSeconds, getNextStep, getPreviousStep } from "../logic";

describe("toggleSignatureMode", () => {
  it("toggles drawn to typed", () => {
    expect(toggleSignatureMode("drawn")).toBe("typed");
  });
  it("toggles typed to drawn", () => {
    expect(toggleSignatureMode("typed")).toBe("drawn");
  });
});

describe("getCountdownSeconds", () => {
  const COOLDOWN_MS = 60000;
  it("returns 0 if not sent", () => {
    expect(getCountdownSeconds(undefined, Date.now(), COOLDOWN_MS)).toBe(0);
  });
  it("calculates remaining seconds", () => {
    const sentAt = 100000;
    const now = 130500; // 30.5 seconds passed
    // nextResend is 160000
    // remaining is 160000 - 130500 = 29500 ms -> 30 sec
    expect(getCountdownSeconds(sentAt, now, COOLDOWN_MS)).toBe(30);
  });
  it("returns 0 if time has passed", () => {
    const sentAt = 100000;
    const now = 160500; // 60.5 seconds passed
    expect(getCountdownSeconds(sentAt, now, COOLDOWN_MS)).toBe(0);
  });
});

describe("step transitions", () => {
  it("increments step safely", () => {
    expect(getNextStep(1)).toBe(2);
    expect(getNextStep(4)).toBe(4);
  });
  it("decrements step safely", () => {
    expect(getPreviousStep(2)).toBe(1);
    expect(getPreviousStep(1)).toBe(1);
  });
});
