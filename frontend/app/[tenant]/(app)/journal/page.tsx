"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useTenantAuth } from "@/lib/auth-context";
import { classesApi, journalApi, studentsApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { DailyJournal, SchoolClass, Student } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Select } from "@/components/ui/Select";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { LoadingState, ErrorState, EmptyState, InlineAlert } from "@/components/ui/Feedback";
import { formatDateTime, todayISO } from "@/lib/utils";

export default function JournalPage() {
  return (
    <Suspense fallback={<LoadingState label="Đang tải..." />}>
      <JournalPageInner />
    </Suspense>
  );
}

function JournalPageInner() {
  const { tenant, hasRole } = useTenantAuth();
  const searchParams = useSearchParams();
  const canWrite = hasRole("SCHOOL_ADMIN", "VICE_ADMIN", "HEAD_TEACHER", "TEACHER", "ASSISTANT_TEACHER");
  const isParentOnly = hasRole("PARENT") && !canWrite;

  if (isParentOnly) return <ParentJournalView tenant={tenant} />;
  return <ClassJournalView tenant={tenant} initialClassId={searchParams?.get("class_id") ?? undefined} />;
}

function ClassJournalView({ tenant, initialClassId }: { tenant: string; initialClassId?: string }) {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState(initialClassId ?? "");
  const [date, setDate] = useState(todayISO());
  const [entries, setEntries] = useState<DailyJournal[]>([]);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [photoUrls, setPhotoUrls] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  async function loadEntries() {
    if (!classId) return;
    setLoadingEntries(true);
    setError(null);
    try {
      const data = await journalApi.listByClassDate(tenant, classId, date);
      setEntries(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải nhật ký lớp.");
    } finally {
      setLoadingEntries(false);
    }
  }

  useEffect(() => {
    if (classId) loadEntries();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!classId || !content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const urls = photoUrls
        .split(/\n|,/)
        .map((u) => u.trim())
        .filter(Boolean);
      const created = await journalApi.create(tenant, { class_id: classId, date, content: content.trim(), photo_urls: urls });
      setEntries((prev) => [created, ...prev]);
      setContent("");
      setPhotoUrls("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể đăng nhật ký.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader title="Nhật ký lớp học" description="Chia sẻ hoạt động trong ngày đến phụ huynh." />

      <div className="mb-5 flex flex-col gap-4 sm:flex-row">
        <Select label="Lớp học" value={classId} onChange={(e) => setClassId(e.target.value)} disabled={loadingClasses} className="sm:max-w-xs">
          {classes.length === 0 && <option value="">Chưa có lớp</option>}
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Input label="Ngày" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="sm:max-w-[180px]" />
      </div>

      {classId && (
        <Card className="mb-6">
          <CardContent className="pt-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              {error && <InlineAlert tone="danger">{error}</InlineAlert>}
              <Textarea
                label="Nội dung hoạt động hôm nay"
                required
                rows={3}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Hôm nay các con đã cùng nhau vẽ tranh chủ đề gia đình..."
              />
              <Input
                label="Đường dẫn hình ảnh (mỗi dòng hoặc dấu phẩy)"
                value={photoUrls}
                onChange={(e) => setPhotoUrls(e.target.value)}
                placeholder="https://..."
                hint="v1 chưa hỗ trợ tải ảnh trực tiếp, dán đường dẫn ảnh đã có sẵn"
              />
              <div className="flex justify-end">
                <Button type="submit" loading={submitting}>
                  Đăng nhật ký
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loadingClasses && <LoadingState label="Đang tải danh sách lớp..." />}
      {!loadingClasses && classes.length === 0 && <EmptyState title="Chưa có lớp học nào" icon="🏫" />}
      {!loadingClasses && classId && loadingEntries && <LoadingState label="Đang tải nhật ký..." />}
      {!loadingClasses && classId && !loadingEntries && entries.length === 0 && (
        <EmptyState title="Chưa có nhật ký cho ngày này" icon="📔" />
      )}
      {!loadingEntries && entries.length > 0 && (
        <div className="flex flex-col gap-4">
          {entries.map((j) => (
            <JournalEntryCard key={j.id} entry={j} />
          ))}
        </div>
      )}
    </div>
  );
}

function JournalEntryCard({ entry }: { entry: DailyJournal }) {
  return (
    <Card>
      <CardContent className="pt-5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{formatDateTime(entry.created_at)}</p>
          {entry.author_full_name && <p className="text-xs text-ink-500">bởi {entry.author_full_name}</p>}
        </div>
        <p className="whitespace-pre-wrap text-sm text-ink-800">{entry.content}</p>
        {entry.photo_urls?.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {entry.photo_urls.map((url, idx) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={idx}
                src={url}
                alt={`Hình ảnh nhật ký ${idx + 1}`}
                className="h-28 w-full rounded-2xl object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ParentJournalView({ tenant }: { tenant: string }) {
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
      <PageHeader title="Nhật ký lớp học" description="Xem nhật ký hằng ngày của con bạn." />
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
                <Link href={`/${tenant}/journal/student/${c.id}`} className="text-sm font-semibold text-primary-600 hover:underline">
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
