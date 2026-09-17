"use client";

import { FormEvent, useEffect, useState } from "react";
import { useTenantAuth } from "@/lib/auth-context";
import { usersApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import type { RoleCode, User } from "@/lib/types";
import { ROLE_LABELS, STAFF_ROLE_CODES } from "@/lib/types";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { Avatar } from "@/components/ui/Avatar";
import { TableContainer, Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/Table";
import { LoadingState, ErrorState, EmptyState, InlineAlert } from "@/components/ui/Feedback";

const ASSIGNABLE_ROLES = STAFF_ROLE_CODES.filter((r) => r !== "SCHOOL_ADMIN");

export default function StaffPage() {
  const { hasRole, tenant } = useTenantAuth();
  const allowed = hasRole("SCHOOL_ADMIN", "VICE_ADMIN");

  const [users, setUsers] = useState<User[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await usersApi.list(tenant);
      setUsers(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tải danh sách nhân sự.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (allowed) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant, allowed]);

  if (!allowed) {
    return (
      <div>
        <PageHeader title="Nhân sự" />
        <ErrorState message="Bạn không có quyền truy cập trang này. Chỉ Hiệu trưởng/Hiệu phó mới quản lý được nhân sự." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Nhân sự"
        description="Tài khoản giáo viên và nhân viên trong trường."
        actions={<Button onClick={() => setCreateOpen(true)}>＋ Tạo tài khoản</Button>}
      />

      {loading && <LoadingState label="Đang tải danh sách nhân sự..." />}
      {!loading && error && <ErrorState message={error} onRetry={load} />}
      {!loading && !error && users && users.length === 0 && (
        <EmptyState title="Chưa có tài khoản nhân sự nào" action={<Button onClick={() => setCreateOpen(true)}>Tạo tài khoản</Button>} />
      )}
      {!loading && !error && users && users.length > 0 && (
        <TableContainer>
          <Table>
            <Thead>
              <Tr>
                <Th>Họ tên</Th>
                <Th>Email</Th>
                <Th>Vai trò</Th>
                <Th>Trạng thái</Th>
              </Tr>
            </Thead>
            <Tbody>
              {users.map((u) => (
                <Tr key={u.id}>
                  <Td>
                    <div className="flex items-center gap-3">
                      <Avatar name={u.full_name} src={u.avatar_url} size="sm" />
                      <span className="font-semibold text-ink-900">{u.full_name}</span>
                    </div>
                  </Td>
                  <Td>{u.email}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {(u.roles ?? []).map((r) => (
                        <Badge key={r} tone="primary">
                          {ROLE_LABELS[r] ?? r}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td>
                    <Badge tone={u.status === "active" ? "mint" : "danger"} dot>
                      {u.status === "active" ? "Đang hoạt động" : "Đã khóa"}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </TableContainer>
      )}

      <CreateStaffModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        tenant={tenant}
        onCreated={(u) => {
          setUsers((prev) => (prev ? [u, ...prev] : [u]));
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function CreateStaffModal({
  open,
  onClose,
  onCreated,
  tenant,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (u: User) => void;
  tenant: string;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [roles, setRoles] = useState<RoleCode[]>(["TEACHER"]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");
      setRoles(["TEACHER"]);
      setError(null);
    }
  }, [open]);

  function toggleRole(role: RoleCode) {
    setRoles((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (roles.length === 0) {
      setError("Vui lòng chọn ít nhất một vai trò.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await usersApi.create(tenant, {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        password,
        roles,
        status: "active",
      });
      onCreated(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Không thể tạo tài khoản.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Tạo tài khoản nhân sự" size="lg">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {error && <InlineAlert tone="danger">{error}</InlineAlert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Họ tên" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          <Input label="Email đăng nhập" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <Input
            label="Mật khẩu tạm thời"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div>
          <p className="mb-2 text-sm font-semibold text-ink-700">Vai trò (có thể chọn nhiều)</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ASSIGNABLE_ROLES.map((r) => (
              <label
                key={r}
                className="flex items-center gap-2 rounded-2xl border-2 border-ink-100 px-3 py-2 text-sm font-medium text-ink-700 has-[:checked]:border-primary-300 has-[:checked]:bg-primary-50"
              >
                <input
                  type="checkbox"
                  checked={roles.includes(r)}
                  onChange={() => toggleRole(r)}
                  className="h-4 w-4 rounded accent-primary-500"
                />
                {ROLE_LABELS[r]}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" loading={submitting}>
            Tạo tài khoản
          </Button>
        </div>
      </form>
    </Modal>
  );
}
