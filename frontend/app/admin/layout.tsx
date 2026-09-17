import { SystemAuthProvider } from "@/lib/auth-context";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <SystemAuthProvider>{children}</SystemAuthProvider>;
}
