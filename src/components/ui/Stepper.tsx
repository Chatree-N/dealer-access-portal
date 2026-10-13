import * as React from "react";

export interface StepperProps {
  currentStep: number;
}

const steps = [
  { num: 1, title: "Branch code", desc: "Verify your branch" },
  { num: 2, title: "Your details", desc: "Name and contact email" },
  { num: 3, title: "Consent & signature", desc: "Confirm and submit" },
];

export function Stepper({ currentStep }: StepperProps) {
  return (
    <div className="flex flex-col gap-6 p-6 min-w-[240px]">
      {steps.map((step) => {
        const isCompleted = step.num < currentStep;
        const isCurrent = step.num === currentStep;

        let circleColor = "bg-white border-[#E5E7EB] text-[#6B7280]";
        let textColor = "text-[#4B5563]";
        let descColor = "text-[#6B7280]";

        if (isCompleted) {
          circleColor = "bg-[#DCF5E7] border-[#DCF5E7] text-[#2E7D5B]";
          textColor = "text-[#0F1220]";
        } else if (isCurrent) {
          circleColor =
            "bg-white border-[#6D3FE0] text-[#6D3FE0] ring-4 ring-[rgba(109,63,224,.1)]";
          textColor = "text-[#6D3FE0] font-bold";
          descColor = "text-[#4B5563]";
        }

        return (
          <div key={step.num} className="flex gap-4 items-start relative">
            {/* Connector Line */}
            {step.num !== 3 && (
              <div
                className={`absolute top-8 left-3.5 w-0.5 h-10 ${
                  isCompleted ? "bg-[#6D3FE0]" : "bg-[#E5E7EB]"
                }`}
              />
            )}

            <div
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold z-10 ${circleColor}`}
            >
              {isCompleted ? (
                <svg
                  aria-hidden="true"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 12.5 4.5 4.5L19 7.5"></path>
                </svg>
              ) : (
                step.num
              )}
            </div>

            <div className="flex flex-col pt-1">
              <span className={`text-[15px] ${textColor}`}>{step.title}</span>
              <span className={`text-[13px] ${descColor}`}>{step.desc}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
