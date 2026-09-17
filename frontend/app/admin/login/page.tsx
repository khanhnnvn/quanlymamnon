"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { systemApi } from "@/lib/api";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { InlineAlert } from "@/components/ui/Feedback";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await systemApi.login(email.trim(), password);
      router.push("/admin/tenants");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Không thể đăng nhập. Vui lòng thử lại.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-ink-900 via-ink-800 to-primary-900 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-cream-50">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500 text-xl">🌻</span>
            <span className="font-display text-lg font-bold">Mầm Non Số</span>
          </Link>
        </div>
        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle>Cổng quản trị hệ thống</CardTitle>
            <CardDescription>Dành cho quản trị viên VietSoftware quản lý toàn bộ các trường.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {error && <InlineAlert tone="danger">{error}</InlineAlert>}
              <Input
                label="Email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@vietsoftware.vn"
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
        <p className="mt-6 text-center text-sm text-cream-100/70">
          Là hiệu trưởng hoặc giáo viên?{" "}
          <Link href="/" className="font-semibold text-cream-50 underline underline-offset-2">
            Vào không gian trường của bạn
          </Link>
        </p>
      </div>
    </main>
  );
}
