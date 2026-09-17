"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface SidebarNavItemProps {
  href: string;
  label: string;
  icon: React.ReactNode;
  onNavigate?: () => void;
  exact?: boolean;
}

export function SidebarNavItem({ href, label, icon, onNavigate, exact }: SidebarNavItemProps) {
  const pathname = usePathname();
  const active = exact ? pathname === href : pathname === href || pathname?.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-2xl px-3.5 py-2.5 text-sm font-semibold transition-colors",
        active
          ? "bg-primary-500 text-white shadow-sm shadow-primary-500/30"
          : "text-ink-700 hover:bg-primary-50 hover:text-primary-700"
      )}
    >
      <span className={cn("text-lg", active ? "text-white" : "text-primary-500")} aria-hidden="true">
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </Link>
  );
}
