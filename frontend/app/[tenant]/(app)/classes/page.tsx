"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useTenantAuth } from "@/lib/auth-context";
import { classesApi, gradesApi, schoolYearsApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { Grade, SchoolClass, SchoolYear } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { LoadingState, ErrorState, EmptyState, InlineAlert } from "@/components/ui/Feedback";

export default function ClassesPage() {
  const { tenant, hasRole } = useTenantAuth();
  const canManage = hasRole("SCHOOL_ADMIN", "VICE_ADMIN");

  const [classes, setClasses] = useState<SchoolClass[] | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [cls, gr, sy] = await Promise.all([
        classesApi.list(tenant),
        gradesApi.list(tenant),
        schoolYearsApi.list(tenant),
      ]);
      setClasses(cls);
      setGrades(gr);
      setSchoolYears(sy);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải danh sách lớp học.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  const gradeMap = useMemo(() => new Map(grades.map((g) => [g.id, g.name])), [grades]);
  const yearMap = useMemo(() => new Map(schoolYears.map((y) => [y.id, y.name])), [schoolYears]);

  return (
    <div>
      <PageHeader
        title="Lớp học"
        description="Danh sách lớp theo khối và năm học."
        actions={canManage ? <Button onClick={() => setCreateOpen(true)}>＋ Tạo lớp mới</Button> : undefined}
      />

      {loading && <LoadingState label="Đang tải danh sách lớp..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && classes && classes.length === 0 && (
        <EmptyState
          title="Chưa có lớp học nào"
          description={canManage ? "Tạo lớp học đầu tiên cho trường của bạn." : "Nhà trường chưa tạo lớp học nào."}
          action={canManage ? <Button onClick={() => setCreateOpen(true)}>Tạo lớp mới</Button> : undefined}
        />
      )}
      {!loading && !error && classes && classes.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Tên lớp</Th>
                <Th>Khối</Th>
                <Th>Năm học</Th>
                <Th>Sĩ số / Sức chứa</Th>
                <Th>Giáo viên</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {classes.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-semibold text-ink-900">{c.name}</Td>
                  <Td>{c.grade_name ?? gradeMap.get(c.grade_id) ?? "—"}</Td>
                  <Td>{c.school_year_name ?? yearMap.get(c.school_year_id) ?? "—"}</Td>
                  <Td>
                    {c.student_count ?? "—"} / {c.capacity}
                  </Td>
                  <Td>
                    {c.teachers && c.teachers.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {c.teachers.map((t) => (
                          <Badge key={t.id} tone={t.role_in_class === "main" ? "primary" : "neutral"}>
                            {t.user_full_name ?? "GV"}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="text-ink-400">Chưa phân công</span>
                    )}
                  </Td>
                  <Td>
                    <Link href={`/${tenant}/classes/${c.id}`} className="text-sm font-semibold text-primary-600 hover:underline">
                      Chi tiết
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      {canManage && (
        <CreateClassModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          grades={grades}
          schoolYears={schoolYears}
          tenant={tenant}
          onCreated={(c) => {
            setClasses((prev) => (prev ? [c, ...prev] : [c]));
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CreateClassModal({
  open,
  onClose,
  onCreated,
  grades,
  schoolYears,
  tenant,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (c: SchoolClass) => void;
  grades: Grade[];
  schoolYears: SchoolYear[];
  tenant: string;
}) {
  const [name, setName] = useState("");
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? "");
  const [schoolYearId, setSchoolYearId] = useState(
    schoolYears.find((y) => y.is_current)?.id ?? schoolYears[0]?.id ?? ""
  );
  const [capacity, setCapacity] = useState(25);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setGradeId(grades[0]?.id ?? "");
      setSchoolYearId(schoolYears.find((y) => y.is_current)?.id ?? schoolYears[0]?.id ?? "");
      setName("");
      setCapacity(25);
      setError(null);
    }
  }, [open, grades, schoolYears]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!gradeId || !schoolYearId) {
      setError("Trường cần có ít nhất một khối và một năm học trước khi tạo lớp.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await classesApi.create(tenant, {
        name: name.trim(),
        grade_id: gradeId,
        school_year_id: schoolYearId,
        capacity,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo lớp học.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo lớp học mới">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <Input label="Tên lớp" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Lớp Chồi 1" />
        <Select label="Khối" required value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
          {grades.length === 0 && <option value="">Chưa có khối nào</option>}
          {grades.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
        <Select label="Năm học" required value={schoolYearId} onChange={(e) => setSchoolYearId(e.target.value)}>
          {schoolYears.length === 0 && <option value="">Chưa có năm học nào</option>}
          {schoolYears.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
              {y.is_current ? " (hiện hành)" : ""}
            </option>
          ))}
        </Select>
        <Input
          label="Sức chứa"
          type="number"
          min={1}
          required
          value={capacity}
          onChange={(e) => setCapacity(Number(e.target.value))}
        />
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={submitting}>
            Tạo lớp
          </Button>
        </div>
      </form>
    </Modal>
  );
}
