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
  const pctNum = currentStep >= 4 ? 100 : Math.round((currentStep / 3) * 100);

  return (
    <>
      {/* Mobile Stepper (<900px) */}
      <div className="md:hidden flex flex-col gap-2 w-full bg-white border-b border-[#E5E7EB] px-5 pb-3.5 pt-2 sticky top-0 z-[5]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div aria-hidden="true" className="w-7 h-7 rounded-lg bg-[#6D3FE0] flex-none flex items-center justify-center">
              <div className="w-2.5 h-2.5 rounded-[3px] bg-white" />
            </div>
            <span className="text-[15px] font-bold text-[#0F1220] whitespace-nowrap overflow-hidden text-ellipsis">Line OpenChat Access</span>
          </div>
          <a href="#" className="inline-flex items-center min-h-[44px] text-[14px] font-semibold text-[#6D3FE0] no-underline whitespace-nowrap">Contact the team</a>
        </div>
        <div className="relative flex flex-col gap-2">
          <div className="flex justify-between gap-3 text-[13px] leading-[18px]">
            <span className="text-[#6B7280] whitespace-nowrap">{currentStep >= 4 ? "Done" : `Step ${currentStep} of 3`}</span>
            <span className="font-semibold text-[#0F1220] text-right">{currentStep >= 4 ? "Request submitted" : (currentStep === 2 ? "Your details" : steps[currentStep - 1]?.title)}</span>
          </div>
          <div role="progressbar" aria-label="Progress" aria-valuenow={pctNum} aria-valuemin={0} aria-valuemax={100} className="h-1 rounded-full bg-[#EDE9FE] overflow-hidden">
            <div className="h-full bg-[#6D3FE0] rounded-full transition-all duration-300 ease-out" style={{ width: `${pctNum}%` }} />
          </div>
        </div>
      </div>

      {/* Desktop Stepper (>=900px) */}
      <div className="hidden md:flex flex-col gap-6 p-6 min-w-[240px]">
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
            circleColor = "bg-white border-[#6D3FE0] text-[#6D3FE0] ring-4 ring-[rgba(109,63,224,.1)]";
            textColor = "text-[#6D3FE0] font-bold";
            descColor = "text-[#4B5563]";
          }

          return (
            <div key={step.num} className="flex gap-4 items-start relative">
              {/* Connector Line */}
              {step.num !== 3 && (
                <div className={`absolute top-8 left-3.5 w-0.5 h-10 ${isCompleted ? "bg-[#6D3FE0]" : "bg-[#E5E7EB]"}`} />
              )}
              
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold z-10 ${circleColor}`}>
                {isCompleted ? (
                  <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"></path></svg>
                ) : step.num}
              </div>
              
              <div className="flex flex-col pt-1">
                <span className={`text-[15px] ${textColor}`}>{step.title}</span>
                <span className={`text-[13px] ${descColor}`}>{step.desc}</span>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
