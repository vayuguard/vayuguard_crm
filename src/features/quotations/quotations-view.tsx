"use client";

import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  FileText,
  Mail,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

type CustomerOption = { id: string; name: string; email?: string | null };
type ProductOption = {
  id: string;
  name: string;
  sku?: string | null;
  price?: number | string;
  gstPercent?: number | string;
};

type QuotationItem = {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  taxPercent?: number | string;
  discount?: number | string;
  total?: number | string;
  product?: { id: string; sku?: string; name?: string } | null;
};

type QuotationVersion = {
  id: string;
  version: number;
  createdAt?: string;
};

type Quotation = {
  id: string;
  quoteNumber?: string;
  title?: string;
  status?: string;
  total?: number | string | null;
  subtotal?: number | string | null;
  taxAmount?: number | string | null;
  discountAmount?: number | string | null;
  terms?: string | null;
  notes?: string | null;
  validUntil?: string | null;
  customerId?: string | null;
  customer?: { id?: string; name?: string; email?: string | null } | null;
  items?: QuotationItem[];
  versions?: QuotationVersion[];
  version?: number;
  createdAt?: string;
};

function statusBadgeClass(status?: string) {
  switch (status) {
    case "APPROVED":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "SENT":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400";
    case "REJECTED":
    case "EXPIRED":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "DRAFT":
    default:
      return "";
  }
}

const lineSchema = z.object({
  productId: z.string().optional(),
  description: z.string().trim().min(1, "Description required"),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().min(0),
  taxPercent: z.coerce.number().min(0).max(100),
  discount: z.coerce.number().min(0),
});

const quotationFormSchema = z.object({
  customerId: z.string().optional(),
  terms: z.string().optional(),
  notes: z.string().optional(),
  validUntil: z.string().optional(),
  discountAmount: z.coerce.number().min(0),
  items: z.array(lineSchema).min(1, "Add at least one line item"),
});

type QuotationFormValues = z.infer<typeof quotationFormSchema>;

const emptyLine = {
  productId: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  taxPercent: 18,
  discount: 0,
};

const emptyForm: QuotationFormValues = {
  customerId: "",
  terms: "",
  notes: "",
  validUntil: "",
  discountAmount: 0,
  items: [{ ...emptyLine }],
};

function toPayload(values: QuotationFormValues) {
  return {
    customerId: values.customerId || null,
    terms: values.terms || null,
    notes: values.notes || null,
    validUntil: values.validUntil || null,
    discountAmount: values.discountAmount,
    items: values.items.map((item) => ({
      productId: item.productId || null,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      taxPercent: item.taxPercent,
      discount: item.discount,
    })),
  };
}

