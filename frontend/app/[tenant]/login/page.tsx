"use client";

import { FormEvent, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { ApiError, getAccessToken } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { InlineAlert } from "@/components/ui/Feedback";

export default function TenantLoginPage() {
  const params = useParams<{ tenant: string }>();
  const tenant = params?.tenant ?? "";
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tenant && getAccessToken({ tenant })) {
      router.replace(`/${tenant}/dashboard`);
    }
  }, [tenant, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await authApi.login(tenant, email.trim(), password);
      router.push(`/${tenant}/dashboard`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(
          err.status === 404
            ? "Không tìm thấy trường này. Vui lòng kiểm tra lại đường dẫn."
            : err.message
        );
      } else {
        setError("Không thể đăng nhập. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-primary-100 via-cream-50 to-secondary-100 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500 text-xl shadow-sm shadow-primary-500/30">
              🌻
            </span>
            <span className="font-display text-lg font-bold text-ink-900">Mầm Non Số</span>
          </Link>
        </div>
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Đăng nhập</CardTitle>
            <CardDescription>
              Không gian trường <span className="font-semibold text-primary-600">{tenant}</span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && <InlineAlert tone="danger">{error}</InlineAlert>}
              <Input
                label="Email hoặc số điện thoại"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ten@truongmamnon.vn"
              />
              <Input
                label="Mật khẩu"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <Button type="submit" size="lg" loading={loading} fullWidth>
                Đăng nhập
              </Button>
            </form>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-sm text-ink-500">
          <Link href="/" className="font-semibold text-primary-700 underline underline-offset-2">
            ← Về trang chủ
          </Link>
        </p>
      </div>
    </main>
  );
}
