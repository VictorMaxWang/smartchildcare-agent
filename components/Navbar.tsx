"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Baby, BookHeart, BrainCircuit, House, Monitor, Salad, ShieldCheck, Users } from "lucide-react";
import { getRoleAgentPath, getRoleHomePath } from "@/lib/auth/accounts";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import MobileNav from "@/components/MobileNav";
import { Button } from "@/components/ui/button";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const { currentUser, logout } = useApp();

  if (pathname === "/login") {
    return null;
  }

  const homeHref = getRoleHomePath(currentUser.role);
  const agentHref = getRoleAgentPath(currentUser.role);
  const navItems = [
    { href: homeHref, label: "首页", icon: House },
    { href: agentHref, label: "AI 助手", icon: BrainCircuit },
    { href: "/children", label: "儿童档案", icon: Users },
    { href: "/health", label: "晨检与健康", icon: ShieldCheck },
    { href: "/growth", label: "成长观察", icon: BookHeart },
    { href: "/diet", label: "饮食记录", icon: Salad },
    currentUser.role === "机构管理员"
      ? { href: "/admin", label: "园所首页", icon: Monitor }
      : { href: homeHref, label: currentUser.role === "教师" ? "教师首页" : "家长首页", icon: Baby },
  ];

  async function handleLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <nav className="sticky top-0 z-40 border-b border-white/60 bg-white/75 shadow-sm backdrop-blur-xl after:absolute after:bottom-0 after:left-0 after:h-px after:w-full after:bg-linear-to-r after:from-indigo-500/20 after:via-violet-500/20 after:to-transparent after:content-['']">
      <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Link href={homeHref} className="group flex items-center gap-3 font-bold text-(--primary)">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-indigo-100 to-sky-100 shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5">
            <Baby className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <span className="block text-base leading-none">普惠托育智慧平台</span>
            <span className="mt-1 hidden text-[11px] font-medium text-slate-400 sm:block">
              Smart Childcare Operations Suite
            </span>
          </div>
        </Link>

        <div className="hidden flex-1 items-center justify-center gap-1 overflow-x-auto md:flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = href === homeHref ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={`${href}-${label}`}
                href={href}
                className={cn(
                  "relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors after:absolute after:bottom-0 after:left-4 after:h-0.5 after:rounded-full after:transition-all after:duration-300 after:content-['']",
                  active
                    ? "bg-indigo-50/70 text-indigo-600 after:w-[calc(100%-2rem)] after:bg-indigo-500"
                    : "text-slate-600 after:w-0 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <div className="rounded-2xl border border-indigo-100 bg-white/70 px-4 py-2 text-right shadow-sm ring-2 ring-indigo-100">
            <p className="text-xs text-slate-400">当前身份</p>
            <p className="text-sm font-semibold text-slate-700">
              {currentUser.avatar} {currentUser.name} · {currentUser.role}
            </p>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            退出登录
          </Button>
        </div>

        <MobileNav onLogout={handleLogout} />
      </div>
    </nav>
  );
}
