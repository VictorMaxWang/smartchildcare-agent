import type { AccountRole } from "../auth/accounts";

export type PrimaryNavIconKey =
  | "overview"
  | "role-home"
  | "children"
  | "health"
  | "growth"
  | "diet"
  | "parent"
  | "screen";

export interface PrimaryNavItem {
  href: string;
  label: string;
  icon: PrimaryNavIconKey;
}

const BASE_ITEMS: PrimaryNavItem[] = [
  { href: "/", label: "数据概览", icon: "overview" },
  { href: "/children", label: "幼儿档案", icon: "children" },
  { href: "/health", label: "晨检与健康", icon: "health" },
  { href: "/growth", label: "成长行为", icon: "growth" },
  { href: "/diet", label: "饮食记录", icon: "diet" },
  { href: "/parent", label: "家长端", icon: "parent" },
  { href: "/teacher", label: "机构大屏", icon: "screen" },
];

export function getRoleStandaloneHomeItem(role: AccountRole): PrimaryNavItem | null {
  if (role === "机构管理员") {
    return { href: "/admin", label: "园所首页", icon: "role-home" };
  }

  if (role === "教师") {
    return { href: "/teacher/home", label: "教师首页", icon: "role-home" };
  }

  return null;
}

export function buildPrimaryNavItems(role: AccountRole): PrimaryNavItem[] {
  const roleHomeItem = getRoleStandaloneHomeItem(role);

  if (!roleHomeItem) {
    return [...BASE_ITEMS];
  }

  return [BASE_ITEMS[0], roleHomeItem, ...BASE_ITEMS.slice(1)];
}

export function isPrimaryNavItemActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
