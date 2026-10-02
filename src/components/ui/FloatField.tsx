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
      onChange,
      onBlur,
      onFocus,
      ...props
    },
    forwardedRef
  ) => {
    const generatedId = React.useId();
    const fid = id || generatedId;
    const hid = `${fid}-h`;
    const [isFocused, setIsFocused] = React.useState(forceFocus || false);
    
    const internalInputRef = React.useRef<HTMLInputElement>(null);
    const internalSelectRef = React.useRef<HTMLSelectElement>(null);
    
    const inputRef = (node: HTMLInputElement) => {
      internalInputRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    };
    
    const isError = !!error && !loading;
    const isWarning = !!warning && !isError && !loading;
    const isSuccess = !!success && !isError && !loading;
    const isLocked = !!locked;
    const isDisabled = !!disabled;
    const showFocus = !isLocked && !isDisabled && (isFocused || !!forceFocus);
    
    const bw = showFocus || isError ? "1.5px" : "1px";
    const bc = isError ? "#B91C1C" : showFocus ? "#6D3FE0" : isWarning ? "#D9A23B" : isSuccess ? "#2E7D5B" : (isLocked || isDisabled) ? "#E5E7EB" : "#B8BEC9";
    const bg = isLocked ? "#F3F4F6" : isDisabled ? "#F9FAFB" : "#FFFFFF";
    const ring = showFocus ? (isError ? "0 0 0 2px rgba(220,62,62,.25)" : "0 0 0 2px rgba(109,63,224,.3)") : "none";
    const lc = isError ? "#B91C1C" : showFocus ? "#6D3FE0" : isDisabled ? "#9CA3AF" : isLocked ? "#6B7280" : "#374151";
    const tc = isDisabled ? "#9CA3AF" : isLocked ? "#4B5563" : "#111827";
    const ic = isError ? "#B91C1C" : showFocus ? "#6D3FE0" : isDisabled ? "#C5CAD3" : "#6B7280";
    const cursor = isLocked || isDisabled ? "default" : "text";
    
    const hasValue = value !== undefined && value !== "";
    const selColor = hasValue ? "#111827" : "#6B7280";
    const monoClass = mono ? "font-['JetBrains_Mono',ui-monospace,monospace] tracking-[0.04em]" : "font-sans";
    
    const helperText = isError ? error : loading ? helper : isWarning ? warning : isSuccess ? success : (helper ?? (isLocked ? 'Auto-filled from your branch code' : ''));
    const hasHelper = !!helperText;
    const hc = isError ? "#B91C1C" : isWarning ? "#B45309" : isSuccess ? "#2E7D5B" : "#6B7280";

    const handleFocusInput = () => {
      const el = internalInputRef.current || internalSelectRef.current;
      if (el && !isLocked && !isDisabled) el.focus();
    };

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      setIsFocused(true);
      if (onFocus) onFocus(e as unknown as React.FocusEvent<HTMLInputElement>);
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
      setIsFocused(false);
      if (onBlur) onBlur(e as unknown as React.FocusEvent<HTMLInputElement>);
    };

    return (
      <div className={`flex flex-col gap-[6px] min-w-0 font-sans ${className}`}>
        <fieldset 
          onClick={handleFocusInput}
          style={{
            margin: 0, padding: "0 14px", minWidth: 0, borderStyle: "solid", borderWidth: bw, borderColor: bc, 
            borderRadius: "10px", background: bg, boxShadow: ring, transition: "border-color .15s ease, box-shadow .15s ease",
            display: "flex", alignItems: "center", gap: "10px", cursor
          }}
        >
          <legend style={{
            padding: "0 6px", marginLeft: "-6px", fontSize: "13px", lineHeight: "16px", fontWeight: 500,
            color: lc, whiteSpace: "nowrap", transition: "color .15s ease"
          }}>
            <label htmlFor={fid} style={{ cursor: "inherit" }}>{label}</label>
            {required && <span aria-hidden="true" style={{ color: "#B91C1C", marginLeft: "2px" }}>*</span>}
          </legend>

          {icon === "search" && (
            <span aria-hidden="true" style={{ display: "flex", flex: "none", marginTop: "-8px", color: ic }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-3.5-3.5"></path></svg>
            </span>
          )}
          {icon === "user" && (
            <span aria-hidden="true" style={{ display: "flex", flex: "none", marginTop: "-8px", color: ic }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path></svg>
            </span>
          )}
          {icon === "mail" && (
            <span aria-hidden="true" style={{ display: "flex", flex: "none", marginTop: "-8px", color: ic }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"></rect><path d="m3.5 6.5 8.5 6 8.5-6"></path></svg>
            </span>
          )}

          {options ? (
            <>
              <select
                ref={internalSelectRef}
                id={fid}
                value={value}
                onChange={onChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                disabled={isDisabled || isLocked}
                aria-describedby={hasHelper ? hid : undefined}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...(props as any)}
                style={{
                  flex: 1, minWidth: 0, appearance: "none", border: 0, outline: 0, background: "transparent",
                  fontFamily: "inherit", fontSize: "16px", lineHeight: "24px", padding: "4px 0 12px", margin: 0,
                  color: selColor, cursor: "pointer"
                }}
              >
                <option value="" disabled>{placeholder || " "}</option>
                {options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
              <span aria-hidden="true" style={{ display: "flex", flex: "none", marginTop: "-8px", color: ic, pointerEvents: "none" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"></path></svg>
              </span>
            </>
          ) : (
            <input
              ref={inputRef}
              id={fid}
              value={value}
              onChange={onChange}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder={placeholder || ""}
              readOnly={isLocked}
              disabled={isDisabled}
              aria-invalid={isError ? "true" : "false"}
              aria-describedby={hasHelper ? hid : undefined}
              aria-required={required ? "true" : "false"}
              {...props}
              className={`placeholder:text-[#6B7280] placeholder:italic placeholder:font-normal ${monoClass}`}
              style={{
                flex: 1, minWidth: 0, border: 0, outline: 0, background: "transparent", fontSize: "16px", lineHeight: "24px",
                padding: "4px 0 12px", margin: 0, color: tc, cursor, textOverflow: "ellipsis"
              }}
            />
          )}

          {loading && (
            <span style={{ display: "flex", flex: "none", marginTop: "-8px" }}>
              <span aria-label="Loading" className="animate-spin" style={{ width: 16, height: 16, borderRadius: 999, border: "2px solid #DDD6FE", borderTopColor: "#6D3FE0", display: "inline-block", boxSizing: "border-box" }} />
            </span>
          )}
          {isLocked && (
            <span aria-hidden="true" style={{ display: "flex", flex: "none", marginTop: "-8px", color: "#6B7280" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>
            </span>
          )}
          {isSuccess && (
            <span aria-hidden="true" style={{ display: "flex", flex: "none", marginTop: "-8px", color: "#2E7D5B" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.5"></circle><path d="m8 12.5 2.8 2.8L16 9.5"></path></svg>
            </span>
          )}
          {isError && (
            <span aria-hidden="true" style={{ display: "flex", flex: "none", marginTop: "-8px", color: "#DC3E3E" }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9.5"></circle><path d="M12 7.5v5.5M12 16.5h.01"></path></svg>
            </span>
          )}
        </fieldset>

        {hasHelper && (
          <div id={hid} role={isError ? "alert" : "note"} style={{ display: "flex", gap: "6px", alignItems: "flex-start", fontSize: "13px", lineHeight: "18px", color: hc, padding: "0 2px", textWrap: "pretty" }}>
            {isLocked && !isError && (
              <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: "2px" }}><rect x="4" y="11" width="16" height="10" rx="2"></rect><path d="M8 11V7a4 4 0 0 1 8 0v4"></path></svg>
            )}
            {isWarning && (
              <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", marginTop: "2px" }}><path d="M12 3 2.5 20h19L12 3Z"></path><path d="M12 10v4.5M12 17.5h.01"></path></svg>
            )}
            <span>{isError && <span style={{ fontWeight: 600 }}>Error: </span>}{helperText}</span>
          </div>
        )}
      </div>
    );
  }
);
FloatField.displayName = "FloatField";
