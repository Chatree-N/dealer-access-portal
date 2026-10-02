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
import { isDuplicateRequest } from "@/lib/schema";

export type FormInitialState = {
  step?: number;
  lookupState?: "idle" | "loading" | "found" | "notfound";
  branchData?: LookupResult | null;
  networkError?: string;
  form1?: { branchCode: string; honeypot: string };
  form2?: { firstName: string; lastName: string; email: string };
  form2Errors?: Record<string, string>;
  form2Touched?: Record<string, boolean>;
  otpState?: OtpState | null;
  otpInput?: string;
  otpError?: string;
  duplicateError?: string;
  sigType?: "drawn" | "typed";
  form3?: { consent: boolean; signature: { type: "drawn" | "typed"; value: string } };
  form3Errors?: Record<string, string>;
};

export default function Page() {
  return <RequestForm />;
}

export function RequestForm({ initialState = {} }: { initialState?: FormInitialState }) {
  const [step, setStep] = useState(initialState.step || 1);
  const headingRef = useRef<HTMLHeadingElement>(null);
  
  // Step 1 State
  const form1 = useForm({
    resolver: zodResolver(step1Schema),
    defaultValues: initialState.form1 || { branchCode: "", honeypot: "" }
  });
  const [lookupState, setLookupState] = useState<"idle" | "loading" | "found" | "notfound">(initialState.lookupState || "idle");
  const [branchData, setBranchData] = useState<LookupResult | null>(initialState.branchData || null);
  const [networkError, setNetworkError] = useState(initialState.networkError || "");

  // Step 2 State
  const form2 = useForm({
    resolver: zodResolver(step2Schema),
    defaultValues: initialState.form2 || { firstName: "", lastName: "", email: "" },
    mode: "onBlur"
  });
  // Inject initial errors for dev scenarios
  useEffect(() => {
    if (initialState.form2Errors) {
      Object.entries(initialState.form2Errors).forEach(([field, msg]) => {
        form2.setError(field as Parameters<typeof form2.setError>[0], { type: "manual", message: msg });
      });
    }
  }, [form2, initialState.form2Errors]);

  const [otpState, setOtpState] = useState<OtpState | null>(initialState.otpState || null);
  const [otpInput, setOtpInput] = useState(initialState.otpInput || "");
  const [otpError, setOtpError] = useState(initialState.otpError || "");
  const [duplicateError, setDuplicateError] = useState(initialState.duplicateError || "");
  const [timeRemaining, setTimeRemaining] = useState(0);

  const watchedEmail = useWatch({
    control: form2.control,
    name: "email",
    defaultValue: initialState.form2?.email || ""
  });

  // Step 3 State
  const form3 = useForm({
    resolver: zodResolver(step3Schema),
    defaultValues: initialState.form3 || { consent: false, signature: { type: initialState.sigType || "drawn", value: "" } }
  });
  useEffect(() => {
    if (initialState.form3Errors) {
      Object.entries(initialState.form3Errors).forEach(([field, msg]) => {
        form3.setError(field as Parameters<typeof form3.setError>[0], { type: "manual", message: msg });
      });
    }
  }, [form3, initialState.form3Errors]);
  const [sigType, setSigType] = useState<"drawn" | "typed">(initialState.sigType || "drawn");


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
      setReqId("#REQ-0001");
      setStep(4);
      return;
    }
    setLookupState("loading");
    setNetworkError("");
    
    // Simulate network delay
    await new Promise(r => setTimeout(r, 500));
    
    // Inject mock network error for testing if code is exactly 'error' (or via initial state we'll skip this)
    if (data.branchCode === "error") {
      setLookupState("idle");
      setNetworkError("Network error: Could not connect to the server.");
      return;
    }

    const result = lookupBranch(data.branchCode);
    setBranchData(result);
    setLookupState(result.status);
  });

  const triggerOtp = () => {
    if (isDuplicateRequest(watchedEmail)) {
      setDuplicateError(`A request for ${watchedEmail} is already pending approval.`);
      return;
    }
    setDuplicateError("");
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
    setReqId("#REQ-0042");
    setStep(4);
  });

  return (
    <main className="min-h-screen bg-[#F3F4F8] font-sans text-[#111827] flex justify-center md:p-10">
      <div className="w-full max-w-[1040px] bg-white border-0 md:border md:border-[#E5E7EB] md:rounded-[16px] overflow-hidden flex flex-col md:flex-row shadow-sm min-h-[100dvh] md:min-h-[600px]">
        {/* Sidebar */}
        <aside className="hidden md:flex flex-col w-[34%] bg-[#F7F8FA] border-r border-[#E5E7EB] py-10 px-8 gap-12">
          <div className="flex items-center gap-3">
            <div aria-hidden="true" className="w-10 h-10 rounded-[10px] bg-[#6D3FE0] flex-none flex items-center justify-center">
              <div className="w-[14px] h-[14px] rounded bg-white" />
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="font-bold text-[16px] text-[#0F1220]">Line OpenChat Access Request</div>
              <div className="text-[13px] text-[#6B7280]">For dealer branch coordinators</div>
            </div>
          </div>
          <Stepper currentStep={step} />
          
          <div className="mt-auto flex gap-2.5 text-[13px] leading-5 text-[#6B7280]">
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-[1px]">
              <path d="M12 3 4.5 6v5.5c0 4.6 3.2 8.3 7.5 9.5 4.3-1.2 7.5-4.9 7.5-9.5V6L12 3Z"></path>
              <path d="m9 12 2 2 4-4"></path>
            </svg>
            <span>Your details are used only to verify eligibility.</span>
          </div>
        </aside>
        
        {/* Mobile Stepper Header */}
        <div className="md:hidden">
          <Stepper currentStep={step} />
        </div>

        {/* Content */}
        <div className="flex-1 px-5 py-6 md:pt-7 md:px-14 md:pb-10 flex flex-col min-w-0">
          <div className="hidden md:flex justify-end items-center gap-1.5 text-[14px] text-[#6B7280] whitespace-nowrap">
            <span>Need help?</span>
            <a href="#" className="text-[#6D3FE0] font-semibold no-underline">Contact the team</a>
          </div>
          <div className="flex-1 flex flex-col gap-5 relative md:pt-7">
            {/* Step 1 */}
            {step === 1 && (
              <form onSubmit={handleStep1} className="flex-1 flex flex-col gap-6">
                <div className="flex flex-col gap-1.5">
                  <h1 ref={headingRef} tabIndex={-1} className="text-[22px] md:text-[28px] leading-[1.25] font-bold tracking-[-0.01em] text-[#0F1220] m-0 outline-none">Enter your branch code</h1>
                  <p className="m-0 text-[16px] leading-[24px] text-[#6B7280]">Used to verify your eligibility to join the Line OpenChat group.</p>
                </div>

                {networkError && (
                  <div role="alert" className="flex gap-3 items-start flex-wrap p-[14px_16px] rounded-xl bg-[#FEE2E2]">
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-[2px]"><path d="M2 8.5a15 15 0 0 1 20 0M5.5 12a10 10 0 0 1 13 0M9 15.5a5 5 0 0 1 6 0M12 19h.01"></path><path d="M3 3l18 18"></path></svg>
                    <div className="flex-1 min-w-[180px] flex flex-col gap-[2px] text-[15px] leading-[22px]">
                      <span className="font-bold text-[#0F1220]">Connection problem</span>
                      <span className="text-[#1F2937]">{networkError}</span>
                    </div>
                  </div>
                )}

                <div className="relative flex gap-3 p-4 rounded-xl bg-[#EDE9FE]">
                  <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6D3FE0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-[2px]">
                    <circle cx="12" cy="12" r="9.5"></circle><path d="M12 11v5.5M12 7.5h.01"></path>
                  </svg>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="text-[15px] font-bold text-[#4C1D95]">Note</div>
                    <div className="text-[15px] leading-[23px] text-[#2E1065] text-pretty">Use this form to request access to the Line OpenChat for announcements and team coordination. Your details are used only to verify eligibility under company policy.</div>
                  </div>
                </div>
                
                <input type="text" tabIndex={-1} aria-hidden="true" className="sr-only" {...form1.register("honeypot")} />
                
                <FloatField 
                  label="Branch code" 
                  required={true}
                  placeholder="e.g. 1234" 
                  icon="search"
                  mono
                  locked={lookupState === "found"}
                  success={lookupState === "found"}
                  error={form1.formState.errors.branchCode?.message}
                  {...form1.register("branchCode")}
                />
                
                <div aria-live="polite" aria-atomic="true" className="flex flex-col">
                  {lookupState === "notfound" && (
                    <div className="relative flex gap-3 p-[14px_16px] rounded-xl bg-[#FEE2E2]">
                      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-[2px]"><circle cx="12" cy="12" r="9.5"></circle><path d="M12 7.5v5.5M12 16.5h.01"></path></svg>
                      <div className="flex flex-col gap-[2px] min-w-0 text-[15px] leading-[22px] text-[#111827]">
                        <div className="font-bold">Branch not found</div>
                        <div>Sure the code is right? <a href="#" className="text-[#6D3FE0] font-semibold no-underline">Contact the team</a> to add your branch.</div>
                      </div>
                    </div>
                  )}
                  {lookupState === "found" && branchData?.status === "found" && (
                    <div role="status" className="relative flex gap-3 p-[14px_16px] rounded-xl bg-[#DCF5E7]">
                      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2E7D5B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-[2px]"><circle cx="12" cy="12" r="9.5"></circle><path d="m8 12.5 2.8 2.8L16 9.5"></path></svg>
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="text-[14px] font-bold text-[#1F5C42]">Branch found</div>
                        <div className="flex flex-wrap items-center gap-2 text-[16px] leading-[24px] font-semibold text-[#0F1220]">
                          <span>{branchData.dealerName}</span>
                          <span aria-hidden="true" className="text-[#6B7280] font-normal">/</span>
                          <span>{branchData.branchName}</span>
                        </div>
                        <div className="flex items-center gap-[6px] text-[13px] leading-[18px] text-[#1F5C42]">
                          <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>
                          <span>Names are partly hidden for privacy. Confirm this is your branch.</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-auto pt-10 flex items-center justify-end">
                  {networkError ? (
                    <Button type="submit" isLoading={lookupState === "loading"}>Retry</Button>
                  ) : lookupState === "found" ? (
                    <Button type="button" onClick={() => setStep(2)}>Continue</Button>
                  ) : (
                    <Button type="submit" isLoading={lookupState === "loading"}>Verify branch code</Button>
                  )}
                </div>
              </form>
            )}
            
            {/* Step 2 */}
            {step === 2 && (
              <form onSubmit={handleStep2} className="space-y-[28px] flex-1 flex flex-col">
                <div className="flex flex-col gap-[6px]">
                  <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-bold tracking-tight text-[#0F1220] outline-none">Your details</h1>
                  <p className="text-[#6B7280] text-[16px] leading-[24px]">Tell us who should receive the invite.</p>
                </div>

                <div className="flex flex-col gap-[10px]">
                  <div className="flex items-center justify-between gap-[12px] flex-wrap">
                    <h2 className="m-0 text-[14px] font-semibold text-[#4B5563]">Branch information</h2>
                    <button type="button" onClick={() => setStep(1)} className="inline-flex items-center gap-[6px] min-h-[36px] text-[14px] font-semibold text-[#6D3FE0] decoration-transparent whitespace-nowrap bg-transparent border-0 cursor-pointer">
                      <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4Z"></path><path d="m13.5 6.5 4 4"></path></svg>
                      <span>Change branch code</span>
                    </button>
                  </div>
                  <div className="relative bg-[#F3F4F6] border border-[#E5E7EB] rounded-[12px] p-[16px_20px] flex flex-col gap-[14px]">
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-[14px_24px]">
                      <div className="flex flex-col gap-[2px] min-w-0">
                        <span className="text-[13px] text-[#4B5563]">Dealer name</span>
                        <span className="text-[16px] leading-[24px] font-semibold text-[#111827]">{branchData?.status === "found" ? branchData.dealerName : ""}</span>
                      </div>
                      <div className="flex flex-col gap-[2px] min-w-0">
                        <span className="text-[13px] text-[#4B5563]">Branch code</span>
                        <span className="font-mono text-[15px] leading-[24px] font-semibold text-[#111827] tracking-[.04em]">{branchData?.status === "found" ? form1.getValues("branchCode") : ""}</span>
                      </div>
                      <div className="flex flex-col gap-[2px] min-w-0">
                        <span className="text-[13px] text-[#4B5563]">Branch name</span>
                        <span className="text-[16px] leading-[24px] font-semibold text-[#111827]">{branchData?.status === "found" ? branchData.branchName : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-[6px] text-[13px] text-[#4B5563] border-t border-[#E5E7EB] pt-[12px]">
                      <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>
                      <span>Auto-filled from your branch code</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-[20px]">
                  <h2 className="m-0 text-[14px] font-semibold text-[#4B5563]">Requester</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-[20px_16px]">
                    <FloatField label="First name" required={true} icon="user" error={form2.formState.errors.firstName?.message} {...form2.register("firstName")} />
                    <FloatField label="Last name" required={true} error={form2.formState.errors.lastName?.message} {...form2.register("lastName")} />
                  </div>

                  <FloatField 
                    label="Email address" 
                    required={true}
                    icon="mail"
                    error={form2.formState.errors.email?.message}
                    helper="We'll send the OpenChat invite link to this address. Use an email you check daily."
                    warning={branchData?.status === "found" && isDomainWarning(watchedEmail, branchData.dealerDomains) ? `This email isn't on ${branchData.dealerDomains[0]}, your dealer's domain. Approval may take longer.` : undefined}
                    {...form2.register("email")}
                  />
                </div>
                
                {/* OTP Section */}
                <div className="border-t border-[#E5E7EB] pt-6 space-y-4">
                  {duplicateError && (
                    <div role="alert" className="flex gap-[12px] p-[14px_16px] rounded-[12px] bg-[#FEE2E2]">
                      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B91C1C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-[2px]"><rect x="8" y="8" width="12" height="12" rx="2"></rect><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"></path></svg>
                      <div className="flex flex-col gap-[8px] min-w-0 text-[15px] leading-[22px] text-[#111827]">
                        <div className="font-bold">A request for this email is already pending</div>
                        <div>{duplicateError}</div>
                        <div className="flex flex-wrap gap-[8px_16px] items-center">
                          <button type="button" onClick={() => {
                            form2.setValue('email', '');
                            setDuplicateError("");
                          }} className="whitespace-nowrap min-h-[40px] px-[14px] rounded-[10px] border border-[#6D3FE0] bg-[#FFFFFF] text-[#6D3FE0] font-semibold cursor-pointer focus:outline-none focus:ring-2 focus:ring-[rgba(109,63,224,.3)] hover:bg-[#F5F3FF]">Use a different email</button>
                          <a href="#" className="text-[#6D3FE0] font-semibold text-[14px] whitespace-nowrap">Contact the team</a>
                        </div>
                      </div>
                    </div>
                  )}
                  {!otpState ? (
                    <Button type="button" variant="secondary" onClick={triggerOtp}>Verify email</Button>
                  ) : otpState.isVerified ? (
                    <div role="status" className="flex gap-[12px] p-[14px_16px] rounded-[12px] bg-[#DCF5E7]">
                      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2E7D5B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-[2px]"><circle cx="12" cy="12" r="9.5"></circle><path d="m8 12.5 2.8 2.8L16 9.5"></path></svg>
                      <div className="flex flex-col gap-[2px] text-[15px] leading-[22px]">
                        <span className="font-bold text-[#1F5C42]">Email verified</span>
                        <span className="text-[#1F2937]">Continue to consent and signature.</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-[24px]">
                      <div className="flex flex-col gap-[6px]">
                        <h2 className="m-0 text-[22px] md:text-[28px] leading-[1.25] font-bold text-[#0F1220] tracking-[-0.01em]">Verify your email</h2>
                        <p className="m-0 text-[16px] leading-[24px] text-[#6B7280] break-words">Enter the 6-digit code we sent to <span className="text-[#111827] font-semibold">{watchedEmail}</span>.</p>
                      </div>
                      <div className="relative max-w-[360px] flex gap-4 items-start">
                        <div className="flex-1">
                          <FloatField 
                            label="Verification code" 
                            required={true}
                            icon="key"
                            mono 
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            maxLength={6}
                            placeholder="e.g. 123456"
                            error={otpError}
                            helper={otpError ? undefined : "The code expires in 10 minutes. Check your spam folder if you can't find it."}
                            value={otpInput}
                            onChange={e => setOtpInput(e.target.value)}
                          />
                        </div>
                        <Button type="button" variant="secondary" onClick={handleVerifyOtp}>Verify code</Button>
                      </div>
                      <div aria-live="polite" className="flex items-center gap-[8px] flex-wrap text-[14px] leading-[20px] text-[#6B7280]">
                        {timeRemaining > 0 ? (
                          <span>Didn&apos;t get it? Resend code in <span className="font-mono text-[#111827] font-semibold">{Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, '0')}</span></span>
                        ) : (
                          <>
                            <span>Didn&apos;t get it?</span>
                            <button type="button" onClick={triggerOtp} className="whitespace-nowrap min-h-[36px] px-[10px] rounded-[8px] border-0 bg-transparent text-[#6D3FE0] font-[inherit] text-[14px] font-semibold cursor-pointer hover:bg-[#F5F3FF] focus:outline-none focus:ring-2 focus:ring-[rgba(109,63,224,.3)]">Send a new code</button>
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-[40px] flex items-center justify-between gap-[16px]">
                  <Button type="button" variant="secondary" onClick={() => setStep(1)} className="min-w-[112px]">Back</Button>
                  <Button type="submit" disabled={!otpState?.isVerified} className="min-w-[140px]">
                    {otpState?.isVerified ? "Continue" : "Next"}
                  </Button>
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
                  By proceeding, you consent to the collection and use of your personal data…
                </div>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="pt-0.5 flex-none">
                    <input type="checkbox" className="w-[22px] h-[22px] accent-[#6D3FE0] rounded cursor-pointer" {...form3.register("consent")} />
                  </div>
                  <span className="text-[15px] leading-[22px] text-[#4B5563]">
                    I have read and agree to the terms and conditions. <a href="#" className="text-[#6D3FE0] font-semibold hover:underline">[Legal to confirm] Privacy Policy</a>.
                  </span>
                </label>
                {form3.formState.errors.consent && (
                  <div className="text-[#B91C1C] text-sm flex gap-1 items-start">
                    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-[2px]"><circle cx="12" cy="12" r="9.5"></circle><path d="M12 7.5v5.5M12 16.5h.01"></path></svg>
                    <span><span className="font-semibold">Error: </span>{form3.formState.errors.consent.message}</span>
                  </div>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-[#374151] text-[13px] ml-[6px]">Signature<span aria-hidden="true" className="text-[#B91C1C] ml-[2px]">*</span></span>
                    <button type="button" className="text-[14px] font-semibold text-[#6D3FE0] hover:underline focus:outline-none focus:ring-2 focus:ring-[rgba(109,63,224,.3)] rounded px-1" onClick={() => {
                      const newMode = toggleSignatureMode(sigType);
                      setSigType(newMode);
                      form3.setValue("signature.value", "");
                      form3.setValue("signature.type", newMode);
                    }}>
                      {sigType === "drawn" ? "Type your name instead" : "Draw your signature instead"}
                    </button>
                  </div>
                  
                  {sigType === "drawn" ? (
                    <SignaturePad onChange={(data) => form3.setValue("signature.value", data || "")} />
                  ) : (
                    <FloatField label="Signature (typed)" required={true} icon="pen" {...form3.register("signature.value")} />
                  )}
                  {form3.formState.errors.signature?.value && (
                    <div className="text-[#B91C1C] text-sm flex gap-1 items-start">
                      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-none mt-[2px]"><circle cx="12" cy="12" r="9.5"></circle><path d="M12 7.5v5.5M12 16.5h.01"></path></svg>
                      <span><span className="font-semibold">Error: </span>{form3.formState.errors.signature.value.message}</span>
                    </div>
                  )}
                </div>

                <div className="mt-[40px] flex items-center justify-between gap-[16px]">
                  <Button type="button" variant="secondary" onClick={() => setStep(2)} className="min-w-[112px]">Back</Button>
                  <Button type="submit" className="min-w-[140px]">Submit request</Button>
                </div>
              </form>
            )}
            
            {/* Step 4 */}
            {step === 4 && (
              <div role="status" className="flex flex-col items-center text-center gap-[20px] pb-[24px] pt-[16px] flex-1">
                <div className="w-[72px] h-[72px] rounded-full bg-[#DCF5E7] flex items-center justify-center">
                  <svg aria-hidden="true" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#2E7D5B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg>
                </div>
                <h1 ref={headingRef} tabIndex={-1} className="m-0 text-2xl font-bold text-[#0F1220] leading-tight outline-none">Request submitted</h1>
                <div className="flex flex-wrap justify-center items-center gap-[8px]">
                  <span className="text-[14px] text-[#6B7280]">Request ID</span>
                  <span className="font-mono text-[14px] font-semibold px-[12px] py-[4px] rounded-full bg-[#F3F4F6] border border-[#E5E7EB] text-[#111827] whitespace-nowrap">{reqId}</span>
                  <span className="inline-flex items-center gap-[6px] text-[13px] font-semibold px-[12px] py-[5px] rounded-full bg-[#FEF3C7] text-[#92400E] whitespace-nowrap">
                    <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
                    <span>Pending review</span>
                  </span>
                </div>
                <p className="m-0 max-w-[440px] text-[16px] leading-[26px] text-[#374151] break-words">We&apos;ll review your details and email the Line OpenChat invite link to <span className="font-semibold text-[#111827]">{form2.getValues().email}</span>.</p>
                
                <ol aria-label="What happens next" className="list-none m-0 flex items-start justify-center w-full max-w-[440px] p-[20px_0_4px]">
                  <li className="w-[96px] flex-none flex flex-col items-center gap-[8px]">
                    <div className="w-[28px] h-[28px] rounded-full bg-[#DCF5E7] text-[#2E7D5B] flex items-center justify-center">
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg>
                    </div>
                    <span className="text-[14px] font-semibold text-[#111827]">Submitted</span>
                  </li>
                  <li aria-hidden="true" className="flex-1 h-[2px] bg-[#2E7D5B] mt-[13px] rounded-[2px]"></li>
                  <li aria-current="step" className="w-[96px] flex-none flex flex-col items-center gap-[8px]">
                    <div className="w-[28px] h-[28px] rounded-full bg-[#FEF3C7] text-[#B45309] flex items-center justify-center">
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path></svg>
                    </div>
                    <span className="text-[14px] font-semibold text-[#92400E]">Under review</span>
                  </li>
                  <li aria-hidden="true" className="flex-1 h-[2px] bg-[#E5E7EB] mt-[13px] rounded-[2px]"></li>
                  <li className="w-[96px] flex-none flex flex-col items-center gap-[8px]">
                    <div className="w-[28px] h-[28px] rounded-full bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center">
                      <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3.5 6.5 8.5 6 8.5-6"></path></svg>
                    </div>
                    <span className="text-[14px] font-medium text-[#4B5563]">Invite sent</span>
                  </li>
                </ol>
                <button type="button" onClick={() => window.location.reload()} className="whitespace-nowrap min-h-[44px] px-[16px] border-0 bg-transparent text-[#6D3FE0] font-semibold cursor-pointer rounded-[10px] hover:bg-[#F5F3FF] focus:outline-none focus:ring-2 focus:ring-[rgba(109,63,224,.3)] text-[15px]">Submit another request</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
