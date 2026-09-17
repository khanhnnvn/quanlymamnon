"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-500 text-white shadow-sm shadow-primary-500/30 hover:bg-primary-600 active:bg-primary-700 disabled:bg-primary-300",
  secondary:
    "bg-secondary-400 text-ink-900 shadow-sm shadow-secondary-400/30 hover:bg-secondary-500 active:bg-secondary-600 disabled:bg-secondary-200",
  outline:
    "border-2 border-primary-300 text-primary-700 bg-white hover:bg-primary-50 active:bg-primary-100 disabled:text-primary-300 disabled:border-primary-100",
  ghost: "text-ink-700 hover:bg-ink-100 active:bg-ink-100 disabled:text-ink-300",
  danger:
    "bg-danger-500 text-white shadow-sm shadow-danger-500/30 hover:bg-danger-600 active:bg-danger-600 disabled:bg-danger-100 disabled:text-danger-500",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "text-sm px-3 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2.5 gap-2",
  lg: "text-base px-6 py-3 gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", loading, fullWidth, disabled, children, ...props },
  ref
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center rounded-2xl font-semibold transition-colors duration-150 cursor-pointer disabled:cursor-not-allowed select-none",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading && (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-90"
            fill="currentColor"
            d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
          />
        </svg>
      )}
      {children}
    </button>
  );
});
