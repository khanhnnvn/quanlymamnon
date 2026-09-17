"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTenantAuth } from "@/lib/auth-context";
import { dashboardApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Feedback";
import type { AttendanceStatus, DashboardSummary } from "@/lib/types";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const ATTENDANCE_TONE: Record<AttendanceStatus, BadgeTone> = {
  present: "mint",
  late: "secondary",
  excused: "primary",
  absent: "danger",
};

export default function DashboardPage() {
  const { tenant, user, hasRole } = useTenantAuth();
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardApi.summary(tenant);
      setSummary(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải số liệu tổng quan.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  const isAdmin = hasRole("SCHOOL_ADMIN", "VICE_ADMIN");
  const isTeaching = hasRole("HEAD_TEACHER", "TEACHER", "ASSISTANT_TEACHER");
  const isParent = hasRole("PARENT");
  const isOtherStaff =
    !isAdmin && !isTeaching && !isParent && hasRole("ACCOUNTANT", "NURSE", "COOK", "SECURITY", "OFFICE_STAFF");

  return (
    <div>
      <PageHeader
        title={`Chào ${user?.full_name ?? ""} 👋`}
        description="Tổng quan hoạt động của trường hôm nay."
      />

      {loading && <LoadingState label="Đang tải số liệu tổng quan..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && (
        <div className="flex flex-col gap-6">
          {isAdmin && <AdminOverview tenant={tenant} summary={summary} />}
          {isTeaching && <TeacherOverview tenant={tenant} summary={summary} />}
          {isParent && <ParentOverview tenant={tenant} summary={summary} />}
          {isOtherStaff && !summary?.recent_announcements?.length && (
            <EmptyState
              title="Chưa có số liệu riêng cho vai trò của bạn"
              description="Xem thông báo mới nhất của trường ở mục Thông báo."
            />
          )}

          <AnnouncementsWidget summary={summary} tenant={tenant} />
        </div>
      )}
    </div>
  );
}

function AdminOverview({ tenant, summary }: { tenant: string; summary: DashboardSummary | null }) {
  const att = summary?.today_attendance;
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Toàn trường</h2>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Tổng học sinh" value={summary?.total_students ?? "—"} icon="🧒" tone="primary" />
        <StatCard label="Tổng lớp học" value={summary?.total_classes ?? "—"} icon="🏫" tone="secondary" />
        <StatCard label="Tổng nhân sự" value={summary?.total_staff ?? "—"} icon="🧑‍🏫" tone="mint" />
        <StatCard
          label="Có mặt hôm nay"
          value={att ? `${att.present}/${att.total}` : "—"}
          icon="✅"
          tone="berry"
        />
      </div>
      {att && (
        <Card className="mt-4">
          <CardHeader>
            <CardTitle>Điểm danh hôm nay</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Badge tone="mint" dot>Có mặt: {att.present}</Badge>
            <Badge tone="secondary" dot>Đi muộn: {att.late}</Badge>
            <Badge tone="primary" dot>Nghỉ phép: {att.excused}</Badge>
            <Badge tone="danger" dot>Vắng: {att.absent}</Badge>
          </CardContent>
        </Card>
      )}
      <Link
        href={`/${tenant}/classes`}
        className="mt-3 inline-block text-sm font-semibold text-primary-600 hover:underline"
      >
        Quản lý lớp học →
      </Link>
    </section>
  );
}

function TeacherOverview({ tenant, summary }: { tenant: string; summary: DashboardSummary | null }) {
  const classes = summary?.my_classes ?? [];
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Lớp của tôi hôm nay</h2>
      {classes.length === 0 ? (
        <EmptyState title="Chưa có lớp được phân công" icon="🏫" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.class_id}>
              <CardHeader>
                <CardTitle>{c.class_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-ink-500">Sĩ số: {c.student_count} học sinh</p>
                {typeof c.present_today === "number" && (
                  <p className="mt-1 text-sm text-ink-500">Có mặt hôm nay: {c.present_today}</p>
                )}
                <Badge tone={c.attendance_taken ? "mint" : "secondary"} dot className="mt-2">
                  {c.attendance_taken ? "Đã điểm danh" : "Chưa điểm danh"}
                </Badge>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    href={`/${tenant}/attendance?class_id=${c.class_id}`}
                    className="text-sm font-semibold text-primary-600 hover:underline"
                  >
                    Điểm danh →
                  </Link>
                  <Link
                    href={`/${tenant}/journal?class_id=${c.class_id}`}
                    className="text-sm font-semibold text-primary-600 hover:underline"
                  >
                    Viết nhật ký →
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function ParentOverview({ tenant, summary }: { tenant: string; summary: DashboardSummary | null }) {
  const children = summary?.my_children ?? [];
  return (
    <section>
      <h2 className="mb-3 font-display text-lg font-bold text-ink-900">Con của tôi</h2>
      {children.length === 0 ? (
        <EmptyState title="Chưa có thông tin học sinh liên kết" icon="🧒" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((c) => (
            <Card key={c.student_id}>
              <CardContent className="pt-5">
                <div className="flex items-center gap-3">
                  <Avatar name={c.full_name} src={c.avatar_url} />
                  <div>
                    <p className="font-display font-semibold text-ink-900">{c.full_name}</p>
                    <p className="text-xs text-ink-500">{c.class_name ?? "Chưa xếp lớp"}</p>
                  </div>
                </div>
                <div className="mt-3">
                  {c.today_status ? (
                    <Badge tone={ATTENDANCE_TONE[c.today_status]} dot>
                      Hôm nay: {ATTENDANCE_STATUS_LABELS[c.today_status]}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Chưa điểm danh hôm nay</Badge>
                  )}
                </div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <Link
                    href={`/${tenant}/attendance/student/${c.student_id}`}
                    className="text-sm font-semibold text-primary-600 hover:underline"
                  >
                    Xem điểm danh →
                  </Link>
                  <Link
                    href={`/${tenant}/journal/student/${c.student_id}`}
                    className="text-sm font-semibold text-primary-600 hover:underline"
                  >
                    Xem nhật ký →
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function AnnouncementsWidget({ summary, tenant }: { summary: DashboardSummary | null; tenant: string }) {
  const items = summary?.recent_announcements ?? [];
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-ink-900">Thông báo mới nhất</h2>
        <Link href={`/${tenant}/announcements`} className="text-sm font-semibold text-primary-600 hover:underline">
          Xem tất cả →
        </Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title="Chưa có thông báo nào" icon="📣" />
      ) : (
        <div className="flex flex-col gap-3">
          {items.slice(0, 5).map((a) => (
            <Card key={a.id}>
              <CardContent className="flex items-start justify-between gap-3 pt-5">
                <div>
                  <div className="flex items-center gap-2">
                    {a.is_urgent && <Badge tone="danger">Khẩn</Badge>}
                    <p className="font-display font-semibold text-ink-900">{a.title}</p>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-ink-500">{a.content}</p>
                </div>
                <span className="whitespace-nowrap text-xs text-ink-400">
                  {formatDateTime(a.published_at ?? a.created_at)}
                </span>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
