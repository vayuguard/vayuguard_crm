"use client";

import * as React from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Banknote, FileText, Plus, Trash2 } from "lucide-react";
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
import { ZohoSyncBadge } from "@/features/zoho/zoho-sync-badge";

type CustomerOption = { id: string; name: string };
type ProductOption = {
  id: string;
  name: string;
  sku?: string | null;
  price?: number | string;
  gstPercent?: number | string;
};

type InvoiceItem = {
  id?: string;
  productId?: string | null;
  description: string;
  quantity: number | string;
  unitPrice: number | string;
  taxPercent?: number | string;
  discount?: number | string;
  total?: number | string;
};

type Payment = {
  id: string;
  paymentNumber?: string;
  amount?: number | string;
  method?: string | null;
  reference?: string | null;
  paidAt?: string;
  notes?: string | null;
};

type Invoice = {
  id: string;
  invoiceNumber?: string;
  status?: string;
  paymentStatus?: string;
  total?: number | string | null;
  amountPaid?: number | string | null;
  subtotal?: number | string | null;
  taxAmount?: number | string | null;
  discountAmount?: number | string | null;
  dueDate?: string | null;
  issueDate?: string | null;
  notes?: string | null;
  customerId?: string;
  customer?: { id?: string; name?: string } | null;
  items?: InvoiceItem[];
  payments?: Payment[];
  createdAt?: string;
};

