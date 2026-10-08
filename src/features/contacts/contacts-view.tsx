"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  Building2,
  Pencil,
  Plus,
  ScanLine,
  Trash2,
  UserPlus,
} from "lucide-react";
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
import {
  CardScanDialog,
  type ScannedContact,
} from "@/features/contacts/card-scan-dialog";
import { BulkExcelActions } from "@/components/shared/bulk-excel-actions";

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

const INTEREST_OPTIONS = [
  { value: "not_interested", label: "Not interested", score: 0 },
  { value: "cold", label: "Cold", score: 25 },
  { value: "warm", label: "Warm", score: 50 },
  { value: "interested", label: "Interested", score: 75 },
  { value: "hot", label: "Hot", score: 100 },
] as const;

type InterestValue = (typeof INTEREST_OPTIONS)[number]["value"];

function interestFromScore(score: number | null | undefined): InterestValue {
  const s = score ?? 50;
  if (s <= 12) return "not_interested";
  if (s <= 37) return "cold";
  if (s <= 62) return "warm";
  if (s <= 87) return "interested";
  return "hot";
}

function scoreFromInterest(interest: InterestValue): number {
  return (
    INTEREST_OPTIONS.find((o) => o.value === interest)?.score ?? 50
  );
}

function interestLabel(score: number | null | undefined): string {
  const value = interestFromScore(score);
  return INTEREST_OPTIONS.find((o) => o.value === value)?.label ?? "Warm";
}

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
  interest: z.enum([
    "not_interested",
    "cold",
    "warm",
    "interested",
    "hot",
  ]),
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
  interest: "warm",
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
    relationshipScore: scoreFromInterest(values.interest),
    tags: values.tags || "",
  };
}

