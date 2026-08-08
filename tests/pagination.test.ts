import { describe, expect, it } from "vitest";
import {
  getPagination,
  paginateMeta,
  paginationSchema,
} from "@/server/api/pagination";

describe("paginationSchema", () => {
  it("parses defaults", () => {
    const result = paginationSchema.parse({});
    expect(result.page).toBe(1);
    expect(result.pageSize).toBe(20);
    expect(result.order).toBe("desc");
  });

  it("coerces page and pageSize", () => {
    const result = paginationSchema.parse({
      page: "3",
      pageSize: "50",
      sort: "createdAt",
      order: "asc",
      q: "acme",
    });
    expect(result.page).toBe(3);
    expect(result.pageSize).toBe(50);
    expect(result.sort).toBe("createdAt");
    expect(result.order).toBe("asc");
    expect(result.q).toBe("acme");
  });

  it("rejects invalid pageSize", () => {
    expect(() => paginationSchema.parse({ pageSize: 0 })).toThrow();
    expect(() => paginationSchema.parse({ pageSize: 101 })).toThrow();
  });
});

describe("getPagination", () => {
  it("reads from URLSearchParams", () => {
    const params = new URLSearchParams({
      page: "2",
      pageSize: "10",
      q: "test",
    });
    const result = getPagination(params);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(10);
    expect(result.q).toBe("test");
  });
});

describe("paginateMeta", () => {
  it("computes totalPages", () => {
    expect(paginateMeta(0, 1, 20)).toEqual({
      page: 1,
      pageSize: 20,
      total: 0,
      totalPages: 1,
    });
    expect(paginateMeta(45, 2, 20)).toEqual({
      page: 2,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
  });
});
