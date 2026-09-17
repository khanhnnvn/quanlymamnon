"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTenantAuth } from "@/lib/auth-context";
import { classesApi, studentsApi, usersApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { SchoolClass, Student, User } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { LoadingState, ErrorState, EmptyState, InlineAlert } from "@/components/ui/Feedback";
import { STUDENT_STATUS_LABELS } from "@/lib/types";
import { calculateAge } from "@/lib/utils";

export default function ClassDetailPage() {
  const params = useParams<{ tenant: string; id: string }>();
  const tenant = params?.tenant ?? "";
  const classId = params?.id ?? "";
  const { hasRole } = useTenantAuth();
  const canManage = hasRole("SCHOOL_ADMIN", "VICE_ADMIN");

  const [schoolClass, setSchoolClass] = useState<SchoolClass | null>(null);
  const [students, setStudents] = useState<Student[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      // Chưa có GET /classes/:id riêng trong contract -> lấy từ danh sách lớp.
      const [allClasses, studentList] = await Promise.all([
        classesApi.list(tenant),
        studentsApi.list(tenant, { class_id: classId }),
      ]);
      const found = allClasses.find((c) => c.id === classId) ?? null;
      setSchoolClass(found);
      setStudents(studentList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải thông tin lớp học.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, classId]);

  return (
    <div>
      <Link href={`/${tenant}/classes`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
        ← Quay lại danh sách lớp
      </Link>

      {loading && <LoadingState label="Đang tải thông tin lớp học..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && !error && !schoolClass && (
        <EmptyState title="Không tìm thấy lớp học" description="Lớp học có thể đã bị xóa hoặc bạn không có quyền xem." />
      )}

      {!loading && schoolClass && (
        <>
          <PageHeader
            title={schoolClass.name}
            description={`${schoolClass.grade_name ?? "—"} · ${schoolClass.school_year_name ?? "—"}`}
            actions={canManage ? <Button onClick={() => setAssignOpen(true)}>＋ Phân công giáo viên</Button> : undefined}
          />

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Danh sách học sinh ({students?.length ?? 0}/{schoolClass.capacity})</CardTitle>
              </CardHeader>
              <CardContent>
                {students && students.length === 0 && (
                  <EmptyState title="Chưa có học sinh trong lớp" icon="🧒" />
                )}
                {students && students.length > 0 && (
                  <TableContainer>
                    <Table>
                      <Thead>
                        <Tr>
                          <Th>Họ tên</Th>
                          <Th>Tuổi</Th>
                          <Th>Trạng thái</Th>
                          <Th />
                        </Tr>
                      </Thead>
                      <Tbody>
                        {students.map((s) => (
                          <Tr key={s.id}>
                            <Td className="font-semibold text-ink-900">{s.full_name}</Td>
                            <Td>{calculateAge(s.dob)}</Td>
                            <Td>
                              <Badge tone={s.status === "enrolled" ? "mint" : s.status === "on_leave" ? "secondary" : "neutral"}>
                                {STUDENT_STATUS_LABELS[s.status]}
                              </Badge>
                            </Td>
                            <Td>
                              <Link href={`/${tenant}/students/${s.id}`} className="text-sm font-semibold text-primary-600 hover:underline">
                                Hồ sơ
                              </Link>
                            </Td>
                          </Tr>
                        ))}
                      </Tbody>
                    </Table>
                  </TableContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Giáo viên phụ trách</CardTitle>
              </CardHeader>
              <CardContent>
                {schoolClass.teachers && schoolClass.teachers.length > 0 ? (
                  <ul className="flex flex-col gap-2">
                    {schoolClass.teachers.map((t) => (
                      <li key={t.id} className="flex items-center justify-between rounded-2xl bg-cream-100 px-3 py-2">
                        <span className="text-sm font-semibold text-ink-800">{t.user_full_name ?? t.user_id}</span>
                        <Badge tone={t.role_in_class === "main" ? "primary" : "neutral"}>
                          {t.role_in_class === "main" ? "Chính" : "Phụ"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-ink-400">Chưa phân công giáo viên nào.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {canManage && (
            <AssignTeacherModal
              open={assignOpen}
              onClose={() => setAssignOpen(false)}
              tenant={tenant}
              classId={classId}
              onAssigned={load}
            />
          )}
        </>
      )}
    </div>
  );
}

function AssignTeacherModal({
  open,
  onClose,
  onAssigned,
  tenant,
  classId,
}: {
  open: boolean;
  onClose: () => void;
  onAssigned: () => void;
  tenant: string;
  classId: string;
}) {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [userId, setUserId] = useState("");
  const [roleInClass, setRoleInClass] = useState<"main" | "assistant">("main");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    usersApi
      .list(tenant)
      .then((users) => {
        const teacherLike = users.filter((u) =>
          u.roles?.some((r) => r === "TEACHER" || r === "ASSISTANT_TEACHER" || r === "HEAD_TEACHER")
        );
        setTeachers(teacherLike);
        setUserId(teacherLike[0]?.id ?? "");
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : "Không thể tải danh sách giáo viên."));
  }, [open, tenant]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!userId) {
      setError("Vui lòng chọn giáo viên.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await classesApi.assignTeacher(tenant, classId, { user_id: userId, role_in_class: roleInClass });
      onAssigned();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể phân công giáo viên.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Phân công giáo viên cho lớp">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        {teachers.length === 0 ? (
          <p className="text-sm text-ink-500">
            Chưa có tài khoản giáo viên nào. Hãy tạo tài khoản ở mục{" "}
            <Link href={`/${tenant}/staff`} className="font-semibold text-primary-600 hover:underline">
              Nhân sự
            </Link>{" "}
            trước.
          </p>
        ) : (
          <>
            <Select label="Giáo viên" required value={userId} onChange={(e) => setUserId(e.target.value)}>
              {teachers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.email})
                </option>
              ))}
            </Select>
            <Select
              label="Vai trò trong lớp"
              value={roleInClass}
              onChange={(e) => setRoleInClass(e.target.value as "main" | "assistant")}
            >
              <option value="main">Giáo viên chính</option>
              <option value="assistant">Giáo viên phụ</option>
            </Select>
          </>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={submitting} disabled={teachers.length === 0}>
            Phân công
          </Button>
        </div>
      </form>
    </Modal>
  );
}
