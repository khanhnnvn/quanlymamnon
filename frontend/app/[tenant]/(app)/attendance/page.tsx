"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTenantAuth } from "@/lib/auth-context";
import { attendanceApi, classesApi, studentsApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { Attendance, AttendanceStatus, SchoolClass, Student } from "@/lib/types";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Card, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { LoadingState, ErrorState, EmptyState, InlineAlert } from "@/components/ui/Feedback";
import { cn, todayISO } from "@/lib/utils";

const STATUS_OPTIONS: AttendanceStatus[] = ["present", "late", "excused", "absent"];

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  present: "bg-mint-500 text-white border-mint-500",
  late: "bg-secondary-400 text-ink-900 border-secondary-400",
  excused: "bg-primary-400 text-white border-primary-400",
  absent: "bg-danger-500 text-white border-danger-500",
};

export default function AttendancePage() {
  return (
    <Suspense fallback={<LoadingState label="Đang tải..." />}>
      <AttendancePageInner />
    </Suspense>
  );
}

function AttendancePageInner() {
  const { tenant, hasRole } = useTenantAuth();
  const searchParams = useSearchParams();
  const canTake = hasRole("SCHOOL_ADMIN", "VICE_ADMIN", "HEAD_TEACHER", "TEACHER", "ASSISTANT_TEACHER", "SECURITY");
  const isParentOnly = hasRole("PARENT") && !canTake;

  if (isParentOnly) return <ParentAttendanceView tenant={tenant} />;
  return <StaffAttendanceGrid tenant={tenant} initialClassId={searchParams?.get("class_id") ?? undefined} />;
}

function StaffAttendanceGrid({ tenant, initialClassId }: { tenant: string; initialClassId?: string }) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [date, setDate] = useState(todayISO());
  const [students, setStudents] = useState<Student[]>([]);
  const [records, setRecords] = useState<Map<string, Attendance>>(new Map());
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    classesApi
      .list(tenant)
      .then((cls) => {
        setClasses(cls);
        if (!classId && cls.length > 0) setClassId(cls[0].id);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải danh sách lớp."))
      .finally(() => setLoadingClasses(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  async function loadGrid() {
    if (!classId) return;
    setLoadingGrid(true);
    setError(null);
    try {
      const [studentList, attendanceList] = await Promise.all([
        studentsApi.list(tenant, { class_id: classId }),
        attendanceApi.listByClassDate(tenant, classId, date),
      ]);
      setStudents(studentList);
      setRecords(new Map(attendanceList.map((a) => [a.student_id, a])));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải bảng điểm danh.");
    } finally {
      setLoadingGrid(false);
    }
  }

  useEffect(() => {
    if (classId) loadGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date]);

  async function setStatus(student: Student, status: AttendanceStatus) {
    setSavingId(student.id);
    setError(null);
    try {
      // POST /attendance luôn upsert theo (tenant_id, student_id, date) —
      // backend không có PATCH /attendance/:id, nên dù đã có bản ghi hôm
      // nay hay chưa, gọi record() là đủ và đúng hợp đồng API.
      const updated = await attendanceApi.record(tenant, { student_id: student.id, class_id: classId, date, status });
      setRecords((prev) => {
        const next = new Map(prev);
        next.set(student.id, updated);
        return next;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể lưu điểm danh, vui lòng thử lại.");
    } finally {
      setSavingId(null);
    }
  }

  const summary = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, excused: 0 };
    records.forEach((r) => {
      counts[r.status] += 1;
    });
    return counts;
  }, [records]);

  return (
    <div>
      <PageHeader title="Điểm danh" description="Chọn lớp và ngày để điểm danh nhanh cho học sinh." />

      <Card className="mb-5">
        <CardContent className="flex flex-col gap-4 pt-5 sm:flex-row sm:items-end">
          <Select
            label="Lớp học"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            disabled={loadingClasses}
            className="sm:max-w-xs"
          >
            {classes.length === 0 && <option value="">Chưa có lớp</option>}
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input label="Ngày" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:max-w-[180px]" />
          <div className="flex flex-wrap gap-2 pb-1 sm:ml-auto">
            <Badge tone="mint" dot>Có mặt {summary.present}</Badge>
            <Badge tone="secondary" dot>Muộn {summary.late}</Badge>
            <Badge tone="primary" dot>Nghỉ phép {summary.excused}</Badge>
            <Badge tone="danger" dot>Vắng {summary.absent}</Badge>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-4">
          <InlineAlert tone="danger">{error}</InlineAlert>
        </div>
      )}

      {loadingClasses && <LoadingState label="Đang tải danh sách lớp..." />}
      {!loadingClasses && classes.length === 0 && (
        <EmptyState title="Chưa có lớp học nào để điểm danh" icon="🏫" />
      )}
      {!loadingClasses && classes.length > 0 && loadingGrid && <LoadingState label="Đang tải bảng điểm danh..." />}
      {!loadingClasses && classes.length > 0 && !loadingGrid && students.length === 0 && (
        <EmptyState title="Lớp này chưa có học sinh" icon="🧒" />
      )}

      {!loadingGrid && students.length > 0 && (
        <div className="flex flex-col gap-3">
          {students.map((s) => {
            const rec = records.get(s.id);
            return (
              <Card key={s.id}>
                <CardContent className="flex flex-col gap-3 pt-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.full_name} src={s.avatar_url} />
                    <div>
                      <p className="font-semibold text-ink-900">{s.full_name}</p>
                      {rec && <p className="text-xs text-ink-500">Đã ghi nhận: {ATTENDANCE_STATUS_LABELS[rec.status]}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_OPTIONS.map((status) => (
                      <button
                        key={status}
                        type="button"
                        disabled={savingId === s.id}
                        onClick={() => setStatus(s, status)}
                        className={cn(
                          "rounded-2xl border-2 px-3 py-1.5 text-sm font-semibold transition-all cursor-pointer disabled:opacity-50",
                          rec?.status === status
                            ? STATUS_STYLE[status]
                            : "border-ink-100 bg-white text-ink-600 hover:border-ink-200"
                        )}
                      >
                        {ATTENDANCE_STATUS_LABELS[status]}
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ParentAttendanceView({ tenant }: { tenant: string }) {
  const [children, setChildren] = useState<Student[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentsApi
      .list(tenant)
      .then(setChildren)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải dữ liệu."))
      .finally(() => setLoading(false));
  }, [tenant]);

  return (
    <div>
      <PageHeader title="Điểm danh" description="Xem lịch sử điểm danh của con bạn." />
      {loading && <LoadingState label="Đang tải..." />}
      {!loading && error && <ErrorState message={error} />}
      {!loading && !error && (!children || children.length === 0) && (
        <EmptyState title="Chưa có học sinh nào được liên kết với tài khoản của bạn" icon="🧒" />
      )}
      {!loading && !error && children && children.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center justify-between pt-5">
                <div className="flex items-center gap-3">
                  <Avatar name={c.full_name} src={c.avatar_url} />
                  <div>
                    <p className="font-semibold text-ink-900">{c.full_name}</p>
                    <p className="text-xs text-ink-500">{c.class_name ?? "Chưa xếp lớp"}</p>
                  </div>
                </div>
                <Link
                  href={`/${tenant}/attendance/student/${c.id}`}
                  className="text-sm font-semibold text-primary-600 hover:underline"
                >
                  Xem →
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
