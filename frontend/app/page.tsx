"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card } from "@/components/ui/Card";

const FEATURES = [
  { icon: "🏫", title: "Lớp học & khối", desc: "Quản lý năm học, khối, lớp và phân công giáo viên rõ ràng." },
  { icon: "🧒", title: "Hồ sơ học sinh", desc: "Theo dõi thông tin trẻ, liên kết phụ huynh, lịch sử chuyển lớp." },
  { icon: "✅", title: "Điểm danh nhanh", desc: "Điểm danh từng lớp theo ngày chỉ trong vài thao tác chạm." },
  { icon: "📔", title: "Nhật ký lớp học", desc: "Gửi hoạt động, hình ảnh trong ngày đến đúng phụ huynh." },
  { icon: "📣", title: "Thông báo", desc: "Gửi thông báo theo trường, khối hoặc lớp, đánh dấu khẩn cấp." },
  { icon: "🔐", title: "Phân quyền rõ ràng", desc: "12 vai trò, mỗi người chỉ thấy đúng phần việc của mình." },
];

function isValidSlug(value: string) {
  return /^mamnon_[a-z0-9_]+$/.test(value.trim());
}

export default function LandingPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = slug.trim();
  const valid = trimmed.length > 0 && isValidSlug(trimmed);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!valid) return;
    router.push(`/${trimmed}/login`);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-primary-50 via-cream-50 to-secondary-50">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 md:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500 text-xl shadow-sm shadow-primary-500/30">
            🌻
          </span>
          <span className="font-display text-lg font-bold text-ink-900">Mầm Non Số</span>
        </div>
        <Link
          href="/admin/login"
          className="rounded-2xl border-2 border-primary-200 bg-white px-4 py-2 text-sm font-semibold text-primary-700 transition-colors hover:bg-primary-50"
        >
          Cổng quản trị hệ thống
        </Link>
      </header>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 pt-6 md:grid-cols-2 md:items-center md:px-8 md:pt-14">
        <div>
          <span className="inline-block rounded-full bg-secondary-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-secondary-700">
            Nền tảng quản lý trường mầm non
          </span>
          <h1 className="mt-4 font-display text-3xl font-extrabold leading-tight text-ink-900 md:text-5xl">
            Kết nối nhà trường, giáo viên &amp; phụ huynh trong một mái nhà chung
          </h1>
          <p className="mt-4 max-w-xl text-base text-ink-700 md:text-lg">
            Mầm Non Số giúp mỗi trường mầm non quản lý lớp học, học sinh, điểm danh, nhật ký và
            thông báo dễ dàng, mỗi trường một không gian riêng, dữ liệu tách biệt và an toàn.
          </p>

          <Card className="mt-8 max-w-md p-5">
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <Input
                label="Vào không gian trường của bạn"
                placeholder="mamnon_tenten"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                onBlur={() => setTouched(true)}
                error={touched && trimmed.length > 0 && !valid ? "Mã trường không hợp lệ, ví dụ: mamnon_nguyensieu" : undefined}
                hint={!touched || trimmed.length === 0 ? "Nhập mã trường do nhà trường cung cấp, ví dụ: mamnon_nguyensieu" : undefined}
              />
              <Button type="submit" size="lg">
                Vào trường của tôi →
              </Button>
            </form>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <Card key={f.title} className="p-4 md:p-5">
              <div className="mb-2 text-2xl">{f.icon}</div>
              <p className="font-display text-sm font-bold text-ink-900 md:text-base">{f.title}</p>
              <p className="mt-1 text-xs text-ink-500 md:text-sm">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <footer className="border-t border-ink-100 bg-white/60 py-6 text-center text-xs text-ink-500">
        © {new Date().getFullYear()} Mầm Non Số — VietSoftware. Dành cho trường mầm non tại Việt Nam.
      </footer>
    </main>
  );
}
