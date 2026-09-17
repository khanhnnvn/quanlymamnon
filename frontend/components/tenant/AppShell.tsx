"use client";

import { useState } from "react";
import Link from "next/link";
import { useTenantAuth } from "@/lib/auth-context";
import { visibleNavItems } from "./nav-config";
import { SidebarNavItem } from "@/components/ui/SidebarNavItem";
import { Avatar } from "@/components/ui/Avatar";
import { LoadingState, ErrorState } from "@/components/ui/Feedback";
import { ROLE_LABELS } from "@/lib/types";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { tenant, user, loading, error, logout, refresh } = useTenantAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
        <LoadingState label="Đang tải không gian trường..." />
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
        <ErrorState message={error ?? "Vui lòng đăng nhập lại."} onRetry={refresh} />
      </div>
    );
  }

  const items = visibleNavItems(user.roles);
  const primaryRole = user.roles?.[0];

  return (
    <div className="min-h-screen bg-cream-50 md:flex">
      {/* Sidebar - desktop */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-ink-100 bg-white px-4 py-6 md:flex">
        <SidebarBrand tenant={tenant} />
        <nav className="mt-6 flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <SidebarNavItem
              key={item.href}
              href={`/${tenant}/${item.href}`}
              label={item.label}
              icon={item.icon}
            />
          ))}
        </nav>
        <SidebarUser user={user} primaryRole={primaryRole} onLogout={logout} />
      </aside>

      {/* Sidebar - mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-ink-900/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-white px-4 py-6 shadow-xl">
            <SidebarBrand tenant={tenant} />
            <nav className="mt-6 flex flex-1 flex-col gap-1">
              {items.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  href={`/${tenant}/${item.href}`}
                  label={item.label}
                  icon={item.icon}
                  onNavigate={() => setMobileOpen(false)}
                />
              ))}
            </nav>
            <SidebarUser user={user} primaryRole={primaryRole} onLogout={logout} />
          </aside>
        </div>
      )}

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Topbar - mobile */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-ink-100 bg-white/95 px-4 py-3 backdrop-blur md:hidden">
          <button
            type="button"
            aria-label="Mở menu"
            onClick={() => setMobileOpen(true)}
            className="rounded-xl p-2 text-ink-700 hover:bg-ink-50 cursor-pointer"
          >
            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-display text-sm font-bold text-ink-900">🌻 Mầm Non Số</span>
          <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
        </header>

        <main className="flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}

function SidebarBrand({ tenant }: { tenant: string }) {
  return (
    <Link href={`/${tenant}/dashboard`} className="flex items-center gap-2">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-lg">🌻</span>
      <div className="min-w-0">
        <p className="font-display text-sm font-bold leading-tight text-ink-900">Mầm Non Số</p>
        <p className="truncate text-xs text-ink-400">{tenant}</p>
      </div>
    </Link>
  );
}

function SidebarUser({
  user,
  primaryRole,
  onLogout,
}: {
  user: { full_name: string; avatar_url?: string | null };
  primaryRole?: string;
  onLogout: () => void;
}) {
  return (
    <div className="mt-4 border-t border-ink-50 pt-4">
      <div className="flex items-center gap-2.5">
        <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink-900">{user.full_name}</p>
          <p className="truncate text-xs text-ink-500">
            {primaryRole ? ROLE_LABELS[primaryRole as keyof typeof ROLE_LABELS] : ""}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="mt-3 w-full rounded-2xl border-2 border-ink-100 px-3 py-2 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 cursor-pointer"
      >
        Đăng xuất
      </button>
    </div>
  );
}
