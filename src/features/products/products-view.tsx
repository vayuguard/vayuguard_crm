"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

type Product = {
  id: string;
  name: string;
  sku?: string | null;
  description?: string | null;
  category?: { id?: string; name?: string } | string | null;
  categoryId?: string | null;
  price?: number | string | null;
  unitPrice?: number | string | null;
  gstPercent?: number | string | null;
  inventory?: number | null;
  images?: string[];
  isActive?: boolean;
};

const productFormSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required"),
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().optional(),
  price: z.coerce.number().min(0),
  gstPercent: z.coerce.number().min(0).max(100),
  category: z.string().optional(),
  inventory: z.coerce.number().int().min(0),
  images: z.string().optional(),
  isActive: z.boolean(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const emptyForm: ProductFormValues = {
  sku: "",
  name: "",
  description: "",
  price: 0,
  gstPercent: 18,
  category: "",
  inventory: 0,
  images: "",
  isActive: true,
};

function parseImages(raw?: string) {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toPayload(values: ProductFormValues) {
  return {
    sku: values.sku,
    name: values.name,
    description: values.description || null,
    price: values.price,
    gstPercent: values.gstPercent,
    category: values.category || null,
    inventory: values.inventory,
    images: parseImages(values.images),
    isActive: values.isActive,
  };
}

export function ProductsView() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [deleting, setDeleting] = React.useState<Product | null>(null);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema),
    defaultValues: emptyForm,
  });

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery({
    queryKey: ["products", debounced],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      const url = params.size ? `/api/products?${params}` : "/api/products";
      const res = await apiFetch<unknown>(url);
      return unwrapList<Product>(res.data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: ProductFormValues) => {
      const body = toPayload(values);
      if (editing) {
        return apiFetch(`/api/products/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      return apiFetch("/api/products", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Product updated" : "Product created");
      setDialogOpen(false);
      setEditing(null);
      form.reset(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch(`/api/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Product deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreate() {
    setEditing(null);
    form.reset(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    const categoryName =
      typeof product.category === "object"
        ? (product.category?.name ?? "")
        : (product.category ?? "");
    form.reset({
      sku: product.sku ?? "",
      name: product.name,
      description: product.description ?? "",
      price: Number(product.price ?? product.unitPrice ?? 0),
      gstPercent: Number(product.gstPercent ?? 18),
      category: categoryName,
      inventory: product.inventory ?? 0,
      images: (product.images ?? []).join("\n"),
      isActive: product.isActive !== false,
    });
    setDialogOpen(true);
  }

  const columns: DataTableColumn<Product>[] = [
    {
      id: "name",
      header: "Product",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.sku ?? "—"}</p>
        </div>
      ),
    },
    {
      id: "category",
      header: "Category",
      cell: (r) =>
        typeof r.category === "object"
          ? (r.category?.name ?? "—")
          : (r.category ?? "—"),
    },
    {
      id: "price",
      header: "Price",
      cell: (r) => formatCurrency(r.price ?? r.unitPrice),
    },
    {
      id: "gst",
      header: "GST %",
      cell: (r) => (r.gstPercent != null ? String(r.gstPercent) : "—"),
    },
    {
      id: "inventory",
      header: "Inventory",
      cell: (r) => (r.inventory != null ? String(r.inventory) : "—"),
    },
    {
      id: "active",
      header: "Status",
      cell: (r) => (
        <Badge variant={r.isActive === false ? "outline" : "secondary"}>
          {r.isActive === false ? "Inactive" : "Active"}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "w-[1%] text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          {can("products:write") ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => openEdit(r)}
            >
              <Pencil className="size-3.5" />
            </Button>
          ) : null}
          {can("products:write") ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setDeleting(r)}
            >
              <Trash2 className="size-3.5 text-destructive" />
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products…"
          className="max-w-xs"
        />
        {can("products:write") ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New product
          </Button>
        ) : null}
      </div>

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <EmptyState
          title="Failed to load products"
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
          emptyTitle="No products"
          emptyDescription="Add SKUs to quote and invoice from the catalog."
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit product" : "Create product"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3"
            onSubmit={form.handleSubmit((values) =>
              saveMutation.mutateAsync(values),
            )}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="SKU *" error={form.formState.errors.sku?.message}>
                <Input {...form.register("sku")} required />
              </Field>
              <Field label="Name *" error={form.formState.errors.name?.message}>
                <Input {...form.register("name")} required />
              </Field>
              <Field label="Price *">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  {...form.register("price")}
                  required
                />
              </Field>
              <Field label="GST %">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  {...form.register("gstPercent")}
                />
              </Field>
              <Field label="Category">
                <Input
                  {...form.register("category")}
                  placeholder="Category name"
                />
              </Field>
              <Field label="Inventory">
                <Input type="number" min={0} {...form.register("inventory")} />
              </Field>
            </div>
            <Field label="Description">
              <Textarea rows={2} {...form.register("description")} />
            </Field>
            <Field label="Image URLs (one per line or comma-separated)">
              <Textarea
                rows={2}
                {...form.register("images")}
                placeholder="https://…"
              />
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <Label className="text-sm">Active</Label>
              <Switch
                checked={form.watch("isActive")}
                onCheckedChange={(v) => form.setValue("isActive", !!v)}
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending
                  ? "Saving…"
                  : editing
                    ? "Update"
                    : "Create"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete product?"
        description={`This will archive ${deleting?.name ?? "this product"}.`}
        confirmLabel="Delete"
        variant="destructive"
        loading={deleteMutation.isPending}
        onConfirm={() => {
          if (deleting) deleteMutation.mutate(deleting.id);
        }}
      />
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
