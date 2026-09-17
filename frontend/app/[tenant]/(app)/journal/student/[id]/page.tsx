"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { journalApi, studentsApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { DailyJournal, Student } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent } from "@/components/ui/Card";
import { Avatar } from "@/components/ui/Avatar";
import { LoadingState, ErrorState, EmptyState } from "@/components/ui/Feedback";
import { formatDate } from "@/lib/utils";

export default function StudentJournalPage() {
  const params = useParams<{ tenant: string; id: string }>();
  const tenant = params?.tenant ?? "";
  const studentId = params?.id ?? "";

  const [student, setStudent] = useState<Student | null>(null);
  const [entries, setEntries] = useState<DailyJournal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [s, list] = await Promise.all([
        studentsApi.get(tenant, studentId),
        journalApi.listByStudent(tenant, studentId),
      ]);
      setStudent(s);
      setEntries(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải nhật ký.");
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
      <Link href={`/${tenant}/journal`} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
        ← Quay lại
      </Link>

      {loading && <LoadingState label="Đang tải nhật ký..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}

      {!loading && student && (
        <>
          <PageHeader title={`Nhật ký của ${student.full_name}`} description={student.class_name ?? "Chưa xếp lớp"} />
          <div className="mb-4 flex items-center gap-3">
            <Avatar name={student.full_name} src={student.avatar_url} size="lg" />
          </div>

          {entries.length === 0 ? (
            <EmptyState title="Chưa có nhật ký nào" icon="📔" />
          ) : (
            <div className="flex flex-col gap-4">
              {entries
                .slice()
                .sort((a, b) => (a.date < b.date ? 1 : -1))
                .map((j) => (
                  <Card key={j.id}>
                    <CardContent className="pt-5">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{formatDate(j.date)}</p>
                        {j.author_full_name && <p className="text-xs text-ink-500">bởi {j.author_full_name}</p>}
                      </div>
                      <p className="whitespace-pre-wrap text-sm text-ink-800">{j.content}</p>
                      {j.photo_urls?.length > 0 && (
                        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                          {j.photo_urls.map((url, idx) => (
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
                ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
