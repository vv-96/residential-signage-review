"use client";

type ButtonVariant = "primary" | "secondary" | "text" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const variantClass: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  text: "btn-text",
  danger: "btn-danger",
};

const sizeClass: Record<ButtonSize, string> = {
  sm: "btn-sm",
  md: "btn-md",
  lg: "btn-lg",
};

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({ variant = "primary", size = "md", loading, disabled, className = "", children, ...rest }: ButtonProps) {
  return (
    <button
      className={`${variantClass[variant]} ${sizeClass[size]} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <span className="btn-loading" aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
