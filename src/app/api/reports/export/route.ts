import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { fail } from "@/server/api/response";
import { requirePermission } from "@/server/auth/session";
import { writeAuditLog } from "@/server/services/audit.service";
import {
  exportReport,
  reportQuerySchema,
} from "@/server/services/reports.service";
import { getClientIp } from "@/server/api/rate-limit";
import { searchParamsObject } from "@/lib/validators/common";

function flattenRows(report: {
  type: string;
  summary: Record<string, unknown>;
  rows: unknown;
}): Record<string, unknown>[] {
  const rows = report.rows;
  if (Array.isArray(rows)) {
    return rows.map((row) => {
      const r = row as Record<string, unknown>;
      const flat: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(r)) {
        if (v == null) flat[k] = "";
        else if (typeof v === "object") flat[k] = JSON.stringify(v);
        else flat[k] = v;
      }
      return flat;
    });
  }
  if (rows && typeof rows === "object") {
    const obj = rows as Record<string, unknown>;
    if (Array.isArray(obj.byStatus)) {
      return (obj.byStatus as { status: string; count: number }[]).map((r) => ({
        dimension: "status",
        ...r,
      }));
    }
  }
  return Object.entries(report.summary).map(([key, value]) => ({
    metric: key,
    value,
  }));
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "metric,value\n";
  const headers = [...new Set(rows.flatMap((r) => Object.keys(r)))];
  const escape = (v: unknown) => {
    const s = v == null ? "" : String(v);
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((h) => escape(row[h])).join(",")),
  ];
  return lines.join("\n");
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission("reports:export");
    const raw = searchParamsObject(request.nextUrl.searchParams);
    const query = reportQuerySchema.parse(raw);
    const format = (raw.format ?? "json").toLowerCase();
    const report = await exportReport(query);

    await writeAuditLog({
      action: "REPORT_EXPORT",
      entityType: "Report",
      userId: session.user.id,
      ipAddress: getClientIp(request),
      userAgent: request.headers.get("user-agent"),
      metadata: {
        type: query.type,
        from: query.from,
        to: query.to,
        format,
      },
    });

    const flat = flattenRows(report);
    const stamp = new Date().toISOString().slice(0, 10);
    const base = `report-${query.type}-${stamp}`;

    if (format === "csv") {
      const csv = toCsv(flat);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${base}.csv"`,
        },
      });
    }

    if (format === "xlsx" || format === "excel") {
      const sheet = XLSX.utils.json_to_sheet(flat.length ? flat : [{ empty: true }]);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Report");
      const summarySheet = XLSX.utils.json_to_sheet(
        Object.entries(report.summary).map(([metric, value]) => ({
          metric,
          value,
        })),
      );
      XLSX.utils.book_append_sheet(book, summarySheet, "Summary");
      const buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        },
      });
    }

    if (format === "pdf") {
      const lines = [
        `VayuCrm Report: ${report.type}`,
        `Exported: ${report.exportedAt}`,
        "",
        "Summary",
        ...Object.entries(report.summary).map(
          ([k, v]) => `  ${k}: ${String(v)}`,
        ),
        "",
        "Rows",
        ...flat.slice(0, 200).map((row) => `  ${JSON.stringify(row)}`),
      ];
      return new Response(lines.join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="${base}.txt"`,
        },
      });
    }

    // json / download
    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${base}.json"`,
      },
    });
  } catch (error) {
    return fail(error);
  }
}
