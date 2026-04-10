import assert from "node:assert/strict";
import test from "node:test";

import { getDemoAccountById } from "../auth/accounts.ts";
import { buildPrimaryNavItems } from "./primary-nav.ts";

test("admin nav keeps root overview and institution home as separate entries", () => {
  const navItems = buildPrimaryNavItems(getDemoAccountById("u-admin")!.role);

  assert.equal(navItems[0]?.href, "/");
  assert.equal(navItems[0]?.label, "数据概览");
  assert.equal(navItems[1]?.href, "/admin");
  assert.equal(navItems[1]?.label, "园所首页");
  assert.equal(navItems.filter((item) => item.href === "/").length, 1);
  assert.equal(navItems.filter((item) => item.href === "/admin").length, 1);
  assert.ok(navItems.some((item) => item.href === "/teacher" && item.label === "机构大屏"));
});

test("teacher nav keeps root overview, teacher home, and institution screen separate", () => {
  const navItems = buildPrimaryNavItems(getDemoAccountById("u-teacher")!.role);

  assert.equal(navItems[0]?.href, "/");
  assert.equal(navItems[1]?.href, "/teacher/home");
  assert.equal(navItems[1]?.label, "教师首页");
  assert.ok(navItems.some((item) => item.href === "/teacher" && item.label === "机构大屏"));
});

test("parent nav is scoped to parent home only", () => {
  const navItems = buildPrimaryNavItems(getDemoAccountById("u-parent")!.role);

  assert.equal(navItems.length, 1);
  assert.equal(navItems[0]?.href, "/parent");
  assert.equal(navItems[0]?.label, "家长首页");
  assert.equal(navItems.some((item) => item.href === "/"), false);
  assert.equal(navItems.some((item) => item.href === "/teacher"), false);
});
