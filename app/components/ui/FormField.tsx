"use client";

export function FormField({ label, required, hint, error, children, htmlFor }: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className={`form-field ${error ? "has-error" : ""}`}>
      <label htmlFor={htmlFor}>
        {label}{required ? <span className="required-mark">*</span> : null}
      </label>
      {children}
      {error ? <p className="field-error" role="alert">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}
