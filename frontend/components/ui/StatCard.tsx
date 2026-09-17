import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "primary" | "secondary" | "mint" | "berry";
}

const toneClasses = {
  primary: "bg-primary-50 text-primary-600",
  secondary: "bg-secondary-50 text-secondary-700",
  mint: "bg-mint-50 text-mint-600",
  berry: "bg-berry-50 text-berry-600",
};

export function StatCard({ label, value, hint, icon, tone = "primary" }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-ink-100 bg-white p-5 shadow-sm shadow-ink-900/5">
      {icon && (
        <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl", toneClasses[tone])}>
          {icon}
        </div>
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-ink-500">{label}</p>
        <p className="font-display text-2xl font-bold text-ink-900">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-ink-500">{hint}</p>}
      </div>
    </div>
  );
}