function paymentBadgeClass(status?: string) {
  switch (status) {
    case "PAID":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
    case "PARTIAL":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400";
    case "OVERDUE":
      return "border-destructive/30 bg-destructive/10 text-destructive";
    case "CANCELLED":
      return "border-muted-foreground/30 bg-muted text-muted-foreground";
    case "PENDING":
    default:
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-400";
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

const invoiceFormSchema = z.object({
  customerId: z.string().min(1, "Customer is required"),
  issueDate: z.string().optional(),
  dueDate: z.string().min(1, "Due date is required"),
  discountAmount: z.coerce.number().min(0),
  notes: z.string().optional(),
  items: z.array(lineSchema).min(1, "Add at least one line item"),
});

type InvoiceFormValues = z.infer<typeof invoiceFormSchema>;

const emptyLine = {
  productId: "",
  description: "",
  quantity: 1,
  unitPrice: 0,
  taxPercent: 18,
  discount: 0,
};

function defaultDueDate() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

const emptyForm: InvoiceFormValues = {
  customerId: "",
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: defaultDueDate(),
  discountAmount: 0,
  notes: "",
  items: [{ ...emptyLine }],
};

function toPayload(values: InvoiceFormValues) {
  return {
    customerId: values.customerId,
    issueDate: values.issueDate || null,
    dueDate: values.dueDate,
    discountAmount: values.discountAmount,
    notes: values.notes || null,
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

export function InvoicesView() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [paymentFilter, setPaymentFilter] = React.useState("all");
  const [createOpen, setCreateOpen] = React.useState(false);
  const [detailId, setDetailId] = React.useState<string | null>(null);
  const [payOpen, setPayOpen] = React.useState(false);
  const [payAmount, setPayAmount] = React.useState("");
  const [payMethod, setPayMethod] = React.useState("");
  const [payReference, setPayReference] = React.useState("");
  const [payNotes, setPayNotes] = React.useState("");
  const [payDate, setPayDate] = React.useState(
    new Date().toISOString().slice(0, 10),
  );

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceFormSchema),
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
    queryKey: ["invoices", debounced, paymentFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      if (paymentFilter !== "all") params.set("paymentStatus", paymentFilter);
      const url = params.size ? `/api/invoices?${params}` : "/api/invoices";
      const res = await apiFetch<unknown>(url);
      return unwrapList<Invoice>(res.data);
    },
  });

  const detailQuery = useQuery({
    queryKey: ["invoices", detailId],
    enabled: !!detailId,
    queryFn: async () => {
      const res = await apiFetch<Invoice>(`/api/invoices/${detailId}`);
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
    mutationFn: async (values: InvoiceFormValues) =>
      apiFetch("/api/invoices", {
        method: "POST",
        body: JSON.stringify(toPayload(values)),
      }),
    onSuccess: () => {
      toast.success("Invoice created");
      setCreateOpen(false);
      form.reset({
        ...emptyForm,
        dueDate: defaultDueDate(),
        issueDate: new Date().toISOString().slice(0, 10),
        items: [{ ...emptyLine }],
      });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!detailId) throw new Error("No invoice selected");
      return apiFetch(`/api/invoices/${detailId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: Number(payAmount),
          method: payMethod || null,
          reference: payReference || null,
          paidAt: payDate || null,
          notes: payNotes || null,
        }),
      });
    },
    onSuccess: () => {
      toast.success("Payment recorded");
      setPayOpen(false);
      setPayAmount("");
      setPayMethod("");
      setPayReference("");
      setPayNotes("");
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
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
    window.open(`/api/invoices/${id}/pdf?format=text`, "_blank");
  }

  function openPayment() {
    const inv = detailQuery.data;
    if (!inv) return;
    const balance = Math.max(
      0,
      Number(inv.total ?? 0) - Number(inv.amountPaid ?? 0),
    );
    setPayAmount(balance > 0 ? String(balance) : "");
    setPayDate(new Date().toISOString().slice(0, 10));
    setPayOpen(true);
  }

  const columns: DataTableColumn<Invoice>[] = [
    {
      id: "invoice",
      header: "Invoice",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.invoiceNumber ?? r.id}</p>
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
        r.status ? <Badge variant="secondary">{r.status}</Badge> : "—",
    },
    {
      id: "payment",
      header: "Payment",
      cell: (r) =>
        r.paymentStatus ? (
          <Badge
            variant="outline"
            className={cn(paymentBadgeClass(r.paymentStatus))}
          >
            {r.paymentStatus}
          </Badge>
        ) : (
          "—"
        ),
    },
    { id: "total", header: "Total", cell: (r) => formatCurrency(r.total) },
    { id: "due", header: "Due", cell: (r) => formatDate(r.dueDate) },
    { id: "created", header: "Created", cell: (r) => formatDate(r.createdAt) },
  ];

  const detail = detailQuery.data;
  const balanceDue = detail
    ? Math.max(0, Number(detail.total ?? 0) - Number(detail.amountPaid ?? 0))
    : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search invoices…"
            className="max-w-xs"
          />
          <Select
            value={paymentFilter}
            onValueChange={(v) => setPaymentFilter(v ?? "all")}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              <SelectItem value="PAID">Paid</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="PARTIAL">Partial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {can("invoices:write") ? (
          <Button
            onClick={() => {
              form.reset({
                ...emptyForm,
                dueDate: defaultDueDate(),
                issueDate: new Date().toISOString().slice(0, 10),
                items: [{ ...emptyLine }],
              });
              setCreateOpen(true);
            }}
          >
            <Plus className="size-4" />
            New invoice
          </Button>
        ) : null}
      </div>

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <EmptyState
          title="Failed to load invoices"
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
          emptyTitle="No invoices"
          emptyDescription="Invoices and payment status will show here."
          onRowClick={(row) => setDetailId(row.id)}
        />
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-3xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>Create invoice</DialogTitle>
          </DialogHeader>
          <form
            className="grid max-h-[75vh] gap-3 overflow-y-auto pr-1"
            onSubmit={form.handleSubmit((values) =>
              createMutation.mutateAsync(values),
            )}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Customer *"
                error={form.formState.errors.customerId?.message}
              >
                <Select
                  value={form.watch("customerId") || undefined}
                  onValueChange={(v) => form.setValue("customerId", v ?? "")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {(customersQuery.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Issue date">
                <Input type="date" {...form.register("issueDate")} />
              </Field>
              <Field
                label="Due date *"
                error={form.formState.errors.dueDate?.message}
              >
                <Input type="date" {...form.register("dueDate")} required />
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
                <p className="text-sm font-medium">Line items + GST</p>
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
                      value={
                        form.watch(`items.${index}.productId`) || "__none__"
                      }
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
                  <Field label="GST %">
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
            </div>

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
              {detail?.invoiceNumber ?? "Invoice details"}
            </DialogTitle>
          </DialogHeader>
          {detailQuery.isLoading ? (
            <LoadingSkeleton rows={4} />
          ) : detailQuery.isError || !detail ? (
            <EmptyState
              title="Could not load invoice"
              description={(detailQuery.error as Error)?.message}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {detail.status ? (
                  <Badge variant="secondary">{detail.status}</Badge>
                ) : null}
                {detail.paymentStatus ? (
                  <Badge
                    variant="outline"
                    className={cn(paymentBadgeClass(detail.paymentStatus))}
                  >
                    {detail.paymentStatus}
                  </Badge>
                ) : null}
                <span className="text-sm text-muted-foreground">
                  {detail.customer?.name ?? "—"}
                </span>
              </div>

              <ZohoSyncBadge entityType="invoice" crmId={detail.id} />

              <div className="grid gap-2 text-sm sm:grid-cols-3">
                <DetailStat label="Total" value={formatCurrency(detail.total)} />
                <DetailStat
                  label="Paid"
                  value={formatCurrency(detail.amountPaid)}
                />
                <DetailStat
                  label="Balance"
                  value={formatCurrency(balanceDue)}
                />
                <DetailStat label="Due" value={formatDate(detail.dueDate)} />
                <DetailStat
                  label="GST"
                  value={formatCurrency(detail.taxAmount)}
                />
                <DetailStat
                  label="Subtotal"
                  value={formatCurrency(detail.subtotal)}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                {can("invoices:write") &&
                balanceDue > 0 &&
                detail.paymentStatus !== "CANCELLED" ? (
                  <Button size="sm" onClick={openPayment}>
                    <Banknote className="size-3.5" />
                    Record payment
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
                        GST {item.taxPercent ?? 18}%
                      </p>
                    </div>
                    <p className="font-medium">{formatCurrency(item.total)}</p>
                  </div>
                ))}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">
                  Payments ({detail.payments?.length ?? 0})
                </p>
                {(detail.payments ?? []).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No payments recorded.
                  </p>
                ) : (
                  detail.payments?.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
                    >
                      <div>
                        <p className="font-medium">
                          {p.paymentNumber ?? formatCurrency(p.amount)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {[p.method, p.reference, formatDate(p.paidAt)]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(p.amount)}</p>
                    </div>
                  ))
                )}
              </div>

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

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Record payment</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!payAmount || Number(payAmount) <= 0) {
                toast.error("Enter a valid amount");
                return;
              }
              payMutation.mutate();
            }}
          >
            <Field label="Amount *">
              <Input
                type="number"
                min={0.01}
                step="0.01"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                required
              />
            </Field>
            <Field label="Method">
              <Input
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value)}
                placeholder="UPI / NEFT / Cash"
              />
            </Field>
            <Field label="Reference">
              <Input
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
              />
            </Field>
            <Field label="Paid at">
              <Input
                type="date"
                value={payDate}
                onChange={(e) => setPayDate(e.target.value)}
              />
            </Field>
            <Field label="Notes">
              <Textarea
                rows={2}
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPayOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={payMutation.isPending}>
                {payMutation.isPending ? "Saving…" : "Record"}
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

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
