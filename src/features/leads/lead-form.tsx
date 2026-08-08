"use client";

import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const leadFormSchema = z.object({
  name: z.string().min(2, "Name is required"),
  company: z.string().optional(),
  industry: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pinCode: z.string().optional(),
  source: z.string().optional(),
  campaignId: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  status: z.enum([
    "NEW",
    "CONTACTED",
    "QUALIFIED",
    "PROPOSAL",
    "NEGOTIATION",
    "WON",
    "LOST",
    "HOLD",
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  estimatedDealValue: z.coerce.number().min(0).optional().nullable(),
  expectedClosingDate: z.string().optional(),
  notes: z.string().optional(),
  tags: z.string().optional(),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;

export const LEAD_STATUSES = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
  "HOLD",
] as const;

export const LEAD_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export type LeadFormOption = { id: string; label: string };

type LeadFormProps = {
  defaultValues?: Partial<LeadFormValues>;
  onSubmit: (values: LeadFormValues) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
  assignees?: LeadFormOption[];
  campaigns?: LeadFormOption[];
};

export function LeadForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitting,
  assignees = [],
  campaigns = [],
}: LeadFormProps) {
  const form = useForm<LeadFormValues>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: "",
      company: "",
      industry: "",
      email: "",
      phone: "",
      whatsapp: "",
      website: "",
      address: "",
      city: "",
      state: "",
      country: "India",
      pinCode: "",
      source: "",
      campaignId: null,
      assignedToId: null,
      status: "NEW",
      priority: "MEDIUM",
      estimatedDealValue: undefined,
      expectedClosingDate: "",
      notes: "",
      tags: "",
      ...defaultValues,
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *" error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} placeholder="Contact name" />
        </Field>
        <Field label="Company">
          <Input {...form.register("company")} placeholder="Company" />
        </Field>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input
            type="email"
            {...form.register("email")}
            placeholder="email@company.com"
          />
        </Field>
        <Field label="Phone">
          <Input {...form.register("phone")} placeholder="+91…" />
        </Field>
        <Field label="WhatsApp">
          <Input {...form.register("whatsapp")} />
        </Field>
        <Field label="Website">
          <Input {...form.register("website")} placeholder="https://" />
        </Field>
        <Field label="Industry">
          <Input {...form.register("industry")} />
        </Field>
        <Field label="Source">
          <Input
            {...form.register("source")}
            placeholder="Website, referral…"
          />
        </Field>
        <Field label="Status">
          <Select
            value={form.watch("status")}
            onValueChange={(v) =>
              form.setValue("status", v as LeadFormValues["status"])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Priority">
          <Select
            value={form.watch("priority")}
            onValueChange={(v) =>
              form.setValue("priority", v as LeadFormValues["priority"])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LEAD_PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Campaign">
          <Select
            value={form.watch("campaignId") ?? "none"}
            onValueChange={(v) =>
              form.setValue("campaignId", !v || v === "none" ? null : v)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Assigned to">
          <Select
            value={form.watch("assignedToId") ?? "none"}
            onValueChange={(v) =>
              form.setValue("assignedToId", !v || v === "none" ? null : v)
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Unassigned" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {assignees.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Est. deal value">
          <Input
            type="number"
            min={0}
            {...form.register("estimatedDealValue")}
            placeholder="0"
          />
        </Field>
        <Field label="Expected closing">
          <Input type="date" {...form.register("expectedClosingDate")} />
        </Field>
        <Field label="City">
          <Input {...form.register("city")} />
        </Field>
        <Field label="State">
          <Input {...form.register("state")} />
        </Field>
        <Field label="Country">
          <Input {...form.register("country")} />
        </Field>
        <Field label="PIN code">
          <Input {...form.register("pinCode")} />
        </Field>
      </div>
      <Field label="Address">
        <Input {...form.register("address")} />
      </Field>
      <Field label="Tags (comma-separated)">
        <Input
          {...form.register("tags")}
          placeholder="hot, enterprise, renewals"
        />
      </Field>
      <Field label="Notes">
        <Textarea
          rows={3}
          {...form.register("notes")}
          placeholder="Context, next steps…"
        />
      </Field>
      <div className="flex justify-end gap-2 border-t border-border pt-3">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : "Save lead"}
        </Button>
      </div>
    </form>
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
