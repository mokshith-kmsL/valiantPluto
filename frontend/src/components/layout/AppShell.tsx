"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Sidebar from "./Sidebar";

const AUTH_PAGES = ["/login", "/forgot-password"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [checked, setChecked] = useState(false);

  const isAuthPage = AUTH_PAGES.some(p => pathname.startsWith(p));

  useEffect(() => {
    if (!isAuthPage) {
      const user = localStorage.getItem("ss_user");
      if (!user) {
        router.replace("/login");
        return;
      }
    }
    setChecked(true);
  }, [pathname, isAuthPage, router]);

  // Don't flash content before auth check
  if (!checked && !isAuthPage) return null;

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 min-w-0 flex flex-col">
        {children}
      </main>
    </div>
  );
}
