import * as React from "react";

export interface StepperProps {
  currentStep: number;
}

const steps = [
  { num: 1, title: "Branch lookup", desc: "Find your dealer" },
  { num: 2, title: "Your details", desc: "Who should get the invite?" },
  { num: 3, title: "Consent", desc: "Terms & signature" },
];

export function Stepper({ currentStep }: StepperProps) {
  return (
    <>
      {/* Mobile Stepper (<900px) */}
      <div className="md:hidden flex items-center justify-between w-full bg-[#FAFAFB] border-b border-[#E5E7EB] px-4 py-3 sticky top-0 z-[5]">
        <div className="flex flex-col">
          <span className="text-[13px] text-[#4B5563] font-medium uppercase tracking-wider">
            {currentStep > 3 ? "Done" : `Step ${currentStep} of 3`}
          </span>
          <span className="text-[15px] font-bold text-[#0F1220]">
            {currentStep > 3 ? "Complete" : steps[currentStep - 1]?.title}
          </span>
        </div>
        {/* Progress bar visual */}
        <div className="flex gap-1">
          {steps.map((s) => (
            <div 
              key={s.num} 
              className={`h-1.5 rounded-full w-8 ${s.num <= currentStep ? "bg-[#6D3FE0]" : "bg-[#E5E7EB]"}`}
            />
          ))}
        </div>
      </div>

      {/* Desktop Stepper (>=900px) */}
      <div className="hidden md:flex flex-col gap-6 p-6 min-w-[240px]">
        {steps.map((step) => {
          const isCompleted = step.num < currentStep;
          const isCurrent = step.num === currentStep;
          
          let circleColor = "border-[#E5E7EB] text-[#6B7280]";
          let textColor = "text-[#4B5563]";
          let descColor = "text-[#6B7280]";

          if (isCompleted) {
            circleColor = "bg-[#2E7D5B] border-[#2E7D5B] text-white";
            textColor = "text-[#0F1220]";
          } else if (isCurrent) {
            circleColor = "border-[#6D3FE0] bg-white text-[#6D3FE0] ring-4 ring-[rgba(109,63,224,.1)]";
            textColor = "text-[#6D3FE0] font-bold";
            descColor = "text-[#4B5563]";
          }

          return (
            <div key={step.num} className="flex gap-4 items-start relative">
              {/* Connector Line */}
              {step.num !== 3 && (
                <div className={`absolute top-8 left-3.5 w-0.5 h-10 ${isCompleted ? "bg-[#2E7D5B]" : "bg-[#E5E7EB]"}`} />
              )}
              
              <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-bold z-10 bg-white ${circleColor}`}>
                {isCompleted ? "✓" : step.num}
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
