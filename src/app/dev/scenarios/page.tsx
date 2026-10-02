import { notFound } from "next/navigation";
import { RequestForm, FormInitialState } from "../../page";
import { lookupBranch, sendOtp, verifyOtp, OTP_RULES } from "@/lib/schema";

export default async function ScenariosPage({ searchParams }: { searchParams: Promise<{ s?: string }> }) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const { s } = await searchParams;
  if (!s) {
    const ids = [
      "network", "errors", "domain", "dupe", "verify-sent", 
      "verify-wrong", "verify-ok", "typed-sig", "incomplete", "expired"
    ];
    return (
      <main className="p-10 font-sans max-w-lg mx-auto">
        <h1 className="text-2xl font-bold mb-6 text-[#0F1220]">Scenarios Gallery</h1>
        <ul className="space-y-3">
          {ids.map(id => (
            <li key={id}>
              <a href={`/dev/scenarios?s=${id}`} className="text-[#6D3FE0] hover:underline font-medium flex items-center justify-between">
                <span>{id}</span>
                <span className="text-[#4B5563] text-sm">→</span>
              </a>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  // Fixed deterministic time
  const now = 1700000000000;
  let initialState: FormInitialState = {};

  const defaultBranchData = lookupBranch("0042");

  if (s === "network") {
    initialState = {
      step: 1,
      form1: { branchCode: "0042", honeypot: "" },
      networkError: "Network error: Could not connect to the server."
    };
  } else if (s === "errors") {
    initialState = {
      step: 2,
      lookupState: "found",
      branchData: defaultBranchData.status === "found" ? defaultBranchData : null,
      form2Errors: {
        firstName: "First name is required",
        lastName: "Last name is required",
        email: "Invalid email address"
      }
    };
  } else if (s === "domain") {
    initialState = {
      step: 2,
      lookupState: "found",
      branchData: defaultBranchData.status === "found" ? defaultBranchData : null,
      form2: { firstName: "Jane", lastName: "Doe", email: "jane.doe@gmail.com" }
    };
  } else if (s === "dupe") {
    initialState = {
      step: 2,
      lookupState: "found",
      branchData: defaultBranchData.status === "found" ? defaultBranchData : null,
      form2: { firstName: "Jane", lastName: "Doe", email: "dupe@example.com" },
      duplicateError: "A request for dupe@example.com is already pending approval."
    };
  } else if (s === "verify-sent") {
    initialState = {
      step: 2,
      lookupState: "found",
      branchData: defaultBranchData.status === "found" ? defaultBranchData : null,
      form2: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
      otpState: sendOtp(now)
    };
  } else if (s === "verify-wrong") {
    const otpStart = sendOtp(now);
    const verRes = verifyOtp(otpStart, "000000", now);
    initialState = {
      step: 2,
      lookupState: "found",
      branchData: defaultBranchData.status === "found" ? defaultBranchData : null,
      form2: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
      otpState: verRes.newState,
      otpInput: "000000",
      otpError: "That code doesn't match."
    };
  } else if (s === "verify-ok") {
    initialState = {
      step: 2,
      lookupState: "found",
      branchData: defaultBranchData.status === "found" ? defaultBranchData : null,
      form2: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
      otpState: { attempts: 1, sentAt: now - 30000, expiresAt: now + OTP_RULES.EXPIRY_MS, isVerified: true }
    };
  } else if (s === "typed-sig") {
    initialState = {
      step: 3,
      sigType: "typed",
      form3: { consent: false, signature: { type: "typed", value: "Jane Doe" } }
    };
  } else if (s === "incomplete") {
    initialState = {
      step: 3,
      form3Errors: {
        consent: "Consent is required",
        "signature.value": "Signature is required"
      }
    };
  } else if (s === "expired") {
    const expiredState = {
      attempts: 0,
      sentAt: now - OTP_RULES.EXPIRY_MS - 1000,
      expiresAt: now - 1000,
      isVerified: false
    };
    initialState = {
      step: 2,
      lookupState: "found",
      branchData: defaultBranchData.status === "found" ? defaultBranchData : null,
      form2: { firstName: "Jane", lastName: "Doe", email: "jane@example.com" },
      otpState: expiredState,
      otpError: "Expired or too many attempts."
    };
  }

  return <RequestForm initialState={initialState} />;
}
