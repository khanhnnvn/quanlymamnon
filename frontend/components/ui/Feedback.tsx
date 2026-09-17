import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-5 w-5 animate-spin text-primary-500", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}

export function LoadingState({ label = "Đang tải dữ liệu..." }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-ink-100 bg-white/60 px-6 py-14 text-center">
      <Spinner className="h-7 w-7" />
      <p className="text-sm font-medium text-ink-500">{label}</p>
    </div>
  );
}

export function ErrorState({
  message = "Đã có lỗi xảy ra. Vui lòng thử lại.",
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-danger-100 bg-danger-50 px-6 py-14 text-center">
      <svg className="h-9 w-9 text-danger-500" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="max-w-sm text-sm font-medium text-danger-600">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-2xl bg-danger-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-danger-600 cursor-pointer"
        >
          Thử lại
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title = "Chưa có dữ liệu",
  description,
  icon,
  action,
}: {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-ink-200 bg-cream-100/60 px-6 py-14 text-center">
      <div className="text-4xl" aria-hidden="true">
        {icon ?? "🌤️"}
      </div>
      <div>
        <p className="font-display text-base font-semibold text-ink-800">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-ink-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function InlineAlert({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "danger" | "warning";
  children: React.ReactNode;
}) {
  const toneClasses = {
    info: "bg-mint-50 text-mint-700 border-mint-200",
    success: "bg-mint-50 text-mint-700 border-mint-200",
    danger: "bg-danger-50 text-danger-600 border-danger-100",
    warning: "bg-secondary-50 text-secondary-700 border-secondary-200",
  } as const;
  return (
    <div className={cn("rounded-2xl border px-4 py-3 text-sm font-medium", toneClasses[tone])}>
      {children}
    </div>
  );
}
