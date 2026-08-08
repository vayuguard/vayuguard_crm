"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil } from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency, formatDate } from "@/lib/utils";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import {
  CustomerForm,
  toCustomerPayload,
  type CustomerFormValues,
} from "@/features/customers/customer-form";

type CustomerDetail = {
  id: string;
  customerNumber?: string;
  name: string;
  legalName?: string | null;
  industry?: string | null;
  website?: string | null;
  email?: string | null;
  phone?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  billingAddress?: string | null;
  billingCity?: string | null;
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
  assignedTo?: { id: string; name?: string | null; email?: string | null } | null;
  createdAt?: string;
  contacts?: {
    id: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    designation?: string | null;
  }[];
  projects?: {
    id: string;
    name: string;
    status?: string | null;
    createdAt?: string;
  }[];
  invoices?: {
    id: string;
    invoiceNumber?: string;
    status?: string | null;
    paymentStatus?: string | null;
    total?: number | string | null;
    dueDate?: string | null;
    payments?: {
      id: string;
      paymentNumber?: string;
      amount?: number | string;
      method?: string | null;
      paidAt?: string;
    }[];
  }[];
  payments?: {
    id: string;
    paymentNumber?: string;
    amount?: number | string;
    method?: string | null;
    paidAt?: string;
    invoice?: { invoiceNumber?: string } | null;
  }[];
  deals?: {
    id: string;
    title?: string;
    expectedRevenue?: number | string | null;
    stage?: { name?: string } | null;
    pipeline?: { name?: string } | null;
    updatedAt?: string;
  }[];
  tickets?: {
    id: string;
    ticketNumber?: string;
    subject?: string;
    status?: string | null;
    priority?: string | null;
    createdAt?: string;
  }[];
  documents?: {
    id: string;
    name: string;
    category?: string;
    fileUrl?: string;
    createdAt?: string;
  }[];
  communications?: {
    id: string;
    type?: string;
    subject?: string | null;
    body?: string | null;
    direction?: string;
    createdAt?: string;
    author?: { name?: string | null } | null;
  }[];
  quotations?: {
    id: string;
    quoteNumber?: string;
    status?: string | null;
    total?: number | string | null;
    createdAt?: string;
  }[];
  tasks?: {
    id: string;
    title: string;
    status?: string;
    dueAt?: string | null;
    createdAt?: string;
  }[];
  meetings?: {
    id: string;
    title: string;
    startsAt?: string;
    createdAt?: string;
  }[];
  _count?: Record<string, number>;
};

