"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { ConfirmDialog } from "@/components/shared/confirm-dialog";

type Contact = {
  id: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  birthday?: string | null;
  designation?: string | null;
  title?: string | null;
  department?: string | null;
  relationshipScore?: number | null;
  customerId?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  facebookUrl?: string | null;
  notes?: string | null;
  customer?: { id?: string; name?: string } | null;
  tags?: { tag?: { id: string; name: string } | null }[];
  createdAt?: string;
};

type CustomerOption = { id: string; name: string };

const contactFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  designation: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  birthday: z.string().optional(),
  department: z.string().optional(),
  customerId: z.string().optional(),
  linkedinUrl: z.string().optional(),
  twitterUrl: z.string().optional(),
  facebookUrl: z.string().optional(),
  notes: z.string().optional(),
  relationshipScore: z.coerce.number().int().min(0).max(100),
  tags: z.string().optional(),
});

type ContactFormValues = z.infer<typeof contactFormSchema>;

const emptyForm: ContactFormValues = {
  name: "",
  designation: "",
  email: "",
  phone: "",
  whatsapp: "",
  birthday: "",
  department: "",
  customerId: "",
  linkedinUrl: "",
  twitterUrl: "",
  facebookUrl: "",
  notes: "",
  relationshipScore: 50,
  tags: "",
};

function toPayload(values: ContactFormValues) {
  return {
    name: values.name,
    designation: values.designation || null,
    email: values.email || null,
    phone: values.phone || null,
    whatsapp: values.whatsapp || null,
    birthday: values.birthday || null,
    department: values.department || null,
    customerId: values.customerId || null,
    linkedinUrl: values.linkedinUrl || null,
    twitterUrl: values.twitterUrl || null,
    facebookUrl: values.facebookUrl || null,
    notes: values.notes || null,
    relationshipScore: values.relationshipScore,
    tags: values.tags || "",
  };
}

export function ContactsView() {
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Contact | null>(null);
  const [deleting, setDeleting] = React.useState<Contact | null>(null);

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: emptyForm,
  });

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 250);
    return () => clearTimeout(t);
  }, [search]);

  const query = useQuery({
    queryKey: ["contacts", debounced],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      const url = params.size ? `/api/contacts?${params}` : "/api/contacts";
      const res = await apiFetch<unknown>(url);
      return unwrapList<Contact>(res.data);
    },
  });

  const customersQuery = useQuery({
    queryKey: ["customers", "options"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/customers?pageSize=100");
      return unwrapList<CustomerOption>(res.data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: ContactFormValues) => {
      const body = toPayload(values);
      if (editing) {
        return apiFetch(`/api/contacts/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      return apiFetch("/api/contacts", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast.success(editing ? "Contact updated" : "Contact created");
      setDialogOpen(false);
      setEditing(null);
      form.reset(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch(`/api/contacts/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      toast.success("Contact deleted");
      setDeleting(null);
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreate() {
    setEditing(null);
    form.reset(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(contact: Contact) {
    setEditing(contact);
    const tagNames =
      contact.tags
        ?.map((t) => t.tag?.name)
        .filter(Boolean)
        .join(", ") ?? "";
    form.reset({
      name:
        contact.name ??
        [contact.firstName, contact.lastName].filter(Boolean).join(" ") ??
        "",
      designation: contact.designation ?? contact.title ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      whatsapp: contact.whatsapp ?? "",
      birthday: contact.birthday
        ? String(contact.birthday).slice(0, 10)
        : "",
      department: contact.department ?? "",
      customerId: contact.customerId ?? contact.customer?.id ?? "",
      linkedinUrl: contact.linkedinUrl ?? "",
      twitterUrl: contact.twitterUrl ?? "",
      facebookUrl: contact.facebookUrl ?? "",
      notes: contact.notes ?? "",
      relationshipScore: contact.relationshipScore ?? 50,
      tags: tagNames,
    });
    setDialogOpen(true);
  }

  const columns: DataTableColumn<Contact>[] = [
    {
      id: "name",
      header: "Contact",
      cell: (r) => (
        <div>
          <p className="font-medium">
            {r.name ??
              ([r.firstName, r.lastName].filter(Boolean).join(" ") || "—")}
          </p>
          <p className="text-xs text-muted-foreground">
            {r.designation ?? r.title ?? "—"}
          </p>
        </div>
      ),
    },
    { id: "email", header: "Email", cell: (r) => r.email ?? "—" },
    { id: "phone", header: "Phone", cell: (r) => r.phone ?? "—" },
    {
      id: "department",
      header: "Department",
      cell: (r) => r.department ?? "—",
    },
    {
      id: "score",
      header: "Score",
      cell: (r) =>
        r.relationshipScore != null ? String(r.relationshipScore) : "—",
    },
    {
      id: "customer",
      header: "Customer",
      cell: (r) => r.customer?.name ?? "—",
    },
    { id: "created", header: "Created", cell: (r) => formatDate(r.createdAt) },
    {
      id: "actions",
      header: "",
      className: "w-[1%] text-right",
      cell: (r) => (
        <div className="flex justify-end gap-1">
          {can("contacts:write") ? (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => openEdit(r)}
            >
              <Pencil className="size-3.5" />
            </Button>
          ) : null}
          {can("contacts:delete") ? (
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
          placeholder="Search contacts…"
          className="max-w-xs"
        />
        {can("contacts:write") ? (
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            New contact
          </Button>
        ) : null}
      </div>

      {query.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : query.isError ? (
        <EmptyState
          title="Failed to load contacts"
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
          emptyTitle="No contacts yet"
          emptyDescription="Add contacts to link people to accounts."
        />
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit contact" : "Create contact"}
            </DialogTitle>
          </DialogHeader>
          <form
            className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1"
            onSubmit={form.handleSubmit((values) =>
              saveMutation.mutateAsync(values),
            )}
          >
            <Field label="Name *" error={form.formState.errors.name?.message}>
              <Input {...form.register("name")} required />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Designation">
                <Input {...form.register("designation")} />
              </Field>
              <Field label="Department">
                <Input {...form.register("department")} />
              </Field>
              <Field label="Email" error={form.formState.errors.email?.message}>
                <Input type="email" {...form.register("email")} />
              </Field>
              <Field label="Phone">
                <Input {...form.register("phone")} />
              </Field>
              <Field label="WhatsApp">
                <Input {...form.register("whatsapp")} />
              </Field>
              <Field label="Birthday">
                <Input type="date" {...form.register("birthday")} />
              </Field>
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
              <Field label="Relationship score (0–100)">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  {...form.register("relationshipScore")}
                />
              </Field>
              <Field label="LinkedIn URL">
                <Input {...form.register("linkedinUrl")} placeholder="https://" />
              </Field>
              <Field label="Twitter URL">
                <Input {...form.register("twitterUrl")} placeholder="https://" />
              </Field>
              <Field label="Facebook URL">
                <Input {...form.register("facebookUrl")} placeholder="https://" />
              </Field>
              <Field label="Tags (comma-separated)">
                <Input
                  {...form.register("tags")}
                  placeholder="vip, decision-maker"
                />
              </Field>
            </div>
            <Field label="Notes">
              <Textarea rows={3} {...form.register("notes")} />
            </Field>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete contact?"
        description={`This will archive ${deleting?.name ?? "this contact"}.`}
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
