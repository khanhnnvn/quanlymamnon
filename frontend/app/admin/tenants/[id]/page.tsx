"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { LoadingState, ErrorState, InlineAlert } from "@/components/ui/Feedback";
import { systemApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { Tenant, TenantStatus } from "@/lib/types";
import { formatDateTime } from "@/lib/utils";

const STATUS_TONE: Record<TenantStatus, BadgeTone> = {
  pending: "secondary",
  active: "mint",
  suspended: "danger",
  archived: "neutral",
};
const STATUS_LABEL: Record<TenantStatus, string> = {
  pending: "Chờ kích hoạt",
  active: "Đang hoạt động",
  suspended: "Tạm khóa",
  archived: "Đã lưu trữ",
};

const TRANSITIONS: Record<TenantStatus, { to: TenantStatus; label: string; variant: "primary" | "danger" | "outline" }[]> = {
  pending: [{ to: "active", label: "Kích hoạt trường", variant: "primary" }],
  active: [{ to: "suspended", label: "Tạm khóa trường", variant: "danger" }],
  suspended: [
    { to: "active", label: "Mở khóa trường", variant: "primary" },
    { to: "archived", label: "Lưu trữ trường", variant: "outline" },
  ],
  archived: [],
};

export default function TenantDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;

  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function load() {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const data = await systemApi.getTenant(id);
      setTenant(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải thông tin trường.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function changeStatus(to: TenantStatus) {
    if (!id) return;
    setUpdating(true);
    setNotice(null);
    setError(null);
    try {
      const updated = await systemApi.updateTenant(id, { status: to });
      setTenant(updated);
      setNotice(`Đã chuyển trạng thái trường sang "${STATUS_LABEL[to]}".`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể cập nhật trạng thái trường.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <AdminShell>
      <Link href="/admin/tenants" className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-600 hover:underline">
        ← Quay lại danh sách trường
      </Link>

      {loading && <LoadingState label="Đang tải thông tin trường..." />}
      {!loading && error && !tenant && <ErrorState message={error} onRetry={load} />}

      {!loading && tenant && (
        <>
          <PageHeader
            title={tenant.name}
            description={`Mã trường: ${tenant.slug}`}
            actions={<Badge tone={STATUS_TONE[tenant.status]} dot>{STATUS_LABEL[tenant.status]}</Badge>}
          />

          {notice && (
            <div className="mb-4">
              <InlineAlert tone="success">{notice}</InlineAlert>
            </div>
          )}
          {error && (
            <div className="mb-4">
              <InlineAlert tone="danger">{error}</InlineAlert>
            </div>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Thông tin trường</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid gap-4 sm:grid-cols-2">
                  <Info label="Địa chỉ" value={tenant.address} />
                  <Info label="Điện thoại" value={tenant.phone} />
                  <Info label="Email" value={tenant.email} />
                  <Info label="Gói dịch vụ" value={tenant.plan} />
                  <Info label="Ngày tạo" value={formatDateTime(tenant.created_at)} />
                  <Info label="Cập nhật gần nhất" value={formatDateTime(tenant.updated_at)} />
                  {typeof tenant.student_count === "number" && (
                    <Info label="Số học sinh" value={String(tenant.student_count)} />
                  )}
                  {typeof tenant.user_count === "number" && (
                    <Info label="Số người dùng" value={String(tenant.user_count)} />
                  )}
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Vòng đời trường</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-sm text-ink-500">
                  pending → active → suspended → archived. Super Admin không truy cập trực tiếp dữ
                  liệu nghiệp vụ của trường.
                </p>
                <div className="flex flex-col gap-2">
                  {TRANSITIONS[tenant.status].length === 0 && (
                    <p className="text-sm italic text-ink-400">Không còn thao tác chuyển trạng thái.</p>
                  )}
                  {TRANSITIONS[tenant.status].map((t) => (
                    <Button
                      key={t.to}
                      variant={t.variant}
                      loading={updating}
                      onClick={() => changeStatus(t.to)}
                    >
                      {t.label}
                    </Button>
                  ))}
                  <Button
                    variant="outline"
                    onClick={() => router.push(`/${tenant.slug}/login`)}
                  >
                    Mở cổng đăng nhập trường ↗
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </AdminShell>
  );
}

function Info({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-ink-800">{value || "—"}</dd>
    </div>
  );
}
