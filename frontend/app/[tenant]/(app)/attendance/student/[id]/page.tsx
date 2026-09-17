"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { attendanceApi, studentsApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { Attendance, Student } from "@/lib/types";
import { ATTENDANCE_STATUS_LABELS } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Feedback";
import { formatDate, formatTime } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/types";

const ATT_TONE: Record<AttendanceStatus, BadgeTone> = {
  present: "mint",
  late: "secondary",
  excused: "primary",
  absent: "danger",
};

export default function AttendanceHistoryPage() {
  const params = useParams<{ tenant: string; id: string }>();
  const tenant = params?.tenant ?? "";
  const studentId = params?.id ?? "";

  const [student, setStudent] = useState<Student | null>(null);
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, history] = await Promise.all([
        studentsApi.get(tenant, studentId),
        attendanceApi.historyByStudent(tenant, studentId),
      ]);
      setStudent(s);
      setRecords(history);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải lịch sử điểm danh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, studentId]);

  const sorted = useMemo(() => records.slice().sort((a, b) => (a.date < b.date ? 1 : -1)), [records]);

  return (
    <div>
      <Link href={`/${tenant}/attendance`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
        ← Quay lại
      </Link>

      {loading && <LoadingState label="Đang tải lịch sử điểm danh..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && student && (
        <>
          <PageHeader
            title={`Điểm danh của ${student.full_name}`}
            description={student.class_name ?? "Chưa xếp lớp"}
          />
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={student.full_name} src={student.avatar_url} size="lg" />
          </div>

          {sorted.length === 0 ? (
            <EmptyState title="Chưa có dữ liệu điểm danh" icon="✅" />
          ) : (
            <div className="flex flex-col gap-2">
              {sorted.map((r) => (
                <Card key={r.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-2 pt-5">
                    <div>
                      <p className="font-semibold text-ink-900">{formatDate(r.date)}</p>
                      {(r.check_in_time || r.check_out_time) && (
                        <p className="text-xs text-ink-500">
                          {r.check_in_time && `Đến: ${formatTime(r.check_in_time)}`}
                          {r.check_in_time && r.check_out_time && " · "}
                          {r.check_out_time && `Về: ${formatTime(r.check_out_time)}`}
                        </p>
                      )}
                      {r.note && <p className="mt-1 text-xs text-ink-500">Ghi chú: {r.note}</p>}
                    </div>
                    <Badge tone={ATT_TONE[r.status]} dot>
                      {ATTENDANCE_STATUS_LABELS[r.status]}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
