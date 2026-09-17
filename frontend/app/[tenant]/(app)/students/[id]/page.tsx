"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTenantAuth } from "@/lib/auth-context";
import { attendanceApi, journalApi, studentsApi, usersApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { Attendance, DailyJournal, Student } from "@/lib/types";
import { ATTENDANCE_STATUS_LABELS, STUDENT_STATUS_LABELS } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { LoadingState, ErrorState, EmptyState, InlineAlert } from "@/components/ui/Feedback";
import { calculateAge, formatDate } from "@/lib/utils";
import type { AttendanceStatus } from "@/lib/types";

const ATT_TONE: Record<AttendanceStatus, BadgeTone> = {
  present: "mint",
  late: "secondary",
  excused: "primary",
  absent: "danger",
};

export default function StudentDetailPage() {
  const params = useParams<{ tenant: string; id: string }>();
  const tenant = params?.tenant ?? "";
  const studentId = params?.id ?? "";
  const { hasRole } = useTenantAuth();
  const canManage = hasRole("SCHOOL_ADMIN", "VICE_ADMIN");

  const [student, setStudent] = useState<Student | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [journals, setJournals] = useState<DailyJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, att, jr] = await Promise.all([
        studentsApi.get(tenant, studentId),
        attendanceApi.historyByStudent(tenant, studentId).catch(() => []),
        journalApi.listByStudent(tenant, studentId).catch(() => []),
      ]);
      setStudent(s);
      setAttendance(att);
      setJournals(jr);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải hồ sơ học sinh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, studentId]);

  return (
    <div>
      <Link href={`/${tenant}/students`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
        ← Quay lại danh sách học sinh
      </Link>

      {loading && <LoadingState label="Đang tải hồ sơ học sinh..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && student && (
        <>
          <PageHeader
            title={student.full_name}
            description={`${calculateAge(student.dob)} · ${student.class_name ?? "Chưa xếp lớp"}`}
            actions={
              canManage ? <Button onClick={() => setLinkOpen(true)}>＋ Liên kết phụ huynh</Button> : undefined
            }
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="flex flex-col gap-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>Thông tin cơ bản</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <Avatar name={student.full_name} src={student.avatar_url} size="lg" />
                    <dl className="grid flex-1 grid-cols-2 gap-3 text-sm">
                      <Info label="Ngày sinh" value={formatDate(student.dob)} />
                      <Info label="Giới tính" value={student.gender === "female" ? "Nữ" : "Nam"} />
                      <Info label="Trạng thái" value={STUDENT_STATUS_LABELS[student.status]} />
                      <Info label="Ngày nhập học" value={formatDate(student.enrollment_date)} />
                    </dl>
                  </div>
                  {student.note && (
                    <p className="mt-4 rounded-2xl bg-secondary-50 px-4 py-3 text-sm text-ink-700">
                      <span className="font-semibold">Ghi chú: </span>
                      {student.note}
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Lịch sử điểm danh</CardTitle>
                </CardHeader>
                <CardContent>
                  {attendance.length === 0 ? (
                    <EmptyState title="Chưa có dữ liệu điểm danh" icon="✅" />
                  ) : (
                    <ul className="flex flex-col divide-y divide-ink-50">
                      {attendance
                        .slice()
                        .sort((a, b) => (a.date < b.date ? 1 : -1))
                        .slice(0, 15)
                        .map((a) => (
                          <li key={a.id} className="flex items-center justify-between py-2.5 text-sm">
                            <span className="text-ink-700">{formatDate(a.date)}</span>
                            <Badge tone={ATT_TONE[a.status]} dot>
                              {ATTENDANCE_STATUS_LABELS[a.status]}
                            </Badge>
                          </li>
                        ))}
                    </ul>
                  )}
                  <Link
                    href={`/${tenant}/attendance/student/${studentId}`}
                    className="mt-3 inline-block text-sm font-semibold text-primary-600 hover:underline"
                  >
                    Xem đầy đủ lịch sử điểm danh →
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Nhật ký gần đây</CardTitle>
                </CardHeader>
                <CardContent>
                  {journals.length === 0 ? (
                    <EmptyState title="Chưa có nhật ký nào" icon="📔" />
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {journals.slice(0, 3).map((j) => (
                        <li key={j.id} className="rounded-2xl bg-cream-100 px-4 py-3">
                          <p className="text-xs font-semibold text-ink-500">{formatDate(j.date)}</p>
                          <p className="mt-1 line-clamp-2 text-sm text-ink-800">{j.content}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Link
                    href={`/${tenant}/journal/student/${studentId}`}
                    className="mt-3 inline-block text-sm font-semibold text-primary-600 hover:underline"
                  >
                    Xem toàn bộ nhật ký →
                  </Link>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Phụ huynh / Người giám hộ</CardTitle>
              </CardHeader>
              <CardContent>
                {!student.parents || student.parents.length === 0 ? (
                  <p className="text-sm text-ink-400">Chưa liên kết phụ huynh nào.</p>
                ) : (
                  <ul className="flex flex-col gap-3">
                    {student.parents.map((p) => (
                      <li key={p.id} className="rounded-2xl bg-cream-100 px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-ink-900">{p.parent_full_name ?? p.parent_user_id}</span>
                          {p.is_primary_contact && <Badge tone="primary">Liên hệ chính</Badge>}
                        </div>
                        <p className="mt-0.5 text-xs text-ink-500">{p.relationship ?? "Phụ huynh"}</p>
                        {p.can_pickup && (
                          <p className="mt-1 text-xs font-medium text-mint-600">✓ Được phép đón trẻ</p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          {canManage && (
            <LinkParentModal
              open={linkOpen}
              onClose={() => setLinkOpen(false)}
              tenant={tenant}
              studentId={studentId}
              onLinked={load}
            />
          )}
        </>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="text-ink-800">{value || "—"}</dd>
    </div>
  );
}

function LinkParentModal({
  open,
  onClose,
  onLinked,
  tenant,
  studentId,
}: {
  open: boolean;
  onClose: () => void;
  onLinked: () => void;
  tenant: string;
  studentId: string;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [relationship, setRelationship] = useState("Mẹ");
  const [isPrimary, setIsPrimary] = useState(true);
  const [canPickup, setCanPickup] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setRelationship("Mẹ");
      setIsPrimary(true);
      setCanPickup(true);
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      // Backend không tự tạo tài khoản phụ huynh khi liên kết — tạo tài
      // khoản (vai trò PARENT) trước, sau đó mới liên kết bằng id trả về.
      const parentUser = await usersApi.create(tenant, {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        roles: ["PARENT"],
        status: "active",
      });
      await studentsApi.linkParent(tenant, studentId, {
        parent_user_id: parentUser.id,
        relationship,
        is_primary_contact: isPrimary,
        can_pickup: canPickup,
      });
      onLinked();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể liên kết phụ huynh.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Liên kết phụ huynh">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <p className="text-sm text-ink-500">
          Hệ thống sẽ tạo một tài khoản phụ huynh mới với thông tin bên dưới rồi liên kết với học sinh này.
        </p>
        <Input label="Họ tên phụ huynh" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email đăng nhập" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Input label="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <Input
          label="Mật khẩu tạm thời"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          hint="Ít nhất 8 ký tự, gửi lại cho phụ huynh để đăng nhập lần đầu."
        />
        <Select label="Mối quan hệ" value={relationship} onChange={(e) => setRelationship(e.target.value)}>
          <option value="Mẹ">Mẹ</option>
          <option value="Bố">Bố</option>
          <option value="Ông">Ông</option>
          <option value="Bà">Bà</option>
          <option value="Người giám hộ">Người giám hộ khác</option>
        </Select>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
            <input type="checkbox" checked={isPrimary} onChange={(e) => setIsPrimary(e.target.checked)} className="h-4 w-4 rounded accent-primary-500" />
            Là người liên hệ chính
          </label>
          <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
            <input type="checkbox" checked={canPickup} onChange={(e) => setCanPickup(e.target.checked)} className="h-4 w-4 rounded accent-primary-500" />
            Được phép đón trẻ
          </label>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={submitting}>
            Liên kết
          </Button>
        </div>
      </form>
    </Modal>
  );
}