/** Strips legal suffixes and punctuation so "Acme Pvt. Ltd." ≈ "Acme". */
function normalizeCompany(value: string) {
  return value
    .toLowerCase()
    .replace(
      /\b(?:pvt|private|ltd|limited|llp|inc|incorporated|corp|corporation|co|company)\b/g,
      " ",
    )
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchCustomerId(company: string, customers: CustomerOption[]) {
  const target = normalizeCompany(company);
  if (target.length < 3) return "";
  const match = customers.find((c) => {
    const name = normalizeCompany(c.name);
    return name.length >= 3 && (name === target || name.includes(target) || target.includes(name));
  });
  return match?.id ?? "";
}

/** Maps OCR output onto the contact form; unmapped card details go into notes. */
function scanToFormValues(
  card: ScannedContact,
  customers: CustomerOption[],
): ContactFormValues {
  const customerId = card.company ? matchCustomerId(card.company, customers) : "";
  const noteLines = [
    !customerId && card.company ? `Company: ${card.company}` : "",
    card.website ? `Website: ${card.website}` : "",
    card.address ? `Address: ${card.address}` : "",
  ].filter(Boolean);

  return {
    ...emptyForm,
    name: card.name.trim(),
    designation: card.designation,
    email: card.email,
    phone: card.phone,
    whatsapp: card.whatsapp,
    customerId,
    linkedinUrl: card.linkedinUrl,
    twitterUrl: card.twitterUrl,
    facebookUrl: card.facebookUrl,
    notes: noteLines.join("\n"),
    tags: "scanned-card",
  };
}

export function ContactsView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [search, setSearch] = React.useState("");
  const [debounced, setDebounced] = React.useState("");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [scanOpen, setScanOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Contact | null>(null);
  const [deleting, setDeleting] = React.useState<Contact | null>(null);
  const [toLead, setToLead] = React.useState<Contact | null>(null);
  const [toCustomer, setToCustomer] = React.useState<Contact | null>(null);
  const [companyName, setCompanyName] = React.useState("");

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
      const res = await apiFetch<unknown>(
        "/api/customers?pageSize=100&order=asc&sort=name",
      );
      return unwrapList<CustomerOption>(res.data);
    },
    enabled: dialogOpen || scanOpen,
  });

  const saveMutation = useMutation({
    // `id` is passed explicitly rather than read from `editing`, so a scan can
    // always create a new contact even if an edit was opened earlier.
    mutationFn: async ({
      values,
      id,
    }: {
      values: ContactFormValues;
      id?: string | null;
    }) => {
      const body = toPayload(values);
      if (id) {
        return apiFetch(`/api/contacts/${id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      }
      return apiFetch("/api/contacts", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    onSuccess: (_data, variables) => {
      toast.success(variables.id ? "Contact updated" : "Contact created");
      setDialogOpen(false);
      setScanOpen(false);
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

  const toLeadMutation = useMutation({
    mutationFn: async (id: string) =>
      apiFetch<{ lead: { id: string } }>(`/api/contacts/${id}/to-lead`, {
        method: "POST",
      }),
    onSuccess: (res) => {
      toast.success("Lead created from contact");
      setToLead(null);
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      const leadId = (res.data as { lead?: { id: string } } | undefined)?.lead
        ?.id;
      if (leadId) router.push(`/leads/${leadId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toCustomerMutation = useMutation({
    mutationFn: async ({
      id,
      companyName: name,
    }: {
      id: string;
      companyName?: string;
    }) =>
      apiFetch<{ customer: { id: string } }>(
        `/api/contacts/${id}/to-customer`,
        {
          method: "POST",
          body: JSON.stringify({ companyName: name || null }),
        },
      ),
    onSuccess: (res) => {
      toast.success("Customer created and contact linked");
      setToCustomer(null);
      setCompanyName("");
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      const customerId = (
        res.data as { customer?: { id: string } } | undefined
      )?.customer?.id;
      if (customerId) router.push(`/customers/${customerId}`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreate() {
    setEditing(null);
    form.reset(emptyForm);
    setDialogOpen(true);
  }

  /** Saves the scanned card straight into a new contact row. */
  function handleScanConfirm(card: ScannedContact) {
    setEditing(null);
    saveMutation.mutate({
      values: scanToFormValues(card, customersQuery.data ?? []),
    });
  }

  /** Sends the scanned details to the full form so more fields can be added. */
  function handleScanEditInForm(card: ScannedContact) {
    setEditing(null);
    form.reset(scanToFormValues(card, customersQuery.data ?? []));
    setScanOpen(false);
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
      interest: interestFromScore(contact.relationshipScore),
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
      id: "interest",
      header: "Interest",
      cell: (r) => interestLabel(r.relationshipScore),
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
          {can("contacts:write") && can("leads:write") ? (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Convert to lead"
              onClick={() => setToLead(r)}
            >
              <UserPlus className="size-3.5" />
            </Button>
          ) : null}
          {can("contacts:write") &&
          can("customers:write") &&
          !r.customerId &&
          !r.customer?.id ? (
            <Button
              variant="ghost"
              size="icon-sm"
              title="Convert to customer"
              onClick={() => {
                setCompanyName("");
                setToCustomer(r);
              }}
            >
              <Building2 className="size-3.5" />
            </Button>
          ) : null}
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
        <div className="flex flex-wrap items-center gap-2">
          <BulkExcelActions
            entityLabel="contacts"
            queryKey={["contacts"]}
            exportUrl={
              debounced
                ? `/api/contacts/export?q=${encodeURIComponent(debounced)}`
                : "/api/contacts/export"
            }
            templateUrl="/api/contacts/export?template=1"
            importUrl="/api/contacts/import"
            canExport={can("contacts:export")}
            canImport={can("contacts:import")}
          />
          {can("contacts:write") ? (
            <>
              <Button variant="outline" onClick={() => setScanOpen(true)}>
                <ScanLine className="size-4" />
                Scan card
              </Button>
              <Button onClick={openCreate}>
                <Plus className="size-4" />
                New contact
              </Button>
            </>
          ) : null}
        </div>
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
              saveMutation.mutateAsync({ values, id: editing?.id }),
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
              <Field
                label="Customer (company account)"
                error={
                  customersQuery.isError
                    ? (customersQuery.error as Error).message
                    : undefined
                }
              >
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
                    <SelectValue placeholder="Link to a customer…" />
                  </SelectTrigger>
                  <SelectContent
                    alignItemWithTrigger={false}
                    className="z-[200]"
                  >
                    <SelectItem value="__none__">None</SelectItem>
                    {customersQuery.isLoading ? (
                      <SelectItem value="__loading__" disabled>
                        Loading customers…
                      </SelectItem>
                    ) : null}
                    {(customersQuery.data ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Optional — which company this person belongs to. Create
                  customers under Customers first if the list is empty.
                </p>
              </Field>
              <Field label="Interest">
                <Select
                  value={form.watch("interest")}
                  onValueChange={(v) =>
                    form.setValue(
                      "interest",
                      (v as InterestValue) || "warm",
                    )
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select interest" />
                  </SelectTrigger>
                  <SelectContent
                    alignItemWithTrigger={false}
                    className="z-[200]"
                  >
                    {INTEREST_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      <CardScanDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onConfirm={handleScanConfirm}
        onEditInForm={handleScanEditInForm}
        saving={saveMutation.isPending}
      />

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

      <ConfirmDialog
        open={!!toLead}
        onOpenChange={(open) => !open && setToLead(null)}
        title="Convert to lead?"
        description={`Create a new lead from ${toLead?.name ?? "this contact"}. The contact record stays unchanged.`}
        confirmLabel="Create lead"
        loading={toLeadMutation.isPending}
        onConfirm={() => {
          if (toLead) toLeadMutation.mutate(toLead.id);
        }}
      />

      <Dialog
        open={!!toCustomer}
        onOpenChange={(open) => {
          if (!open) {
            setToCustomer(null);
            setCompanyName("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Convert to customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Creates a customer account and links{" "}
              {toCustomer?.name ?? "this contact"} to it.
            </p>
            <Field label="Company / customer name (optional)">
              <Input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={toCustomer?.name ?? "Company name"}
              />
            </Field>
            <div className="flex justify-end gap-2 border-t border-border pt-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setToCustomer(null)}
              >
                Cancel
              </Button>
              <Button
                disabled={toCustomerMutation.isPending}
                onClick={() => {
                  if (toCustomer) {
                    toCustomerMutation.mutate({
                      id: toCustomer.id,
                      companyName: companyName.trim() || undefined,
                    });
                  }
                }}
              >
                {toCustomerMutation.isPending ? "Creating…" : "Create customer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
