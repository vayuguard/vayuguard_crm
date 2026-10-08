import { describe, expect, it } from "vitest";
import {
  buildExcelBuffer,
  parseExcelBuffer,
  pickColumn,
} from "@/server/lib/excel";
import { CUSTOMER_EXCEL_HEADERS } from "@/server/services/customers.service";

describe("excel round-trip helpers", () => {
  it("exports and re-parses the same customer columns", () => {
    const row = Object.fromEntries(
      CUSTOMER_EXCEL_HEADERS.map((h) => [h, h === "name" ? "Acme" : ""]),
    ) as Record<string, string>;
    row.email = "a@acme.test";
    row.gstNumber = "27AABCU9603R1ZM";

    const buffer = buildExcelBuffer([row], "Customers");
    const parsed = parseExcelBuffer(buffer);
    expect(parsed).toHaveLength(1);
    expect(pickColumn(parsed[0]!, "name")).toBe("Acme");
    expect(pickColumn(parsed[0]!, "Email")).toBe("a@acme.test");
    expect(pickColumn(parsed[0]!, "gstNumber")).toBe("27AABCU9603R1ZM");
  });
});
