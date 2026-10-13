"use client";

import { Button } from "@/components/ui/Button";
import { FloatField } from "@/components/ui/FloatField";
import { Stepper } from "@/components/ui/Stepper";
import { useState } from "react";

export default function DevComponentsPage() {
  const [step, setStep] = useState(1);
  const [value, setValue] = useState("");

  return (
    <main className="min-h-screen bg-[#F3F4F6] p-10 font-sans text-[#0F1220]">
      <div className="max-w-5xl mx-auto space-y-12">
        <div>
          <h1 className="text-3xl font-bold mb-2">Component Playground</h1>
          <p className="text-[#4B5563]">1440px desktop ready.</p>
        </div>

        {/* Buttons */}
        <section className="bg-white p-6 rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-[#E5E7EB]">
          <h2 className="text-xl font-bold mb-6 border-b border-[#E5E7EB] pb-2">Buttons</h2>
          <div className="flex flex-wrap gap-4 items-center">
            <Button variant="primary">Primary</Button>
            <Button variant="primary" isLoading>Loading</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button variant="primary" disabled>Disabled</Button>
          </div>
        </section>

        {/* FloatFields */}
        <section className="bg-white p-6 rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-[#E5E7EB]">
          <h2 className="text-xl font-bold mb-6 border-b border-[#E5E7EB] pb-2">Float Fields</h2>
          <div className="grid grid-cols-2 gap-6">
            <FloatField label="Default state" placeholder="e.g. 1234" />
            <FloatField label="Filled state" value="John Doe" onChange={() => {}} />
            <FloatField 
              label="Error state" 
              error="This field is required." 
              value="Invalid" 
              onChange={() => {}} 
            />
            <FloatField 
              label="Warning state" 
              warning="This email isn't on lotustelecom.example, your dealer's domain. Approval may take longer." 
              value="test@example.com" 
              onChange={() => {}} 
            />
            <FloatField 
              label="Success state" 
              success="Email verified" 
              value="verified@example.com" 
              onChange={() => {}} 
            />
            <FloatField 
              label="Loading state" 
              loading 
              value="Checking…" 
              onChange={() => {}} 
            />
            <FloatField 
              label="Locked state" 
              locked 
              value="Lotus Telecom" 
              onChange={() => {}} 
            />
            <FloatField 
              label="Select state" 
              options={["Option 1", "Option 2"]} 
            />
            <FloatField 
              label="Verification Code" 
              mono 
              placeholder="123456" 
              helper="We sent a code to your email." 
            />
            <FloatField 
              label="Interactive Test" 
              value={value} 
              onChange={(e) => setValue(e.target.value)} 
              helper="Type something to see the label float."
              icon="mail"
            />
          </div>
        </section>

        {/* Stepper */}
        <section className="bg-white p-6 rounded-[12px] shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-[#E5E7EB]">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2 mb-6">
            <h2 className="text-xl font-bold">Stepper</h2>
            <Button variant="secondary" onClick={() => setStep(s => s > 3 ? 1 : s + 1)}>
              Next Step
            </Button>
          </div>
          <div className="bg-[#FAFAFB] border border-[#E5E7EB] rounded-[16px] overflow-hidden">
            <Stepper currentStep={step} />
          </div>
        </section>
      </div>
    </main>
  );
}
