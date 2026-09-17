"use client";

import { useParams } from "next/navigation";
import { TenantAuthProvider } from "@/lib/auth-context";
import { AppShell } from "@/components/tenant/AppShell";

export default function TenantAppLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ tenant: string }>();
  const tenant = params?.tenant ?? "";

  return (
    <TenantAuthProvider tenant={tenant}>
      <AppShell>{children}</AppShell>
    </TenantAuthProvider>
  );
}
