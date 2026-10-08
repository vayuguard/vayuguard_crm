"use client";

import * as React from "react";
import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

type BulkExcelActionsProps = {
  exportUrl: string;
  templateUrl: string;
  importUrl: string;
  queryKey: string[];
  canExport?: boolean;
  canImport?: boolean;
  entityLabel?: string;
};

type ImportResult = {
  created?: number;
  updated?: number;
  skipped?: number;
  errors?: { row: number; message: string }[];
};

export function BulkExcelActions({
  exportUrl,
  templateUrl,
  importUrl,
  queryKey,
  canExport,
  canImport,
  entityLabel = "records",
}: BulkExcelActionsProps) {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const [importing, setImporting] = React.useState(false);

  if (!canExport && !canImport) return null;

  async function onImportFile(file: File) {
    setImporting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(importUrl, { method: "POST", body: form });
      const json = (await res.json()) as {
        data?: ImportResult;
        error?: { message?: string };
      };
      if (!res.ok || json.error) {
        throw new Error(json.error?.message ?? "Import failed");
      }
      const result = json.data ?? {};
      const errCount = result.errors?.length ?? 0;
      toast.success(
        `Imported ${entityLabel}: ${result.created ?? 0} created, ${result.updated ?? 0} updated` +
          (errCount ? `, ${errCount} row error(s)` : "") +
          ". Existing records were kept.",
      );
      if (errCount && result.errors?.[0]) {
        toast.message(
          `First error (row ${result.errors[0].row}): ${result.errors[0].message}`,
        );
      }
      void queryClient.invalidateQueries({ queryKey });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canExport ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(templateUrl, "_blank")}
          >
            <FileSpreadsheet className="size-4" />
            Template
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => window.open(exportUrl, "_blank")}
          >
            <Download className="size-4" />
            Export Excel
          </Button>
        </>
      ) : null}
      {canImport ? (
        <>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onImportFile(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="size-4" />
            {importing ? "Importing…" : "Import Excel"}
          </Button>
        </>
      ) : null}
    </div>
  );
}
