"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getDefaultLandingPath } from "@/lib/auth/accounts";
import { useApp } from "@/lib/store";

export default function RootPage() {
  const router = useRouter();
  const { authLoading, isAuthenticated, currentUser } = useApp();

  useEffect(() => {
    if (authLoading) return;
    router.replace(isAuthenticated ? getDefaultLandingPath(currentUser.role) : "/login");
  }, [authLoading, currentUser.role, isAuthenticated, router]);

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center px-6">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-200 border-t-indigo-600" />
        <p className="text-sm text-slate-500">正在进入角色首页…</p>
      </div>
    </div>
  );
}
