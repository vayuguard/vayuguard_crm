"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import {
  CustomerForm,
  toCustomerPayload,
  type CustomerFormValues,
} from "@/features/customers/customer-form";

type Customer = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  industry?: string | null;
  gstNumber?: string | null;
  billingCity?: string | null;
  status?: string | null;
  createdAt?: string;
  legalName?: string | null;
  website?: string | null;
  panNumber?: string | null;
  billingAddress?: string | null;
  billingState?: string | null;
  billingCountry?: string | null;
  billingPinCode?: string | null;
  shippingAddress?: string | null;
  shippingCity?: string | null;
  shippingState?: string | null;
  shippingCountry?: string | null;
  shippingPinCode?: string | null;
  notes?: string | null;
  assignedToId?: string | null;
};

export function CustomersView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Customer | null>(null);
  const [deleting, setDeleting] = React.useState<Customer | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery({
    queryKey: ["customers", debounced],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      const url = params.size ? `/api/customers?${params}` : "/api/customers";
      const res = await apiFetch<unknown>(url);
      return unwrapList<Customer>(res.data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) => {
      const body = toCustomerPayload(values);
      if (editing) {
        return apiFetch(`/api/customers/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      return apiFetch("/api/customers", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Customer updated" : "Customer created");
      setDialogOpen(false);
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch(`/api/customers/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Customer deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const customers = query.data ?? [];

  const columns: DataTableColumn<Customer>[] = [
    {
      id: "name",
      header: "Customer",
      cell: (r) => (
        <div>
          <p className="font-medium text-primary">{r.name}</p>
          <p className="text-xs text-muted-foreground">{r.industry ?? "—"}</p>
        </div>
      ),
    },
    {
      id: "contact",
      header: "Contact",
      cell: (r) => (
        <div>
          <p>{r.email ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{r.phone ?? ""}</p>
        </div>
      ),
    },
    {
      id: "gst",
      header: "GST",
      cell: (r) => r.gstNumber ?? "—",
    },
    {
      id: "city",
      header: "City",
      cell: (r) => r.billingCity ?? "—",
    },
    {
      id: "status",
      header: "Status",
      cell: (r) =>
        r.status ? <Badge variant="secondary">{r.status}</Badge> : "—",
    },
    {
      id: "created",
      header: "Created",
      cell: (r) => formatDate(r.createdAt),
    },
    {
      id: "actions",
      header: "",
      className: "w-[1%] text-right",
      cell: (r) => (
        <div
          className="flex justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          {can("customers:write") ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                setEditing(r);
                setDialogOpen(true);
              }}
            >
              <Pencil className="size-3.5" />
            </Button>
          ) : null}
          {can("customers:delete") ? (
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
          placeholder="Search customers…"
          className="max-w-xs"
        />
        {can("customers:write") ? (
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            New customer
          </Button>
        ) : null}
      </div>

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <EmptyState
          title="Failed to load customers"
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
          data={customers}
          getRowId={(r) => r.id}
          emptyTitle="No customers yet"
          emptyDescription="Customers converted from won leads will appear here."
          onRowClick={(row) => router.push(`/customers/${row.id}`)}
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit customer" : "Create customer"}
            </DialogTitle>
          </DialogHeader>
          <CustomerForm
            key={editing?.id ?? "new"}
            defaultValues={
              editing
                ? {
                    name: editing.name,
                    legalName: editing.legalName ?? "",
                    industry: editing.industry ?? "",
                    website: editing.website ?? "",
                    email: editing.email ?? "",
                    phone: editing.phone ?? "",
                    gstNumber: editing.gstNumber ?? "",
                    panNumber: editing.panNumber ?? "",
                    billingAddress: editing.billingAddress ?? "",
                    billingCity: editing.billingCity ?? "",
                    billingState: editing.billingState ?? "",
                    billingCountry: editing.billingCountry ?? "India",
                    billingPinCode: editing.billingPinCode ?? "",
                    shippingAddress: editing.shippingAddress ?? "",
                    shippingCity: editing.shippingCity ?? "",
                    shippingState: editing.shippingState ?? "",
                    shippingCountry: editing.shippingCountry ?? "India",
                    shippingPinCode: editing.shippingPinCode ?? "",
                    notes: editing.notes ?? "",
                    assignedToId: editing.assignedToId ?? "",
                  }
                : undefined
            }
            submitting={saveMutation.isPending}
            submitLabel={editing ? "Update" : "Create"}
            onCancel={() => setDialogOpen(false)}
            onSubmit={async (values) => {
              await saveMutation.mutateAsync(values);
            }}
          />
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete customer?"
        description={`This will archive ${deleting?.name ?? "this customer"}.`}
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
