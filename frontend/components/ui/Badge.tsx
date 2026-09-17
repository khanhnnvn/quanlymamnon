import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "primary" | "secondary" | "mint" | "berry" | "danger" | "neutral";

const toneClasses: Record<BadgeTone, string> = {
  primary: "bg-primary-100 text-primary-700",
  secondary: "bg-secondary-100 text-secondary-700",
  mint: "bg-mint-100 text-mint-700",
  berry: "bg-berry-100 text-berry-600",
  danger: "bg-danger-100 text-danger-600",
  neutral: "bg-ink-100 text-ink-700",
};

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  dot?: boolean;
}

export function Badge({ tone = "neutral", dot, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
