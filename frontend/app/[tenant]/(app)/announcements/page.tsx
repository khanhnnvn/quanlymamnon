"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTenantAuth } from "@/lib/auth-context";
import { announcementsApi, classesApi, gradesApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { Announcement, AnnouncementAudience, Grade, SchoolClass } from "@/lib/types";
import { ANNOUNCEMENT_AUDIENCE_LABELS } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Modal } from "@/components/ui/Modal";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { LoadingState, ErrorState, EmptyState, InlineAlert } from "@/components/ui/Feedback";
import { formatDateTime } from "@/lib/utils";

export default function AnnouncementsPage() {
  const { tenant, hasRole } = useTenantAuth();
  const canCreate = hasRole("SCHOOL_ADMIN", "VICE_ADMIN", "HEAD_TEACHER", "TEACHER", "ASSISTANT_TEACHER");
  const canSchoolWide = hasRole("SCHOOL_ADMIN", "VICE_ADMIN");

  const [items, setItems] = useState<Announcement[] | null>(null);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [list, cls, gr] = await Promise.all([
        announcementsApi.list(tenant),
        classesApi.list(tenant).catch(() => [] as SchoolClass[]),
        gradesApi.list(tenant).catch(() => [] as Grade[]),
      ]);
      setItems(list);
      setClasses(cls);
      setGrades(gr);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải thông báo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant]);

  const sorted = (items ?? [])
    .slice()
    .sort((a, b) => Number(b.is_urgent) - Number(a.is_urgent) || (a.created_at < b.created_at ? 1 : -1));

  return (
    <div>
      <PageHeader
        title="Thông báo"
        description="Tin tức và thông báo từ nhà trường."
        actions={canCreate ? <Button onClick={() => setCreateOpen(true)}>＋ Tạo thông báo</Button> : undefined}
      />

      {loading && <LoadingState label="Đang tải thông báo..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && sorted.length === 0 && (
        <EmptyState
          title="Chưa có thông báo nào"
          icon="📣"
          action={canCreate ? <Button onClick={() => setCreateOpen(true)}>Tạo thông báo</Button> : undefined}
        />
      )}
      {!loading && !error && sorted.length > 0 && (
        <div className="flex flex-col gap-3">
          {sorted.map((a) => (
            <Card key={a.id} className={a.is_urgent ? "border-danger-200" : undefined}>
              <CardContent className="pt-5">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {a.is_urgent && <Badge tone="danger">Khẩn</Badge>}
                  <Badge tone="neutral">{ANNOUNCEMENT_AUDIENCE_LABELS[a.audience]}</Badge>
                  <p className="font-display font-semibold text-ink-900">{a.title}</p>
                </div>
                <p className="whitespace-pre-wrap text-sm text-ink-700">{a.content}</p>
                <p className="mt-2 text-xs text-ink-400">
                  {formatDateTime(a.published_at ?? a.created_at)}
                  {a.author_full_name && ` · ${a.author_full_name}`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {canCreate && (
        <CreateAnnouncementModal
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          tenant={tenant}
          classes={classes}
          grades={grades}
          canSchoolWide={canSchoolWide}
          onCreated={(a) => {
            setItems((prev) => (prev ? [a, ...prev] : [a]));
            setCreateOpen(false);
          }}
        />
      )}
    </div>
  );
}

function CreateAnnouncementModal({
  open,
  onClose,
  onCreated,
  tenant,
  classes,
  grades,
  canSchoolWide,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (a: Announcement) => void;
  tenant: string;
  classes: SchoolClass[];
  grades: Grade[];
  canSchoolWide: boolean;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>(canSchoolWide ? "school" : "class");
  const [gradeId, setGradeId] = useState(grades[0]?.id ?? "");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [isUrgent, setIsUrgent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setContent("");
      setAudience(canSchoolWide ? "school" : "class");
      setGradeId(grades[0]?.id ?? "");
      setClassId(classes[0]?.id ?? "");
      setIsUrgent(false);
      setError(null);
    }
  }, [open, canSchoolWide, grades, classes]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const created = await announcementsApi.create(tenant, {
        title: title.trim(),
        content: content.trim(),
        audience,
        grade_id: audience === "grade" ? gradeId : null,
        class_id: audience === "class" ? classId : null,
        is_urgent: isUrgent,
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo thông báo.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo thông báo mới" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <Input label="Tiêu đề" required value={title} onChange={(e) => setTitle(e.target.value)} />
        <Textarea label="Nội dung" required rows={4} value={content} onChange={(e) => setContent(e.target.value)} />
        <Select
          label="Phạm vi gửi"
          value={audience}
          onChange={(e) => setAudience(e.target.value as AnnouncementAudience)}
        >
          {canSchoolWide && <option value="school">Toàn trường</option>}
          {canSchoolWide && <option value="grade">Một khối</option>}
          <option value="class">Một lớp</option>
        </Select>
        {audience === "grade" && (
          <Select label="Chọn khối" required value={gradeId} onChange={(e) => setGradeId(e.target.value)}>
            {grades.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Select>
        )}
        {audience === "class" && (
          <Select label="Chọn lớp" required value={classId} onChange={(e) => setClassId(e.target.value)}>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
        <label className="flex items-center gap-2 text-sm font-medium text-ink-700">
          <input type="checkbox" checked={isUrgent} onChange={(e) => setIsUrgent(e.target.checked)} className="h-4 w-4 rounded accent-danger-500" />
          Đánh dấu là thông báo khẩn
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={submitting}>
            Gửi thông báo
          </Button>
        </div>
      </form>
    </Modal>
  );
}
