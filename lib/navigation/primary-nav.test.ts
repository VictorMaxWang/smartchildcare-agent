import assert from "node:assert/strict";
import test from "node:test";

import { buildPrimaryNavItems } from "./primary-nav.ts";

test("admin nav keeps root overview and institution home as separate entries", () => {
  const navItems = buildPrimaryNavItems("机构管理员");

  assert.equal(navItems[0]?.href, "/");
  assert.equal(navItems[0]?.label, "数据概览");
  assert.equal(navItems[1]?.href, "/admin");
  assert.equal(navItems[1]?.label, "园所首页");
  assert.equal(navItems.filter((item) => item.href === "/").length, 1);
  assert.equal(navItems.filter((item) => item.href === "/admin").length, 1);
  assert.ok(navItems.some((item) => item.href === "/teacher" && item.label === "机构大屏"));
});

test("teacher nav keeps root overview, teacher home, and institution screen separate", () => {
  const navItems = buildPrimaryNavItems("教师");

  assert.equal(navItems[0]?.href, "/");
  assert.equal(navItems[1]?.href, "/teacher/home");
  assert.equal(navItems[1]?.label, "教师首页");
  assert.ok(navItems.some((item) => item.href === "/teacher" && item.label === "机构大屏"));
});
