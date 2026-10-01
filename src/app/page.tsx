"use client";

import { useState, useRef, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/Button";
import { FloatField } from "@/components/ui/FloatField";
import { Stepper } from "@/components/ui/Stepper";
import { SignaturePad } from "@/components/ui/SignaturePad";
import { 
  lookupBranch, isDomainWarning, sendOtp, verifyOtp,
  step1Schema, step2Schema, step3Schema, LookupResult, OtpState, OTP_RULES 
} from "@/lib/schema";
import { toggleSignatureMode, getCountdownSeconds } from "@/lib/logic";

export default function RequestForm() {
  const [step, setStep] = useState(1);
  const headingRef = useRef<HTMLHeadingElement>(null);
  
  // Step 1 State
  const form1 = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: { branchCode: "", honeypot: "" }
  });
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "notfound">("idle");
  const [branchData, setBranchData] = useState<LookupResult | null>(null);

  // Step 2 State
  const form2 = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: { firstName: "", lastName: "", email: "" },
    mode: "onBlur"
  });
  const [otpState, setOtpState] = useState<OtpState | null>(null);
  const [otpInput, setOtpInput] = useState("");
  const [otpError, setOtpError] = useState("");
  const [timeRemaining, setTimeRemaining] = useState(0);

  const watchedEmail = useWatch({
    control: form2.control,
    name: "email",
    defaultValue: ""
  });

  // Step 3 State
  const form3 = useForm({
    resolver: zodResolver(step3Schema),
    defaultValues: { consent: false, signature: { type: "drawn" as "drawn"|"typed", value: "" } }
  });
  const [sigType, setSigType] = useState<"drawn" | "typed">("drawn");

  // Step 4 State
  const [reqId, setReqId] = useState("");

  useEffect(() => {
    if (headingRef.current) headingRef.current.focus();
  }, [step]);

  useEffect(() => {
    if (!otpState?.sentAt || otpState.isVerified) return;
    const interval = setInterval(() => {
      setTimeRemaining(getCountdownSeconds(otpState.sentAt, Date.now(), OTP_RULES.COOLDOWN_MS));
    }, 1000);
    return () => clearInterval(interval);
  }, [otpState]);

  // Actions
  const handleStep1 = form1.handleSubmit(async (data) => {
    if (data.honeypot) {
      setReqId("REQ-0001");
      setStep(4);
      return;
    }
    setLookupState("loading");
    // Simulate network delay
    await new Promise(r => setTimeout(r, 500));
    
    const result = lookupBranch(data.branchCode);
    setBranchData(result);
    setLookupState(result.status);
  });

  const triggerOtp = () => {
    setOtpState(sendOtp(Date.now()));
    setOtpError("");
    setOtpInput("");
  };

  const handleVerifyOtp = () => {
    if (!otpState) return;
    const res = verifyOtp(otpState, otpInput, Date.now());
    setOtpState(res.newState);
    if (!res.success) {
      setOtpError(res.reason === "invalid" ? "That code doesn't match." : "Expired or too many attempts.");
    } else {
      setOtpError("");
    }
  };

  const handleStep2 = form2.handleSubmit(() => {
    setStep(3);
  });

  const handleStep3 = form3.handleSubmit(() => {
    setReqId("REQ-0042");
    setStep(4);
  });

  return (
    <main className="min-h-screen bg-[#F3F4F8] font-sans text-[#111827] flex justify-center md:p-10">
      <div className="w-full max-w-[1040px] bg-white border-0 md:border md:border-[#E5E7EB] md:rounded-[16px] overflow-hidden flex flex-col md:flex-row shadow-sm min-h-[100dvh] md:min-h-[600px]">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-[34%] bg-[#F7F8FA] border-r border-[#E5E7EB] p-10 gap-12">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6D3FE0] flex items-center justify-center">
              <div className="w-3.5 h-3.5 bg-white rounded flex-none" />
            </div>
            <div>
              <div className="font-bold text-[16px] text-[#0F1220]">Line OpenChat Access Request</div>
              <div className="text-[13px] text-[#4B5563]">For dealer branch coordinators</div>
            </div>
          </div>
          <Stepper currentStep={step} />
        </aside>
        
        {/* Mobile Stepper Header */}
        <div className="md:hidden">
          <Stepper currentStep={step} />
        </div>

        {/* Content */}
        <div className="flex-1 p-6 md:p-10 flex flex-col">
          <div className="flex-1 flex flex-col gap-6 relative">
            {/* Step 1 */}
            {step === 1 && (
              <form onSubmit={handleStep1} className="space-y-6 flex-1 flex flex-col">
                <div>
                  <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold tracking-tight text-[#0F1220] outline-none">Enter your branch code</h1>
                  <p className="text-[#4B5563] mt-1">Used to verify your eligibility to join the Line OpenChat group.</p>
                </div>
                
                <input type="text" tabIndex={-1} aria-hidden="true" className="sr-only" {...form1.register("honeypot")} />
                
                <FloatField 
                  label="Branch code" 
                  placeholder="e.g. 1234" 
                  icon="search"
                  mono
                  locked={lookupState === "found"}
                  error={form1.formState.errors.branchCode?.message}
                  {...form1.register("branchCode")}
                />
                
                <div aria-live="polite">
                  {lookupState === "loading" && <div className="text-[#4B5563]">Verifying…</div>}
                  {lookupState === "notfound" && <div className="text-[#B91C1C]">Error: We couldn&apos;t find a branch with that code.</div>}
                  {lookupState === "found" && branchData?.status === "found" && (
                    <div className="bg-[#FAFAFB] border border-[#E5E7EB] p-4 rounded-[12px] flex flex-col gap-1">
                      <span className="text-[13px] text-[#4B5563]">Branch found</span>
                      <span className="text-[15px] font-semibold text-[#0F1220]">{branchData.dealerName} / {branchData.branchName}</span>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-10 flex items-center justify-end">
                  {lookupState === "found" ? (
                    <Button type="button" onClick={() => setStep(2)}>Continue</Button>
                  ) : (
                    <Button type="submit" isLoading={lookupState === "loading"}>Verify branch code</Button>
                  )}
                </div>
              </form>
            )}
            
            {/* Step 2 */}
            {step === 2 && (
              <form onSubmit={handleStep2} className="space-y-6 flex-1 flex flex-col">
                <div>
                  <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold tracking-tight text-[#0F1220] outline-none">Your details</h1>
                  <p className="text-[#4B5563] mt-1">Tell us who should receive the invite.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FloatField label="First name" error={form2.formState.errors.firstName?.message} {...form2.register("firstName")} />
                  <FloatField label="Last name" error={form2.formState.errors.lastName?.message} {...form2.register("lastName")} />
                </div>

                <FloatField 
                  label="Email address" 
                  icon="mail"
                  error={form2.formState.errors.email?.message}
                  warning={branchData?.status === "found" && isDomainWarning(watchedEmail, branchData.dealerDomains) ? `This email isn't on ${branchData.dealerDomains[0]}, your dealer's domain. Approval may take longer.` : undefined}
                  {...form2.register("email")}
                />
                
                {/* OTP Section */}
                <div className="border-t border-[#E5E7EB] pt-6 space-y-4">
                  {!otpState ? (
                    <Button type="button" variant="secondary" onClick={triggerOtp}>Verify email</Button>
                  ) : otpState.isVerified ? (
                    <div className="bg-[#DCF5E7] text-[#2E7D5B] p-4 rounded-[12px] font-medium flex items-center gap-2">
                      <span>✓</span> Email verified
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <h2 className="text-lg font-bold">Verify your email</h2>
                        <p className="text-[#4B5563] text-sm">Enter the 6-digit code we sent to {watchedEmail}</p>
                      </div>
                      <div className="flex gap-4 items-start">
                        <div className="flex-1">
                          <FloatField 
                            label="Verification code" 
                            mono 
                            error={otpError}
                            value={otpInput}
                            onChange={e => setOtpInput(e.target.value)}
                          />
                        </div>
                        <Button type="button" variant="secondary" onClick={handleVerifyOtp}>Verify code</Button>
                      </div>
                      <Button type="button" variant="ghost" disabled={timeRemaining > 0} onClick={triggerOtp}>
                        {timeRemaining > 0 ? `Resend code in ${timeRemaining}s` : "Resend code"}
                      </Button>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-10 flex items-center justify-between">
                  <Button type="button" variant="secondary" onClick={() => setStep(1)}>Back</Button>
                  <Button type="submit" disabled={!otpState?.isVerified}>Continue</Button>
                </div>
              </form>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <form onSubmit={handleStep3} className="space-y-6 flex-1 flex flex-col">
                <div>
                  <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold tracking-tight text-[#0F1220] outline-none">Consent & signature</h1>
                  <p className="text-[#4B5563] mt-1">Review the terms, confirm, and sign to submit.</p>
                </div>

                <div className="bg-[#FAFAFB] border border-[#E5E7EB] p-4 rounded-[12px] h-[150px] overflow-y-auto text-sm text-[#4B5563]">
                  v0-draft [Legal to confirm]<br/><br/>
                  By proceeding, you consent to the collection and use of your personal data...
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input type="checkbox" className="mt-1 w-4 h-4" {...form3.register("consent")} />
                  <span className="text-[15px] font-medium">I have read and agree to the terms and conditions.</span>
                </label>
                {form3.formState.errors.consent && <div className="text-[#B91C1C] text-sm">{form3.formState.errors.consent.message}</div>}

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Signature</span>
                    <Button type="button" variant="ghost" onClick={() => {
                      const newMode = toggleSignatureMode(sigType);
                      setSigType(newMode);
                      form3.setValue("signature.value", "");
                      form3.setValue("signature.type", newMode);
                    }}>
                      {sigType === "drawn" ? "Type your name instead" : "Draw your signature instead"}
                    </Button>
                  </div>
                  
                  {sigType === "drawn" ? (
                    <SignaturePad onChange={(data) => form3.setValue("signature.value", data || "")} />
                  ) : (
                    <FloatField label="Signature (typed)" icon="pen" {...form3.register("signature.value")} />
                  )}
                  {form3.formState.errors.signature?.value && <div className="text-[#B91C1C] text-sm">{form3.formState.errors.signature.value.message}</div>}
                </div>

                <div className="mt-auto pt-10 flex items-center justify-between">
                  <Button type="button" variant="secondary" onClick={() => setStep(2)}>Back</Button>
                  <Button type="submit">Submit request</Button>
                </div>
              </form>
            )}
            
            {/* Step 4 */}
            {step === 4 && (
              <div className="flex flex-col items-center justify-center text-center space-y-4 pt-10 flex-1">
                <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold text-[#0F1220] outline-none">Request submitted</h1>
                <p className="text-[#4B5563] max-w-md">We&apos;ll review your details and email the Line OpenChat invite link to {form2.getValues().email}.</p>
                <div className="bg-[#FAFAFB] px-4 py-2 rounded-lg text-sm text-[#6B7280]">
                  Request ID: <span className="font-mono font-medium">{reqId}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
