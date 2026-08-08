import { describe, expect, it } from "vitest";
import { hasPermission, ALL_PERMISSION_KEYS } from "@/lib/permissions";
import { paginationSchema } from "@/server/api/pagination";
import { NAV_ITEMS } from "@/lib/navigation";

describe("permissions", () => {
  it("allows wildcard", () => {
    expect(hasPermission(["*"], "leads:read")).toBe(true);
  });

  it("checks specific permissions", () => {
    expect(hasPermission(["leads:read"], "leads:write")).toBe(false);
    expect(hasPermission(["leads:read", "leads:write"], "leads:write")).toBe(
      true,
    );
  });

  it("has a complete permission catalog", () => {
    expect(ALL_PERMISSION_KEYS.length).toBeGreaterThan(20);
    expect(ALL_PERMISSION_KEYS).toContain("tasks:read");
    expect(ALL_PERMISSION_KEYS).toContain("reports:export");
    expect(ALL_PERMISSION_KEYS).toContain("documents:write");
  });
});

describe("navigation", () => {
  it("includes communications in the sidebar", () => {
    expect(NAV_ITEMS.some((item) => item.href === "/communications")).toBe(
      true,
    );
  });
});

describe("pagination", () => {
  it("parses defaults", () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
  });
});
