import { InputHTMLAttributes, TextareaHTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface FieldWrapperProps {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

const fieldBase =
  "w-full rounded-2xl border-2 border-ink-100 bg-white px-4 py-2.5 text-sm text-ink-900 placeholder:text-ink-300 outline-none transition-colors focus:border-primary-400 focus:ring-4 focus:ring-primary-100 disabled:bg-ink-50 disabled:text-ink-300";

function FieldChrome({
  label,
  hint,
  error,
  required,
  htmlFor,
  children,
}: FieldWrapperProps & { htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-ink-700">
          {label}
          {required && <span className="text-danger-500"> *</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-danger-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

interface InputProps extends InputHTMLAttributes<HTMLInputElement>, FieldWrapperProps {}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, className, id, ...props },
  ref
) {
  return (
    <FieldChrome label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <input
        ref={ref}
        id={id}
        className={cn(fieldBase, error && "border-danger-400 focus:border-danger-400 focus:ring-danger-100", className)}
        {...props}
      />
    </FieldChrome>
  );
});

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement>, FieldWrapperProps {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className, id, rows = 4, ...props },
  ref
) {
  return (
    <FieldChrome label={label} hint={hint} error={error} required={required} htmlFor={id}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        className={cn(fieldBase, "resize-y", error && "border-danger-400 focus:border-danger-400 focus:ring-danger-100", className)}
        {...props}
      />
    </FieldChrome>
  );
});
