"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { LoadingState, ErrorState, EmptyState, InlineAlert } from "@/components/ui/Feedback";
import { systemApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { Tenant, TenantStatus } from "@/lib/types";
import { formatDate, slugifyTenant } from "@/lib/utils";

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

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await systemApi.listTenants();
      setTenants(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải danh sách trường.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <AdminShell>
      <PageHeader
        title="Danh sách trường"
        description="Quản lý các trường mầm non đang sử dụng nền tảng."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <span aria-hidden="true">＋</span> Tạo trường mới
          </Button>
        }
      />

      {loading && <LoadingState label="Đang tải danh sách trường..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && tenants && tenants.length === 0 && (
        <EmptyState
          title="Chưa có trường nào"
          description="Tạo trường đầu tiên để bắt đầu sử dụng hệ thống."
          action={<Button onClick={() => setCreateOpen(true)}>Tạo trường mới</Button>}
        />
      )}
      {!loading && !error && tenants && tenants.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Tên trường</Th>
                <Th>Mã trường (slug)</Th>
                <Th>Gói dịch vụ</Th>
                <Th>Trạng thái</Th>
                <Th>Ngày tạo</Th>
                <Th />
              </Tr>
            </Thead>
            <Tbody>
              {tenants.map((t) => (
                <Tr key={t.id}>
                  <Td className="font-semibold text-ink-900">{t.name}</Td>
                  <Td>
                    <code className="rounded-lg bg-ink-50 px-2 py-1 text-xs">{t.slug}</code>
                  </Td>
                  <Td>{t.plan || "—"}</Td>
                  <Td>
                    <Badge tone={STATUS_TONE[t.status]} dot>
                      {STATUS_LABEL[t.status]}
                    </Badge>
                  </Td>
                  <Td>{formatDate(t.created_at)}</Td>
                  <Td>
                    <Link
                      href={`/admin/tenants/${t.id}`}
                      className="text-sm font-semibold text-primary-600 hover:underline"
                    >
                      Xem chi tiết
                    </Link>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      <CreateTenantModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(t) => {
          setTenants((prev) => (prev ? [t, ...prev] : [t]));
          setCreateOpen(false);
        }}
      />
    </AdminShell>
  );
}

function CreateTenantModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (t: Tenant) => void;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("standard");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slugTouched) setSlug(slugifyTenant(name));
  }, [name, slugTouched]);

  useEffect(() => {
    if (!open) {
      setName("");
      setSlug("");
      setSlugTouched(false);
      setAddress("");
      setPhone("");
      setEmail("");
      setPlan("standard");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      setError(null);
    }
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const tenant = await systemApi.createTenant({
        name: name.trim(),
        slug: slug.trim(),
        address: address.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        plan,
        admin_full_name: adminName.trim(),
        admin_email: adminEmail.trim(),
        admin_password: adminPassword,
      });
      onCreated(tenant);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo trường. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo trường mới" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Tên trường" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Mầm non Nguyễn Siêu" />
          <Input
            label="Mã trường (slug)"
            required
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value);
            }}
            hint="Dạng mamnon_[a-z0-9_]+, dùng trong đường dẫn truy cập"
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Địa chỉ" value={address} onChange={(e) => setAddress(e.target.value)} />
          <Input label="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Email trường" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Select label="Gói dịch vụ" value={plan} onChange={(e) => setPlan(e.target.value)}>
            <option value="standard">Standard</option>
            <option value="pro">Pro</option>
            <option value="trial">Dùng thử</option>
          </Select>
        </div>

        <div className="rounded-2xl bg-cream-100 p-4">
          <p className="mb-3 text-sm font-bold text-ink-800">Tài khoản Hiệu trưởng đầu tiên</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Họ tên"
              required
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
            />
            <Input
              label="Email đăng nhập"
              type="email"
              required
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <Input
              label="Mật khẩu tạm thời"
              type="text"
              required
              minLength={6}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              hint="Gửi cho Hiệu trưởng, yêu cầu đổi mật khẩu ở lần đăng nhập đầu"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={submitting}>
            Tạo trường
          </Button>
        </div>
      </form>
    </Modal>
  );
}
