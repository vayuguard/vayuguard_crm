import * as XLSX from "xlsx";

export type ExcelRow = Record<string, string>;

/** Normalize spreadsheet cell values to trimmed strings. */
export function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return String(value).trim();
}

/** Read first sheet of an .xlsx/.xls buffer into header-keyed rows. */
export function parseExcelBuffer(buffer: ArrayBuffer | Buffer): ExcelRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });

  return raw.map((row) => {
    const out: ExcelRow = {};
    for (const [key, value] of Object.entries(row)) {
      out[key.trim()] = cellToString(value);
    }
    return out;
  });
}

/** Build an .xlsx buffer from JSON rows (same headers used for import). */
export function buildExcelBuffer(
  rows: Array<Record<string, unknown>>,
  sheetName = "Sheet1",
): Buffer {
  const sheet = XLSX.utils.json_to_sheet(rows.length ? rows : [{}]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, sheetName.slice(0, 31));
  return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

/** Empty template with only the header row. */
export function buildExcelTemplate(
  headers: string[],
  sheetName = "Sheet1",
): Buffer {
  const row: Record<string, string> = {};
  for (const h of headers) row[h] = "";
  return buildExcelBuffer([row], sheetName);
}

export function excelDownloadResponse(
  buffer: Buffer,
  filename: string,
): Response {
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Case-insensitive column lookup (supports Name / name). */
export function pickColumn(
  row: ExcelRow,
  ...keys: string[]
): string {
  const map = new Map(
    Object.entries(row).map(([k, v]) => [k.trim().toLowerCase(), v]),
  );
  for (const key of keys) {
    const hit = map.get(key.toLowerCase());
    if (hit !== undefined && hit !== "") return hit;
  }
  return "";
}

export async function readUploadBuffer(request: Request): Promise<Buffer> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new Error("Excel file is required (field name: file)");
    }
    return Buffer.from(await file.arrayBuffer());
  }

  const body = await request.arrayBuffer();
  if (!body.byteLength) {
    throw new Error("Empty upload");
  }
  return Buffer.from(body);
}
