export function toggleSignatureMode(currentMode: "drawn" | "typed"): "drawn" | "typed" {
  return currentMode === "drawn" ? "typed" : "drawn";
}

export function getCountdownSeconds(sentAt: number | null | undefined, now: number, cooldownMs: number): number {
  if (!sentAt) return 0;
  const nextResend = sentAt + cooldownMs;
  if (now < nextResend) {
    return Math.ceil((nextResend - now) / 1000);
  }
  return 0;
}

export function getNextStep(currentStep: number, maxStep: number = 4): number {
  return currentStep < maxStep ? currentStep + 1 : maxStep;
}

export function getPreviousStep(currentStep: number, minStep: number = 1): number {
  return currentStep > minStep ? currentStep - 1 : minStep;
}