export function CustomerDetailView({ customerId }: { customerId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const [editOpen, setEditOpen] = React.useState(false);

  const query = useQuery({
    queryKey: ["customers", customerId],
    queryFn: async () => {
      const res = await apiFetch<CustomerDetail>(`/api/customers/${customerId}`);
      return res.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: CustomerFormValues) =>
      apiFetch(`/api/customers/${customerId}`, {
        method: "PATCH",
        body: JSON.stringify(toCustomerPayload(values)),
      }),
    onSuccess: () => {
      toast.success("Customer updated");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  if (query.isLoading) return <LoadingSkeleton rows={8} />;

  if (query.isError || !query.data) {
    return (
      <EmptyState
        title="Customer not found"
        description={(query.error as Error)?.message ?? "Unable to load customer."}
        action={
          <Button variant="outline" onClick={() => router.push("/customers")}>
            Back to customers
          </Button>
        }
      />
    );
  }

  const c = query.data;
  const nestedPayments =
    c.payments ??
    c.invoices?.flatMap((inv) =>
      (inv.payments ?? []).map((p) => ({
        ...p,
        invoice: { invoiceNumber: inv.invoiceNumber },
      })),
    ) ??
    [];

  const timeline = [
    ...(c.communications ?? []).map((x) => ({
      id: `comm-${x.id}`,
      at: x.createdAt,
      label: x.subject || x.type || "Communication",
      detail: x.body,
      kind: "Communication",
    })),
    ...(c.notes
      ? [
          {
            id: "notes",
            at: c.createdAt,
            label: "Account notes",
            detail: c.notes,
            kind: "Notes",
          },
        ]
      : []),
    ...(c.tasks ?? []).map((t) => ({
      id: `task-${t.id}`,
      at: t.createdAt ?? t.dueAt ?? undefined,
      label: t.title,
      detail: t.status,
      kind: "Task",
    })),
    ...(c.meetings ?? []).map((m) => ({
      id: `meet-${m.id}`,
      at: m.startsAt ?? m.createdAt,
      label: m.title,
      detail: undefined as string | null | undefined,
      kind: "Meeting",
    })),
  ].sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return tb - ta;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 gap-1 text-muted-foreground"
            onClick={() => router.push("/customers")}
          >
            <ArrowLeft className="size-3.5" />
            Customers
          </Button>
          <h1 className="text-xl font-semibold tracking-tight">{c.name}</h1>
          <p className="text-sm text-muted-foreground">
            {[c.customerNumber, c.legalName, c.industry]
              .filter(Boolean)
              .join(" · ") || "Customer 360"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {c.assignedTo ? (
            <Badge variant="outline">
              {c.assignedTo.name ?? c.assignedTo.email}
            </Badge>
          ) : null}
          {can("customers:write") ? (
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" />
              Edit
            </Button>
          ) : null}
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contacts">
            Contacts ({c.contacts?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="projects">
            Projects ({c.projects?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="invoices">
            Invoices ({c.invoices?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="payments">
            Payments ({nestedPayments.length})
          </TabsTrigger>
          <TabsTrigger value="tickets">
            Tickets ({c.tickets?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="documents">
            Documents ({c.documents?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="communications">
            Communications ({c.communications?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="deals">
            Deals ({c.deals?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="timeline">Notes / Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <DetailRow label="Email" value={c.email} />
            <DetailRow label="Phone" value={c.phone} />
            <DetailRow label="Website" value={c.website} />
            <DetailRow label="GST" value={c.gstNumber} />
            <DetailRow label="PAN" value={c.panNumber} />
            <DetailRow
              label="Assignee"
              value={c.assignedTo?.name ?? c.assignedTo?.email}
            />
            <DetailRow
              label="Billing"
              value={[
                c.billingAddress,
                c.billingCity,
                c.billingState,
                c.billingPinCode,
                c.billingCountry,
              ]
                .filter(Boolean)
                .join(", ")}
            />
            <DetailRow
              label="Shipping"
              value={[
                c.shippingAddress,
                c.shippingCity,
                c.shippingState,
                c.shippingPinCode,
                c.shippingCountry,
              ]
                .filter(Boolean)
                .join(", ")}
            />
            <DetailRow label="Created" value={formatDate(c.createdAt)} />
          </div>
          {c.notes ? (
            <>
              <Separator />
              <div>
                <p className="text-xs text-muted-foreground">Notes</p>
                <p className="mt-1 whitespace-pre-wrap text-sm">{c.notes}</p>
              </div>
            </>
          ) : null}
          {(c.quotations?.length ?? 0) > 0 ? (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-sm font-medium">Recent quotations</p>
                {c.quotations?.slice(0, 5).map((q) => (
                  <ListRow
                    key={q.id}
                    title={q.quoteNumber ?? q.id}
                    meta={[q.status, formatCurrency(q.total)]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ))}
              </div>
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="contacts" className="mt-4 space-y-2">
          <EmptyOrList
            items={c.contacts}
            empty="No contacts linked."
            render={(item) => (
              <ListRow
                key={item.id}
                title={item.name}
                meta={[item.designation, item.email, item.phone]
                  .filter(Boolean)
                  .join(" · ")}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="projects" className="mt-4 space-y-2">
          <EmptyOrList
            items={c.projects}
            empty="No projects yet."
            render={(p) => (
              <ListRow
                key={p.id}
                title={p.name}
                meta={[p.status, formatDate(p.createdAt)]
                  .filter(Boolean)
                  .join(" · ")}
                badge={p.status}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="invoices" className="mt-4 space-y-2">
          <EmptyOrList
            items={c.invoices}
            empty="No invoices."
            render={(inv) => (
              <ListRow
                key={inv.id}
                title={inv.invoiceNumber ?? inv.id}
                meta={[
                  inv.paymentStatus ?? inv.status,
                  formatCurrency(inv.total),
                  formatDate(inv.dueDate),
                ]
                  .filter(Boolean)
                  .join(" · ")}
                href={`/invoices`}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="payments" className="mt-4 space-y-2">
          <EmptyOrList
            items={nestedPayments}
            empty="No payments recorded."
            render={(p) => (
              <ListRow
                key={p.id}
                title={p.paymentNumber ?? formatCurrency(p.amount)}
                meta={[
                  formatCurrency(p.amount),
                  p.method,
                  formatDate(p.paidAt),
                  p.invoice?.invoiceNumber,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="tickets" className="mt-4 space-y-2">
          <EmptyOrList
            items={c.tickets}
            empty="No support tickets."
            render={(t) => (
              <ListRow
                key={t.id}
                title={t.subject ?? t.ticketNumber ?? t.id}
                meta={[t.status, t.priority, formatDate(t.createdAt)]
                  .filter(Boolean)
                  .join(" · ")}
                badge={t.status}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="documents" className="mt-4 space-y-2">
          <EmptyOrList
            items={c.documents}
            empty="No documents."
            render={(d) => (
              <ListRow
                key={d.id}
                title={d.name}
                meta={[d.category, formatDate(d.createdAt)]
                  .filter(Boolean)
                  .join(" · ")}
                href={d.fileUrl}
                external
              />
            )}
          />
        </TabsContent>

        <TabsContent value="communications" className="mt-4 space-y-2">
          <EmptyOrList
            items={c.communications}
            empty="No communications logged."
            render={(x) => (
              <ListRow
                key={x.id}
                title={x.subject || x.type || "Message"}
                meta={[
                  x.direction,
                  x.author?.name,
                  formatDate(x.createdAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="deals" className="mt-4 space-y-2">
          <EmptyOrList
            items={c.deals}
            empty="No deals / purchase history."
            render={(d) => (
              <ListRow
                key={d.id}
                title={d.title ?? d.id}
                meta={[
                  d.stage?.name,
                  d.pipeline?.name,
                  formatCurrency(d.expectedRevenue),
                  formatDate(d.updatedAt),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              />
            )}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4 space-y-2">
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No timeline events.</p>
          ) : (
            timeline.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-border px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{item.label}</p>
                  <Badge variant="outline">{item.kind}</Badge>
                </div>
                {item.detail ? (
                  <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">
                    {item.detail}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatDate(item.at)}
                </p>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl" showCloseButton>
          <DialogHeader>
            <DialogTitle>Edit customer</DialogTitle>
          </DialogHeader>
          <CustomerForm
            defaultValues={{
              name: c.name,
              legalName: c.legalName ?? "",
              industry: c.industry ?? "",
              website: c.website ?? "",
              email: c.email ?? "",
              phone: c.phone ?? "",
              gstNumber: c.gstNumber ?? "",
              panNumber: c.panNumber ?? "",
              billingAddress: c.billingAddress ?? "",
              billingCity: c.billingCity ?? "",
              billingState: c.billingState ?? "",
              billingCountry: c.billingCountry ?? "India",
              billingPinCode: c.billingPinCode ?? "",
              shippingAddress: c.shippingAddress ?? "",
              shippingCity: c.shippingCity ?? "",
              shippingState: c.shippingState ?? "",
              shippingCountry: c.shippingCountry ?? "India",
              shippingPinCode: c.shippingPinCode ?? "",
              notes: c.notes ?? "",
              assignedToId: c.assignedToId ?? "",
            }}
            submitting={updateMutation.isPending}
            submitLabel="Update"
            onCancel={() => setEditOpen(false)}
            onSubmit={async (values) => {
              await updateMutation.mutateAsync(values);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | null;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}

function ListRow({
  title,
  meta,
  badge,
  href,
  external,
}: {
  title: string;
  meta?: string;
  badge?: string | null;
  href?: string;
  external?: boolean;
}) {
  const inner = (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{title}</p>
        {meta ? (
          <p className="truncate text-xs text-muted-foreground">{meta}</p>
        ) : null}
      </div>
      {badge ? <Badge variant="outline">{badge}</Badge> : null}
    </div>
  );
  if (!href) return inner;
  if (external) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="block">
        {inner}
      </a>
    );
  }
  return (
    <Link href={href} className="block">
      {inner}
    </Link>
  );
}

function EmptyOrList<T>({
  items,
  empty,
  render,
}: {
  items?: T[];
  empty: string;
  render: (item: T) => React.ReactNode;
}) {
  if (!items || items.length === 0) {
    return <p className="text-sm text-muted-foreground">{empty}</p>;
  }
  return <>{items.map(render)}</>;
}
