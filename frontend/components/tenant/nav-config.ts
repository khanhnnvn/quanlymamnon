import type { RoleCode } from "@/lib/types";

export interface NavItemConfig {
  href: string;
  label: string;
  icon: string;
  /** null = mọi vai trò đã đăng nhập đều thấy */
  roles: RoleCode[] | null;
}

export const NAV_ITEMS: NavItemConfig[] = [
  { href: "dashboard", label: "Dashboard", icon: "🏠", roles: null },
  {
    href: "classes",
    label: "Lớp học",
    icon: "🏫",
    roles: ["SCHOOL_ADMIN", "VICE_ADMIN", "HEAD_TEACHER", "TEACHER", "ASSISTANT_TEACHER"],
  },
  {
    href: "students",
    label: "Học sinh",
    icon: "🧒",
    roles: [
      "SCHOOL_ADMIN",
      "VICE_ADMIN",
      "HEAD_TEACHER",
      "TEACHER",
      "ASSISTANT_TEACHER",
      "ACCOUNTANT",
      "NURSE",
      "SECURITY",
      "PARENT",
    ],
  },
  {
    href: "attendance",
    label: "Điểm danh",
    icon: "✅",
    roles: [
      "SCHOOL_ADMIN",
      "VICE_ADMIN",
      "HEAD_TEACHER",
      "TEACHER",
      "ASSISTANT_TEACHER",
      "SECURITY",
      "PARENT",
    ],
  },
  {
    href: "journal",
    label: "Nhật ký",
    icon: "📔",
    roles: ["SCHOOL_ADMIN", "VICE_ADMIN", "HEAD_TEACHER", "TEACHER", "ASSISTANT_TEACHER", "PARENT"],
  },
  { href: "announcements", label: "Thông báo", icon: "📣", roles: null },
  { href: "staff", label: "Nhân sự", icon: "🗂️", roles: ["SCHOOL_ADMIN", "VICE_ADMIN"] },
];

export function visibleNavItems(roles: RoleCode[] | undefined): NavItemConfig[] {
  return NAV_ITEMS.filter((item) => !item.roles || item.roles.some((r) => roles?.includes(r)));
}
