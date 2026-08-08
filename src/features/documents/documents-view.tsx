"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";

const CATEGORIES = [
  "PDF",
  "EXCEL",
  "WORD",
  "IMAGE",
  "CONTRACT",
  "QUOTATION",
  "INVOICE",
  "CUSTOMER",
  "OTHER",
] as const;

type DocumentVersion = {
  id: string;
  version: number;
  fileUrl: string;
  fileSize?: number | null;
  createdAt?: string;
};

type DocumentRow = {
  id: string;
  name?: string;
  fileName?: string;
  category?: string | null;
  fileSize?: number | null;
  fileUrl?: string | null;
  customerId?: string | null;
  leadId?: string | null;
  createdAt?: string;
  uploadedBy?: { name?: string } | null;
  versions?: DocumentVersion[];
};

type DocForm = {
  name: string;
  category: (typeof CATEGORIES)[number];
  fileUrl: string;
  customerId: string;
  leadId: string;
};

const emptyForm: DocForm = {
  name: "",
  category: "OTHER",
  fileUrl: "",
  customerId: "",
  leadId: "",
};

export function DocumentsView() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<DocForm>(emptyForm);
  const [selected, setSelected] = React.useState<DocumentRow | null>(null);

  const query = useQuery({
    queryKey: ["documents", search],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      const res = await apiFetch<unknown>(`/api/documents?${params}`);
      return unwrapList<DocumentRow>(res.data);
    },
  });

  const detailQuery = useQuery({
    queryKey: ["documents", selected?.id],
    enabled: !!selected?.id,
    queryFn: async () => {
      const res = await apiFetch<DocumentRow>(`/api/documents/${selected!.id}`);
      return res.data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: DocForm) =>
      apiFetch("/api/documents", {
        method: "POST",
        body: JSON.stringify({
          name: values.name,
          category: values.category,
          fileUrl: values.fileUrl,
          customerId: values.customerId || null,
          leadId: values.leadId || null,
        }),
      }),
    onSuccess: () => {
      toast.success("Document uploaded");
      setDialogOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const columns: DataTableColumn<DocumentRow>[] = [
    {
      id: "name",
      header: "Document",
      cell: (r) => (
        <div>
          <button
            type="button"
            className="font-medium hover:underline"
            onClick={() => setSelected(r)}
          >
            {r.name ?? r.fileName ?? r.id}
          </button>
          {r.fileUrl ? (
            <a
              href={r.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 block text-xs text-primary hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Open file
            </a>
          ) : null}
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      cell: (r) =>
        r.category ? <Badge variant="outline">{r.category}</Badge> : "—",
    },
    {
      id: "size",
      header: "Size",
      cell: (r) =>
        r.fileSize != null ? `${Math.round(r.fileSize / 1024)} KB` : "—",
    },
    {
      id: "uploader",
      header: "Uploaded by",
      cell: (r) => r.uploadedBy?.name ?? "—",
    },
    { id: "created", header: "Created", cell: (r) => formatDate(r.createdAt) },
  ];

  const docs = query.data ?? [];
  const detail = detailQuery.data ?? selected;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search documents…"
          className="max-w-xs"
        />
        {can("documents:write") ? (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Upload
          </Button>
        ) : null}
      </div>

      {detail && selected ? (
        <div className="rounded-xl border border-border p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="font-medium">{detail.name}</p>
              <p className="text-xs text-muted-foreground">
                {detail.category}
                {detail.customerId ? ` · customer ${detail.customerId}` : ""}
                {detail.leadId ? ` · lead ${detail.leadId}` : ""}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              Close
            </Button>
          </div>
          <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Versions
          </p>
          {(detail.versions ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions recorded.</p>
          ) : (
            <ul className="space-y-1.5">
              {detail.versions?.map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between gap-2 text-sm"
                >
                  <span>v{v.version}</span>
                  <a
                    href={v.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary hover:underline"
                  >
                    Open
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(v.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <EmptyState
          title="Failed to load documents"
          description={(query.error as Error).message}
        />
      ) : (
        <DataTable
          columns={columns}
          data={docs}
          getRowId={(r) => r.id}
          emptyTitle="No documents"
          emptyDescription="Uploaded files from /api/documents will list here."
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>Upload document</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.name.trim() || !form.fileUrl.trim()) {
                toast.error("Name and file URL are required");
                return;
              }
              createMutation.mutate(form);
            }}
          >
            <Field label="Name *">
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </Field>
            <Field label="Category">
              <Select
                value={form.category}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    category: (v as DocForm["category"]) ?? "OTHER",
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="File URL *">
              <Input
                type="url"
                value={form.fileUrl}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fileUrl: e.target.value }))
                }
                placeholder="https://…"
                required
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer ID">
                <Input
                  value={form.customerId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, customerId: e.target.value }))
                  }
                />
              </Field>
              <Field label="Lead ID">
                <Input
                  value={form.leadId}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, leadId: e.target.value }))
                  }
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving…" : "Upload"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
