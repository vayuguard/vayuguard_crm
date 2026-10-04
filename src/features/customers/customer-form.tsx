"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { apiFetch, unwrapList } from "@/lib/api-client";
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

export const customerFormSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  legalName: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().optional(),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional(),
  gstNumber: z.string().optional(),
  panNumber: z.string().optional(),
  gstTreatment: z.string().optional(),
  placeOfSupply: z.string().optional(),
  billingAddress: z.string().optional(),
  billingCity: z.string().optional(),
  billingState: z.string().optional(),
  billingCountry: z.string().optional(),
  billingPinCode: z.string().optional(),
  shippingAddress: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingCountry: z.string().optional(),
  shippingPinCode: z.string().optional(),
  notes: z.string().optional(),
  assignedToId: z.string().optional(),
});

export type CustomerFormValues = z.infer<typeof customerFormSchema>;

type Employee = { id: string; name?: string | null; email?: string | null };

type CustomerFormProps = {
  defaultValues?: Partial<CustomerFormValues>;
  onSubmit: (values: CustomerFormValues) => Promise<void> | void;
  onCancel?: () => void;
  submitting?: boolean;
  submitLabel?: string;
};

const emptyDefaults: CustomerFormValues = {
  name: "",
  legalName: "",
  industry: "",
  website: "",
  email: "",
  phone: "",
  gstNumber: "",
  panNumber: "",
  gstTreatment: "",
  placeOfSupply: "",
  billingAddress: "",
  billingCity: "",
  billingState: "",
  billingCountry: "India",
  billingPinCode: "",
  shippingAddress: "",
  shippingCity: "",
  shippingState: "",
  shippingCountry: "India",
  shippingPinCode: "",
  notes: "",
  assignedToId: "",
};

export function CustomerForm({
  defaultValues,
  onSubmit,
  onCancel,
  submitting,
  submitLabel = "Save",
}: CustomerFormProps) {
  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: { ...emptyDefaults, ...defaultValues },
  });

  const employeesQuery = useQuery({
    queryKey: ["employees", "assignees"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/employees?pageSize=100");
      return unwrapList<Employee>(res.data);
    },
  });

  const employees = employeesQuery.data ?? [];

  return (
    <form
      className="grid max-h-[70vh] gap-3 overflow-y-auto pr-1"
      onSubmit={form.handleSubmit(onSubmit)}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name *" error={form.formState.errors.name?.message}>
          <Input {...form.register("name")} required />
        </Field>
        <Field label="Legal name">
          <Input {...form.register("legalName")} />
        </Field>
        <Field label="Industry">
          <Input {...form.register("industry")} />
        </Field>
        <Field label="Website">
          <Input {...form.register("website")} placeholder="https://" />
        </Field>
        <Field label="Email" error={form.formState.errors.email?.message}>
          <Input type="email" {...form.register("email")} />
        </Field>
        <Field label="Phone">
          <Input {...form.register("phone")} />
        </Field>
        <Field label="GST number">
          <Input {...form.register("gstNumber")} />
        </Field>
        <Field label="PAN number">
          <Input {...form.register("panNumber")} />
        </Field>
        <Field label="GST treatment">
          <Input
            {...form.register("gstTreatment")}
            placeholder="business_gst / consumer"
          />
        </Field>
        <Field label="Place of supply">
          <Input
            {...form.register("placeOfSupply")}
            placeholder="State code e.g. 27"
          />
        </Field>
      </div>

      <p className="pt-1 text-xs font-medium text-muted-foreground">
        Billing address
      </p>
      <Field label="Address">
        <Textarea rows={2} {...form.register("billingAddress")} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="City">
          <Input {...form.register("billingCity")} />
        </Field>
        <Field label="State">
          <Input {...form.register("billingState")} />
        </Field>
        <Field label="Country">
          <Input {...form.register("billingCountry")} />
        </Field>
        <Field label="PIN code">
          <Input {...form.register("billingPinCode")} />
        </Field>
      </div>

      <p className="pt-1 text-xs font-medium text-muted-foreground">
        Shipping address
      </p>
      <Field label="Address">
        <Textarea rows={2} {...form.register("shippingAddress")} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="City">
          <Input {...form.register("shippingCity")} />
        </Field>
        <Field label="State">
          <Input {...form.register("shippingState")} />
        </Field>
        <Field label="Country">
          <Input {...form.register("shippingCountry")} />
        </Field>
        <Field label="PIN code">
          <Input {...form.register("shippingPinCode")} />
        </Field>
      </div>

      <Field label="Assigned to">
        <Select
          value={form.watch("assignedToId") || "__none__"}
          onValueChange={(v) =>
            form.setValue("assignedToId", v === "__none__" ? "" : (v ?? ""))
          }
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Unassigned</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name ?? e.email ?? e.id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field label="Notes">
        <Textarea rows={3} {...form.register("notes")} />
      </Field>

      <div className="flex justify-end gap-2 border-t border-border pt-3">
        {onCancel ? (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
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

export function toCustomerPayload(values: CustomerFormValues) {
  return {
    name: values.name,
    legalName: values.legalName || null,
    industry: values.industry || null,
    website: values.website || null,
    email: values.email || null,
    phone: values.phone || null,
    gstNumber: values.gstNumber || null,
    panNumber: values.panNumber || null,
    gstTreatment: values.gstTreatment || null,
    placeOfSupply: values.placeOfSupply || null,
    billingAddress: values.billingAddress || null,
    billingCity: values.billingCity || null,
    billingState: values.billingState || null,
    billingCountry: values.billingCountry || null,
    billingPinCode: values.billingPinCode || null,
    shippingAddress: values.shippingAddress || null,
    shippingCity: values.shippingCity || null,
    shippingState: values.shippingState || null,
    shippingCountry: values.shippingCountry || null,
    shippingPinCode: values.shippingPinCode || null,
    notes: values.notes || null,
    assignedToId: values.assignedToId || null,
  };
}
