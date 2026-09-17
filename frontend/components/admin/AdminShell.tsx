"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSystemAuth } from "@/lib/auth-context";
import { LoadingState } from "@/components/ui/Feedback";
import { Avatar } from "@/components/ui/Avatar";

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useSystemAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/admin/login");
    }
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
        <LoadingState label="Đang xác thực..." />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream-50 px-4">
        <LoadingState label="Đang chuyển tới trang đăng nhập..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream-50">
      <header className="border-b border-ink-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
          <Link href="/admin/tenants" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-500 text-lg">🌻</span>
            <span className="font-display text-base font-bold text-ink-900">Quản trị hệ thống</span>
          </Link>
          <div className="flex items-center gap-3">
            <Avatar name={user.full_name} src={user.avatar_url} size="sm" />
            <div className="hidden text-sm sm:block">
              <p className="font-semibold text-ink-900">{user.full_name}</p>
              <p className="text-xs text-ink-500">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="rounded-2xl border-2 border-ink-100 px-3 py-1.5 text-sm font-semibold text-ink-700 transition-colors hover:bg-ink-50 cursor-pointer"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8 md:px-8">{children}</main>
    </div>
  );
}