export function QuotationsView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [emailOpen, setEmailOpen] = React.useState(false);
  const [emailTo, setEmailTo] = React.useState("");
  const [emailSubject, setEmailSubject] = React.useState("");
  const [emailMessage, setEmailMessage] = React.useState("");

  const form = useForm<QuotationFormValues>({
    resolver: zodResolver(quotationFormSchema),
    defaultValues: emptyForm,
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  });

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery({
    queryKey: ["quotations", debounced, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      if (statusFilter !== "all") params.set("status", statusFilter);
      const url = params.size
        ? `/api/quotations?${params}`
        : "/api/quotations";
      const res = await apiFetch<unknown>(url);
      return unwrapList<Quotation>(res.data);
    },
  });

  const detailQuery = useQuery({
    queryKey: ["quotations", detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const res = await apiFetch<Quotation>(`/api/quotations/${detailId}`);
      return res.data;
    },
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "options"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/customers?pageSize=100");
      return unwrapList<CustomerOption>(res.data);
    },
  });

  const productsQuery = useQuery({
    queryKey: ["products", "options"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/products?pageSize=200");
      return unwrapList<ProductOption>(res.data);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (values: QuotationFormValues) =>
      apiFetch("/api/quotations", {
        method: "POST",
        body: JSON.stringify(toPayload(values)),
      }),
    onSuccess: () => {
      toast.success("Quotation created");
      setCreateOpen(false);
      form.reset(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch(`/api/quotations/${id}/approve`, { method: "POST" }),
    onSuccess: () => {
      toast.success("Quotation approved");
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const emailMutation = useMutation({
    mutationFn: async () => {
      if (!detailId) throw new Error("No quotation selected");
      return apiFetch(`/api/quotations/${detailId}/email`, {
        method: "POST",
        body: JSON.stringify({
          to: emailTo,
          subject: emailSubject || undefined,
          message: emailMessage || null,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Quotation emailed");
      setEmailOpen(false);
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toInvoiceMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch<{ id: string }>(`/api/quotations/${id}/invoice`, {
        method: "POST",
        body: JSON.stringify({}),
      }),
    onSuccess: () => {
      toast.success("Invoice created from quotation");
      setDetailId(null);
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      router.push("/invoices");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function applyProduct(index: number, productId: string) {
    const product = (productsQuery.data ?? []).find((p) => p.id === productId);
    form.setValue(`items.${index}.productId`, productId);
    if (product) {
      form.setValue(
        `items.${index}.description`,
        `${product.sku ? `${product.sku} — ` : ""}${product.name}`,
      );
      form.setValue(`items.${index}.unitPrice`, Number(product.price ?? 0));
      form.setValue(
        `items.${index}.taxPercent`,
        Number(product.gstPercent ?? 18),
      );
    }
  }

  function openPdf(id: string) {
    window.open(`/api/quotations/${id}/pdf?format=text`, "_blank");
  }

  function openEmail() {
    const q = detailQuery.data;
    setEmailTo(q?.customer?.email ?? "");
    setEmailSubject(
      q?.quoteNumber ? `Quotation ${q.quoteNumber}` : "Quotation",
    );
    setEmailMessage("");
    setEmailOpen(true);
  }

  const columns: DataTableColumn<Quotation>[] = [
    {
      id: "quote",
      header: "Quotation",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.quoteNumber ?? r.title ?? r.id}</p>
          <p className="text-xs text-muted-foreground">
            {r.customer?.name ?? "—"}
          </p>
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (r) =>
        r.status ? (
          <Badge variant="outline" className={cn(statusBadgeClass(r.status))}>
            {r.status}
          </Badge>
        ) : (
          "—"
        ),
    },
    {
      id: "total",
      header: "Total",
      cell: (r) => formatCurrency(r.total),
    },
    {
      id: "valid",
      header: "Valid until",
      cell: (r) => formatDate(r.validUntil),
    },
    {
      id: "created",
      header: "Created",
      cell: (r) => formatDate(r.createdAt),
    },
  ];

  const detail = detailQuery.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search quotations…"
            className="max-w-xs"
          />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="DRAFT">Draft</SelectItem>
              <SelectItem value="SENT">Sent</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {can("quotes:write") ? (
          <Button
            onClick={() => {
              form.reset(emptyForm);
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" />
            New quotation
          </Button>
        ) : null}
      </div>

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <EmptyState
          title="Failed to load quotations"
          description={(query.error as Error).message}
          action={
            <Button variant="outline" onClick={() => query.refetch()}>
              Retry
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={query.data ?? []}
          getRowId={(r) => r.id}
          emptyTitle="No quotations"
          emptyDescription="Quotations will appear here once created."
          onRowClick={(row) => setDetailId(row.id)}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>Create quotation</DialogTitle>
          </DialogHeader>
          <form
            className="grid max-h-[75vh] gap-3 overflow-y-auto pr-1"
            onSubmit={form.handleSubmit((values) =>
              createMutation.mutateAsync(values),
            )}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Customer">
                <Select
                  value={form.watch("customerId") || "__none__"}
                  onValueChange={(v) =>
                    form.setValue(
                      "customerId",
                      v === "__none__" ? "" : (v ?? ""),
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {(customersQuery.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Valid until">
                <Input type="date" {...form.register("validUntil")} />
              </Field>
              <Field label="Header discount">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  {...form.register("discountAmount")}
                />
              </Field>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">Line items</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ ...emptyLine })}
                >
                  <Plus className="size-3.5" />
                  Add line
                </Button>
              </div>
              {fields.map((field, index) => (
                <div
                  key={field.id}
                  className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-6"
                >
                  <Field label="Product" className="sm:col-span-2">
                    <Select
                      value={form.watch(`items.${index}.productId`) || "__none__"}
                      onValueChange={(v) => {
                        if (!v || v === "__none__") {
                          form.setValue(`items.${index}.productId`, "");
                          return;
                        }
                        applyProduct(index, v);
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Optional" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Custom</SelectItem>
                        {(productsQuery.data ?? []).map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.sku ? `${p.sku} — ` : ""}
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label="Description *"
                    className="sm:col-span-4"
                    error={
                      form.formState.errors.items?.[index]?.description
                        ?.message
                    }
                  >
                    <Input {...form.register(`items.${index}.description`)} />
                  </Field>
                  <Field label="Qty">
                    <Input
                      type="number"
                      min={0.01}
                      step="0.01"
                      {...form.register(`items.${index}.quantity`)}
                    />
                  </Field>
                  <Field label="Price">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      {...form.register(`items.${index}.unitPrice`)}
                    />
                  </Field>
                  <Field label="Tax %">
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      {...form.register(`items.${index}.taxPercent`)}
                    />
                  </Field>
                  <Field label="Discount">
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      {...form.register(`items.${index}.discount`)}
                    />
                  </Field>
                  <div className="flex items-end sm:col-span-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={fields.length <= 1}
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="size-3.5 text-destructive" />
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              {form.formState.errors.items?.root?.message ||
              form.formState.errors.items?.message ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.items?.root?.message ??
                    form.formState.errors.items?.message}
                </p>
              ) : null}
            </div>

            <Field label="Terms">
              <Textarea rows={2} {...form.register("terms")} />
            </Field>
            <Field label="Notes">
              <Textarea rows={2} {...form.register("notes")} />
            </Field>

            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Saving…" : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!detailId}
        onOpenChange={(open) => !open && setDetailId(null)}
      >
        <DialogContent className="sm:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {detail?.quoteNumber ?? "Quotation details"}
            </DialogTitle>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <LoadingSkeleton rows={4} />
          ) : detailQuery.isError || !detail ? (
            <EmptyState
              title="Could not load quotation"
              description={(detailQuery.error as Error)?.message}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {detail.status ? (
                  <Badge
                    variant="outline"
                    className={cn(statusBadgeClass(detail.status))}
                  >
                    {detail.status}
                  </Badge>
                ) : null}
                <span className="text-sm text-muted-foreground">
                  {detail.customer?.name ?? "No customer"}
                </span>
                <span className="text-sm font-medium">
                  {formatCurrency(detail.total)}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {can("quotes:approve") &&
                detail.status !== "APPROVED" &&
                detail.status !== "REJECTED" ? (
                  <Button
                    size="sm"
                    onClick={() => approveMutation.mutate(detail.id)}
                    disabled={approveMutation.isPending}
                  >
                    <Check className="size-3.5" />
                    Approve
                  </Button>
                ) : null}
                {can("quotes:write") ? (
                  <Button size="sm" variant="outline" onClick={openEmail}>
                    <Mail className="size-3.5" />
                    Email
                  </Button>
                ) : null}
                {can("invoices:write") ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toInvoiceMutation.mutate(detail.id)}
                    disabled={toInvoiceMutation.isPending}
                  >
                    <Receipt className="size-3.5" />
                    {toInvoiceMutation.isPending
                      ? "Creating…"
                      : "Create invoice"}
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openPdf(detail.id)}
                >
                  <FileText className="size-3.5" />
                  Open PDF
                </Button>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Line items</p>
                {(detail.items ?? []).map((item) => (
                  <div
                    key={item.id ?? item.description}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{item.description}</p>
                      <p className="text-xs text-muted-foreground">
                        Qty {item.quantity} · {formatCurrency(item.unitPrice)} ·
                        Tax {item.taxPercent ?? 18}%
                      </p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>

              {(detail.versions?.length ?? 0) > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    Versions ({detail.versions?.length})
                  </p>
                  {detail.versions?.map((v) => (
                    <div
                      key={v.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <span>v{v.version}</span>
                      <span className="text-muted-foreground">
                        {formatDate(v.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              ) : detail.version ? (
                <p className="text-sm text-muted-foreground">
                  Current version: v{detail.version}
                </p>
              ) : null}

              {detail.terms ? (
                <div>
                  <p className="text-xs text-muted-foreground">Terms</p>
                  <p className="text-sm whitespace-pre-wrap">{detail.terms}</p>
                </div>
              ) : null}
              {detail.notes ? (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{detail.notes}</p>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={emailOpen} onOpenChange={setEmailOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Email quotation</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!emailTo.trim()) {
                toast.error("Recipient email is required");
                return;
              }
              emailMutation.mutate();
            }}
          >
            <Field label="To *">
              <Input
                type="email"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
                required
              />
            </Field>
            <Field label="Subject">
              <Input
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </Field>
            <Field label="Message">
              <Textarea
                rows={3}
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEmailOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={emailMutation.isPending}>
                {emailMutation.isPending ? "Sending…" : "Send"}
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
  error,
  className,
  children,
}: {
  label: string;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
