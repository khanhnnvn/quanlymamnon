"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTenantAuth } from "@/lib/auth-context";
import { classesApi, studentsApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { SchoolClass, Student } from "@/lib/types";
import { STUDENT_STATUS_LABELS } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { LoadingState, ErrorState, EmptyState, InlineAlert } from "@/components/ui/Feedback";
import { calculateAge, todayISO } from "@/lib/utils";

export default function StudentsPage() {
  const { tenant, hasRole } = useTenantAuth();
  const canManage = hasRole("SCHOOL_ADMIN", "VICE_ADMIN", "TEACHER", "ASSISTANT_TEACHER");
  const isParent = hasRole("PARENT") && !canManage;

  const [students, setStudents] = useState<Student[] | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [studentList, classList] = await Promise.all([
        studentsApi.list(tenant),
        classesApi.list(tenant).catch(() => [] as SchoolClass[]),
      ]);
      setStudents(studentList);
      setClasses(classList);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải danh sách học sinh.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  const filtered = useMemo(() => {
    if (!students) return [];
    return students.filter((s) => {
      const matchesSearch = search.trim()
        ? s.full_name.toLowerCase().includes(search.trim().toLowerCase())
        : true;
      const matchesClass = classFilter ? s.current_class_id === classFilter : true;
      return matchesSearch && matchesClass;
    });
  }, [students, search, classFilter]);

  return (
    <div>
      <PageHeader
        title="Học sinh"
        description={isParent ? "Hồ sơ các con của bạn." : "Danh sách và hồ sơ học sinh trong trường."}
        actions={canManage ? <Button onClick={() => setCreateOpen(true)}>＋ Thêm học sinh</Button> : undefined}
      />

      {!isParent && (
        <div className="mb-4 flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Tìm theo tên học sinh..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select value={classFilter} onChange={(e) => setClassFilter(e.target.value)} className="sm:max-w-xs">
            <option value="">Tất cả các lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {loading && <LoadingState label="Đang tải danh sách học sinh..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState
          title="Chưa có học sinh nào"
          description={canManage ? "Thêm học sinh đầu tiên vào trường." : "Chưa có dữ liệu học sinh để hiển thị."}
          action={canManage ? <Button onClick={() => setCreateOpen(true)}>Thêm học sinh</Button> : undefined}
        />
      )}
      {!loading && !error && filtered.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Học sinh</Th>
                <Th>Tuổi</Th>
                <Th>Lớp</Th>
                <Th>Trạng thái</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {filtered.map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={s.full_name} src={s.avatar_url} size="sm" />
                      <span className="font-semibold text-ink-900">{s.full_name}</span>
                    </div>
                  </Td>
                  <Td>{calculateAge(s.dob)}</Td>
                  <Td>{s.class_name ?? classes.find((c) => c.id === s.current_class_id)?.name ?? "Chưa xếp lớp"}</Td>
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

      {canManage && (
        <CreateStudentModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          tenant={tenant}
          classes={classes}
          onCreated={(s) => {
            setStudents((prev) => (prev ? [s, ...prev] : [s]));
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CreateStudentModal({
  open,
  onClose,
  onCreated,
  tenant,
  classes,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (s: Student) => void;
  tenant: string;
  classes: SchoolClass[];
}) {
  const [fullName, setFullName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("male");
  const [classId, setClassId] = useState("");
  const [enrollmentDate, setEnrollmentDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFullName("");
      setDob("");
      setGender("male");
      setClassId(classes[0]?.id ?? "");
      setEnrollmentDate(todayISO());
      setNote("");
      setError(null);
    }
  }, [open, classes]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await studentsApi.create(tenant, {
        full_name: fullName.trim(),
        dob,
        gender,
        current_class_id: classId || null,
        enrollment_date: enrollmentDate,
        note: note.trim() || undefined,
        status: "enrolled",
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể thêm học sinh.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Thêm học sinh mới" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <Input label="Họ và tên" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Ngày sinh" type="date" required value={dob} onChange={(e) => setDob(e.target.value)} />
          <Select label="Giới tính" value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="male">Nam</option>
            <option value="female">Nữ</option>
          </Select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Lớp học" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Chưa xếp lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input
            label="Ngày nhập học"
            type="date"
            value={enrollmentDate}
            onChange={(e) => setEnrollmentDate(e.target.value)}
          />
        </div>
        <Input label="Ghi chú" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Dị ứng, lưu ý sức khỏe..." />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={submitting}>
            Thêm học sinh
          </Button>
        </div>
      </form>
    </Modal>
  );
}
