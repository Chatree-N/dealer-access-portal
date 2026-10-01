import * as React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "primary", isLoading, children, disabled, ...props }, ref) => {
    const baseStyles = "inline-flex items-center justify-center rounded-[10px] font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[48px] px-7 text-[16px]";
    
    const variants = {
      primary: "bg-[#6D3FE0] text-white hover:bg-[#5B2FCB] focus:ring-[rgba(109,63,224,.3)] shadow-[0_1px_2px_rgba(15,18,32,.08),_0_4px_12px_rgba(109,63,224,.22)]",
      secondary: "bg-white text-[#6D3FE0] border border-[#6D3FE0] hover:bg-[#F5F3FF] focus:ring-[rgba(109,63,224,.3)]",
      ghost: "bg-transparent text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#4B5563] focus:ring-[#E5E7EB]",
      danger: "bg-[#B91C1C] text-white hover:bg-[#991B1B] focus:ring-[rgba(185,28,28,.3)]",
    };

    const disabledStyles = "opacity-50 cursor-not-allowed shadow-none";

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variants[variant]} ${disabled || isLoading ? disabledStyles : ""} ${className}`}
        {...props}
      >
        {isLoading ? (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        ) : null}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
