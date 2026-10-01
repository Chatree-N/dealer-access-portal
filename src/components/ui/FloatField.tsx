import * as React from "react";

export interface FloatFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helper?: string;
  error?: string;
  warning?: string;
  success?: string;
  locked?: boolean;
  loading?: boolean;
  forceFocus?: boolean;
  mono?: boolean;
  icon?: "search" | "user" | "mail" | "key" | "pen" | "calendar";
  options?: string[]; // If options are provided, it acts like a select
}

export const FloatField = React.forwardRef<HTMLInputElement, FloatFieldProps>(
  (
    {
      label,
      required,
      placeholder,
      helper,
      error,
      warning,
      success,
      locked,
      disabled,
      loading,
      forceFocus,
      mono,
      icon,
      options,
      className = "",
      id,
      value,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId();
    const inputId = id || generatedId;
    const [isFocused, setIsFocused] = React.useState(forceFocus || false);
    
    // Controlled or uncontrolled value state to handle floating label
    const hasValue = value !== undefined && value !== "";

    const isError = !!error;
    const isWarning = !!warning && !isError;
    const isSuccess = !!success && !isError && !isWarning;
    
    let borderColor = "border-[#E5E7EB]";
    let ringColor = "focus-within:ring-[rgba(109,63,224,.3)]";
    if (isError) {
      borderColor = "border-[#DC3E3E]";
      ringColor = "focus-within:ring-[rgba(220,62,62,.3)]";
    } else if (isWarning) {
      borderColor = "border-[#B45309]";
      ringColor = "focus-within:ring-[#FEF3C7]";
    } else if (isSuccess) {
      borderColor = "border-[#2E7D5B]";
      ringColor = "focus-within:ring-[#DCF5E7]";
    } else if (isFocused) {
      borderColor = "border-[#6D3FE0]";
    }

    const bgClass = locked || disabled ? "bg-[#F7F8FA] text-[#6B7280]" : "bg-white";
    const monoClass = mono ? "font-mono tracking-widest text-lg text-center" : "";
    const activeLabel = isFocused || hasValue || !!placeholder || !!options;

    return (
      <div className={`relative flex flex-col gap-1 w-full ${className}`}>
        <div 
          className={`relative flex items-center border ${borderColor} rounded-[10px] ${bgClass} transition-all focus-within:ring-2 ${ringColor}`}
        >
          {icon && (
            <div className="pl-3 flex items-center justify-center text-[#9CA3AF]">
              {/* Dummy icon placeholder */}
              <span className="w-5 h-5 flex items-center justify-center">
                {icon === "mail" && "@"}
                {icon === "search" && "Q"}
                {icon === "user" && "U"}
                {icon === "key" && "*"}
              </span>
            </div>
          )}

          <div className="relative w-full flex-1">
            <label
              htmlFor={inputId}
              className={`absolute left-3 transition-all duration-200 pointer-events-none z-10 
                ${activeLabel 
                  ? "top-1 text-[11px] text-[#6B7280]" 
                  : "top-1/2 -translate-y-1/2 text-[15px] text-[#6B7280]"
                } ${required ? "after:content-['*'] after:ml-0.5 after:text-[#B91C1C]" : ""}
              `}
            >
              {label}
            </label>

            {options ? (
              <select
                id={inputId}
                disabled={disabled || locked}
                className={`w-full bg-transparent outline-none px-3 pt-5 pb-1 text-[15px] text-[#0F1220] min-h-[48px] appearance-none ${monoClass}`}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                value={value}
                aria-invalid={isError}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...(props as any)}
              >
                {!value && <option value="" disabled>{placeholder}</option>}
                {options.map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            ) : (
              <input
                id={inputId}
                ref={ref}
                disabled={disabled || locked}
                readOnly={locked}
                placeholder={placeholder}
                value={value}
                className={`w-full bg-transparent outline-none px-3 pt-5 pb-1 text-[15px] text-[#0F1220] min-h-[48px] ${monoClass}`}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                aria-invalid={isError}
                {...props}
              />
            )}
          </div>
          
          {loading && (
            <div className="pr-3 flex items-center justify-center text-[#6B7280]">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
          )}
        </div>

        {/* Helper / Error Message */}
        <div className="min-h-[20px] px-1 text-[13px]" aria-live="polite">
          {isError ? (
            <span className="text-[#B91C1C] flex items-center gap-1">
              <span className="font-bold">Error:</span> {error}
            </span>
          ) : isWarning ? (
            <span className="text-[#B45309]">{warning}</span>
          ) : isSuccess ? (
            <span className="text-[#2E7D5B]">{success}</span>
          ) : helper ? (
            <span className="text-[#6B7280]">{helper}</span>
          ) : null}
        </div>
      </div>
    );
  }
);
FloatField.displayName = "FloatField";
