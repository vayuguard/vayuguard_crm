"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { apiFetch, unwrapList } from "@/lib/api-client";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";

type CompanySettings = {
  id?: string;
  companyName?: string;
  logoUrl?: string | null;
  brandPrimary?: string | null;
  brandSecondary?: string | null;
  gstNumber?: string | null;
  panNumber?: string | null;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  currency?: string | null;
  timezone?: string | null;
  emailSettings?: Record<string, unknown> | null;
  smsSettings?: Record<string, unknown> | null;
  whatsappSettings?: Record<string, unknown> | null;
  featureFlags?: Record<string, unknown> | null;
};

type PermissionItem = { key: string; name: string; module: string } | string;

type RolesPayload = {
  roles: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
    isSystem?: boolean;
    userCount?: number;
    permissions: string[];
  }[];
  availablePermissions?: PermissionItem[];
};

type CustomField = {
  id: string;
  module: string;
  fieldKey: string;
  label: string;
  fieldType: string;
  options?: unknown;
  isRequired: boolean;
  position: number;
};

type Pipeline = {
  id: string;
  name: string;
  description?: string | null;
  isDefault?: boolean;
  stages?: { id: string; name: string; probability?: number; color?: string | null }[];
  _count?: { deals?: number };
};

function permissionKey(p: PermissionItem): string {
  return typeof p === "string" ? p : p.key;
}

function permissionLabel(p: PermissionItem): string {
  return typeof p === "string" ? p : `${p.name} (${p.key})`;
}

function safeJsonString(value: unknown): string {
  if (value == null) return "{\n}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{\n}";
  }
}

function parseJsonObject(raw: string, label: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${label} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      err instanceof Error ? err.message : `Invalid JSON in ${label}`,
    );
  }
}

export function SettingsView() {
  const { data: session } = useSession();
  const { can } = usePermissions();
  const queryClient = useQueryClient();
  const user = session?.user;
  const canWrite = can("settings:write");

  const settingsQuery = useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      const res = await apiFetch<CompanySettings>("/api/settings");
      return res.data;
    },
    enabled: can("settings:read"),
  });

  const rolesQuery = useQuery({
    queryKey: ["settings", "roles"],
    queryFn: async () => {
      const res = await apiFetch<RolesPayload>("/api/settings/roles");
      return res.data;
    },
    enabled: can("settings:read"),
  });

  const customFieldsQuery = useQuery({
    queryKey: ["settings", "custom-fields"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/settings/custom-fields");
      return unwrapList<CustomField>(res.data);
    },
    enabled: can("settings:read"),
  });

  const pipelinesQuery = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/pipelines");
      return unwrapList<Pipeline>(res.data);
    },
    enabled: can("deals:read"),
  });

  const [companyForm, setCompanyForm] = React.useState({
    companyName: "",
    email: "",
    phone: "",
    gstNumber: "",
    panNumber: "",
    address: "",
    logoUrl: "",
    brandPrimary: "#0d9488",
    brandSecondary: "#134e4a",
    currency: "INR",
    timezone: "Asia/Kolkata",
  });

  const [emailSettingsJson, setEmailSettingsJson] = React.useState("{\n}");
  const [smsSettingsJson, setSmsSettingsJson] = React.useState("{\n}");
  const [whatsappSettingsJson, setWhatsappSettingsJson] = React.useState("{\n}");
  const [flags, setFlags] = React.useState({
    aiEnabled: false,
    googleCalendarSync: false,
    whatsappCampaigns: false,
  });

  const [roleDrafts, setRoleDrafts] = React.useState<Record<string, string[]>>(
    {},
  );
  const [customFieldForm, setCustomFieldForm] = React.useState({
    module: "leads",
    fieldKey: "",
    label: "",
    fieldType: "text",
    isRequired: false,
  });
  const [pipelineName, setPipelineName] = React.useState("");

  React.useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    setCompanyForm({
      companyName: s.companyName ?? "",
      email: s.email ?? "",
      phone: s.phone ?? "",
      gstNumber: s.gstNumber ?? "",
      panNumber: s.panNumber ?? "",
      address: s.address ?? "",
      logoUrl: s.logoUrl ?? "",
      brandPrimary: s.brandPrimary ?? "#0d9488",
      brandSecondary: s.brandSecondary ?? "#134e4a",
      currency: s.currency ?? "INR",
      timezone: s.timezone ?? "Asia/Kolkata",
    });
    setEmailSettingsJson(safeJsonString(s.emailSettings ?? {}));
    setSmsSettingsJson(safeJsonString(s.smsSettings ?? {}));
    setWhatsappSettingsJson(safeJsonString(s.whatsappSettings ?? {}));
    const ff = (s.featureFlags ?? {}) as Record<string, unknown>;
    setFlags({
      aiEnabled: Boolean(ff.aiEnabled),
      googleCalendarSync: Boolean(ff.googleCalendarSync),
      whatsappCampaigns: Boolean(ff.whatsappCampaigns),
    });
  }, [settingsQuery.data]);

  React.useEffect(() => {
    const roles = rolesQuery.data?.roles;
    if (!roles) return;
    const next: Record<string, string[]> = {};
    for (const role of roles) {
      next[role.id] = [...role.permissions];
    }
    setRoleDrafts(next);
  }, [rolesQuery.data]);

  const saveCompanyMutation = useMutation({
    mutationFn: async () =>
      apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({
          companyName: companyForm.companyName || undefined,
          email: companyForm.email || null,
          phone: companyForm.phone || null,
          gstNumber: companyForm.gstNumber || null,
          panNumber: companyForm.panNumber || null,
          address: companyForm.address || null,
          logoUrl: companyForm.logoUrl || null,
          brandPrimary: companyForm.brandPrimary || undefined,
          brandSecondary: companyForm.brandSecondary || undefined,
          currency: companyForm.currency || undefined,
          timezone: companyForm.timezone || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("Company settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveChannelsMutation = useMutation({
    mutationFn: async () => {
      const emailSettings = parseJsonObject(emailSettingsJson, "Email settings");
      const smsSettings = parseJsonObject(smsSettingsJson, "SMS settings");
      const whatsappSettings = parseJsonObject(
        whatsappSettingsJson,
        "WhatsApp settings",
      );
      return apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ emailSettings, smsSettings, whatsappSettings }),
      });
    },
    onSuccess: () => {
      toast.success("Channel settings saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveFlagsMutation = useMutation({
    mutationFn: async () =>
      apiFetch("/api/settings", {
        method: "PATCH",
        body: JSON.stringify({ featureFlags: flags }),
      }),
    onSuccess: () => {
      toast.success("Feature flags saved");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveRoleMutation = useMutation({
    mutationFn: async (roleId: string) =>
      apiFetch("/api/settings/roles", {
        method: "PUT",
        body: JSON.stringify({
          roleId,
          permissionKeys: roleDrafts[roleId] ?? [],
        }),
      }),
    onSuccess: () => {
      toast.success("Role permissions saved");
      queryClient.invalidateQueries({ queryKey: ["settings", "roles"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createCustomFieldMutation = useMutation({
    mutationFn: async () =>
      apiFetch("/api/settings/custom-fields", {
        method: "POST",
        body: JSON.stringify(customFieldForm),
      }),
    onSuccess: () => {
      toast.success("Custom field created");
      setCustomFieldForm({
        module: "leads",
        fieldKey: "",
        label: "",
        fieldType: "text",
        isRequired: false,
      });
      queryClient.invalidateQueries({ queryKey: ["settings", "custom-fields"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createPipelineMutation = useMutation({
    mutationFn: async () =>
      apiFetch("/api/pipelines", {
        method: "POST",
        body: JSON.stringify({ name: pipelineName }),
      }),
    onSuccess: () => {
      toast.success("Pipeline created");
      setPipelineName("");
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const availablePermissions = rolesQuery.data?.availablePermissions ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Your profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row label="Name" value={user?.name ?? "—"} />
          <Row label="Email" value={user?.email ?? "—"} />
          <Row
            label="Role"
            value={
              user?.role ? (
                <Badge variant="secondary">{user.role}</Badge>
              ) : (
                "—"
              )
            }
          />
          <Separator />
          <div className="flex flex-wrap gap-1.5">
            {(user?.permissions ?? []).slice(0, 16).map((p) => (
              <Badge key={p} variant="outline" className="font-mono text-[10px]">
                {p}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {!can("settings:read") ? (
        <EmptyState
          title="Settings restricted"
          description="You need settings:read to view organization settings."
        />
      ) : settingsQuery.isLoading ? (
        <LoadingSkeleton rows={6} />
      ) : settingsQuery.isError ? (
        <EmptyState
          title="Could not load settings"
          description={(settingsQuery.error as Error).message}
        />
      ) : (
        <Tabs defaultValue="company">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="flags">Feature flags</TabsTrigger>
            <TabsTrigger value="roles">Roles & permissions</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="fields">Custom fields</TabsTrigger>
            <TabsTrigger value="pipelines">Pipelines</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  Company settings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form
                  className="grid gap-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!canWrite) {
                      toast.error("You do not have permission to save settings");
                      return;
                    }
                    saveCompanyMutation.mutate();
                  }}
                >
                  <Field label="Company name">
                    <Input
                      value={companyForm.companyName}
                      onChange={(e) =>
                        setCompanyForm((f) => ({
                          ...f,
                          companyName: e.target.value,
                        }))
                      }
                      disabled={!canWrite}
                    />
                  </Field>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Email">
                      <Input
                        value={companyForm.email}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            email: e.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </Field>
                    <Field label="Phone">
                      <Input
                        value={companyForm.phone}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            phone: e.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </Field>
                    <Field label="GST number">
                      <Input
                        value={companyForm.gstNumber}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            gstNumber: e.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </Field>
                    <Field label="PAN">
                      <Input
                        value={companyForm.panNumber}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            panNumber: e.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </Field>
                    <Field label="Logo URL">
                      <Input
                        value={companyForm.logoUrl}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            logoUrl: e.target.value,
                          }))
                        }
                        placeholder="https://"
                        disabled={!canWrite}
                      />
                    </Field>
                    <Field label="Currency">
                      <Input
                        value={companyForm.currency}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            currency: e.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </Field>
                    <Field label="Timezone">
                      <Input
                        value={companyForm.timezone}
                        onChange={(e) =>
                          setCompanyForm((f) => ({
                            ...f,
                            timezone: e.target.value,
                          }))
                        }
                        disabled={!canWrite}
                      />
                    </Field>
                    <Field label="Brand primary">
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          className="h-9 w-12 p-1"
                          value={companyForm.brandPrimary}
                          onChange={(e) =>
                            setCompanyForm((f) => ({
                              ...f,
                              brandPrimary: e.target.value,
                            }))
                          }
                          disabled={!canWrite}
                        />
                        <Input
                          value={companyForm.brandPrimary}
                          onChange={(e) =>
                            setCompanyForm((f) => ({
                              ...f,
                              brandPrimary: e.target.value,
                            }))
                          }
                          disabled={!canWrite}
                        />
                      </div>
                    </Field>
                    <Field label="Brand secondary">
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          className="h-9 w-12 p-1"
                          value={companyForm.brandSecondary}
                          onChange={(e) =>
                            setCompanyForm((f) => ({
                              ...f,
                              brandSecondary: e.target.value,
                            }))
                          }
                          disabled={!canWrite}
                        />
                        <Input
                          value={companyForm.brandSecondary}
                          onChange={(e) =>
                            setCompanyForm((f) => ({
                              ...f,
                              brandSecondary: e.target.value,
                            }))
                          }
                          disabled={!canWrite}
                        />
                      </div>
                    </Field>
                  </div>
                  <Field label="Address">
                    <Textarea
                      rows={2}
                      value={companyForm.address}
                      onChange={(e) =>
                        setCompanyForm((f) => ({
                          ...f,
                          address: e.target.value,
                        }))
                      }
                      disabled={!canWrite}
                    />
                  </Field>
                  {canWrite ? (
                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={saveCompanyMutation.isPending}
                      >
                        {saveCompanyMutation.isPending
                          ? "Saving…"
                          : "Save company"}
                      </Button>
                    </div>
                  ) : null}
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="channels" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  Channel settings (JSON)
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <Field label="Email settings">
                  <Textarea
                    rows={6}
                    className="font-mono text-xs"
                    value={emailSettingsJson}
                    onChange={(e) => setEmailSettingsJson(e.target.value)}
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="SMS settings">
                  <Textarea
                    rows={6}
                    className="font-mono text-xs"
                    value={smsSettingsJson}
                    onChange={(e) => setSmsSettingsJson(e.target.value)}
                    disabled={!canWrite}
                  />
                </Field>
                <Field label="WhatsApp settings">
                  <Textarea
                    rows={6}
                    className="font-mono text-xs"
                    value={whatsappSettingsJson}
                    onChange={(e) => setWhatsappSettingsJson(e.target.value)}
                    disabled={!canWrite}
                  />
                </Field>
                {canWrite ? (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => saveChannelsMutation.mutate()}
                      disabled={saveChannelsMutation.isPending}
                    >
                      {saveChannelsMutation.isPending
                        ? "Saving…"
                        : "Save channels"}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="flags" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  Feature flags
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(
                  [
                    ["aiEnabled", "AI features"],
                    ["googleCalendarSync", "Google Calendar sync"],
                    ["whatsappCampaigns", "WhatsApp campaigns"],
                  ] as const
                ).map(([key, label]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {key}
                      </p>
                    </div>
                    <Switch
                      checked={flags[key]}
                      disabled={!canWrite}
                      onCheckedChange={(checked) =>
                        setFlags((f) => ({ ...f, [key]: Boolean(checked) }))
                      }
                    />
                  </div>
                ))}
                {canWrite ? (
                  <div className="flex justify-end">
                    <Button
                      onClick={() => saveFlagsMutation.mutate()}
                      disabled={saveFlagsMutation.isPending}
                    >
                      {saveFlagsMutation.isPending ? "Saving…" : "Save flags"}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">
                  Roles & permissions
                </CardTitle>
              </CardHeader>
              <CardContent>
                {rolesQuery.isLoading ? (
                  <LoadingSkeleton rows={3} />
                ) : rolesQuery.isError ? (
                  <EmptyState
                    title="Could not load roles"
                    description={(rolesQuery.error as Error).message}
                  />
                ) : (
                  <div className="grid gap-4">
                    {(rolesQuery.data?.roles ?? []).map((role) => {
                      const selected = new Set(roleDrafts[role.id] ?? []);
                      return (
                        <div
                          key={role.id}
                          className="rounded-xl border border-border p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <p className="text-sm font-semibold">{role.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {role.slug}
                                {role.userCount != null
                                  ? ` · ${role.userCount} users`
                                  : ""}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {role.isSystem ? (
                                <Badge variant="outline">System</Badge>
                              ) : null}
                              {canWrite ? (
                                <Button
                                  size="sm"
                                  disabled={saveRoleMutation.isPending}
                                  onClick={() => saveRoleMutation.mutate(role.id)}
                                >
                                  Save permissions
                                </Button>
                              ) : null}
                            </div>
                          </div>
                          {role.description ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {role.description}
                            </p>
                          ) : null}
                          <div className="mt-3 grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                            {availablePermissions.map((perm) => {
                              const key = permissionKey(perm);
                              const checked = selected.has(key);
                              return (
                                <label
                                  key={`${role.id}-${key}`}
                                  className="flex cursor-pointer items-start gap-2 rounded-md border border-border/70 px-2 py-1.5 text-xs"
                                >
                                  <Checkbox
                                    checked={checked}
                                    disabled={!canWrite}
                                    onCheckedChange={(v) => {
                                      setRoleDrafts((prev) => {
                                        const current = new Set(
                                          prev[role.id] ?? [],
                                        );
                                        if (v) current.add(key);
                                        else current.delete(key);
                                        return {
                                          ...prev,
                                          [role.id]: [...current],
                                        };
                                      });
                                    }}
                                  />
                                  <span className="leading-snug">
                                    {permissionLabel(perm)}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="users" className="mt-4">
            <UsersSettingsTab canWrite={can("users:manage")} />
          </TabsContent>

          <TabsContent value="fields" className="mt-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Add custom field
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3">
                  <Field label="Module">
                    <Select
                      value={customFieldForm.module}
                      onValueChange={(v) =>
                        setCustomFieldForm((f) => ({
                          ...f,
                          module: v ?? "leads",
                        }))
                      }
                      disabled={!canWrite}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "leads",
                          "customers",
                          "contacts",
                          "deals",
                          "products",
                        ].map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Field key">
                    <Input
                      value={customFieldForm.fieldKey}
                      onChange={(e) =>
                        setCustomFieldForm((f) => ({
                          ...f,
                          fieldKey: e.target.value,
                        }))
                      }
                      placeholder="industry_segment"
                      disabled={!canWrite}
                    />
                  </Field>
                  <Field label="Label">
                    <Input
                      value={customFieldForm.label}
                      onChange={(e) =>
                        setCustomFieldForm((f) => ({
                          ...f,
                          label: e.target.value,
                        }))
                      }
                      disabled={!canWrite}
                    />
                  </Field>
                  <Field label="Type">
                    <Select
                      value={customFieldForm.fieldType}
                      onValueChange={(v) =>
                        setCustomFieldForm((f) => ({
                          ...f,
                          fieldType: v ?? "text",
                        }))
                      }
                      disabled={!canWrite}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[
                          "text",
                          "number",
                          "date",
                          "boolean",
                          "select",
                          "textarea",
                        ].map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={customFieldForm.isRequired}
                      disabled={!canWrite}
                      onCheckedChange={(v) =>
                        setCustomFieldForm((f) => ({
                          ...f,
                          isRequired: Boolean(v),
                        }))
                      }
                    />
                    Required
                  </label>
                  {canWrite ? (
                    <Button
                      onClick={() => createCustomFieldMutation.mutate()}
                      disabled={
                        createCustomFieldMutation.isPending ||
                        !customFieldForm.fieldKey ||
                        !customFieldForm.label
                      }
                    >
                      {createCustomFieldMutation.isPending
                        ? "Creating…"
                        : "Create field"}
                    </Button>
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Defined fields
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customFieldsQuery.isLoading ? (
                    <LoadingSkeleton rows={4} />
                  ) : (customFieldsQuery.data ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No custom fields yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {(customFieldsQuery.data ?? []).map((field) => (
                        <div
                          key={field.id}
                          className="rounded-lg border border-border px-3 py-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{field.label}</p>
                            <Badge variant="outline">{field.module}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground font-mono">
                            {field.fieldKey} · {field.fieldType}
                            {field.isRequired ? " · required" : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="pipelines" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold">Pipelines</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!can("deals:read") ? (
                  <p className="text-sm text-muted-foreground">
                    Pipelines require deals:read.
                  </p>
                ) : (
                  <>
                    {can("deals:write") ? (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                          placeholder="New pipeline name"
                          value={pipelineName}
                          onChange={(e) => setPipelineName(e.target.value)}
                        />
                        <Button
                          disabled={
                            !pipelineName.trim() ||
                            createPipelineMutation.isPending
                          }
                          onClick={() => createPipelineMutation.mutate()}
                        >
                          {createPipelineMutation.isPending
                            ? "Creating…"
                            : "Create pipeline"}
                        </Button>
                      </div>
                    ) : null}
                    {pipelinesQuery.isLoading ? (
                      <LoadingSkeleton rows={3} />
                    ) : (pipelinesQuery.data ?? []).length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        No pipelines yet.
                      </p>
                    ) : (
                      <div className="grid gap-3">
                        {(pipelinesQuery.data ?? []).map((pipeline) => (
                          <div
                            key={pipeline.id}
                            className="rounded-xl border border-border p-3"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div>
                                <p className="text-sm font-semibold">
                                  {pipeline.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {pipeline._count?.deals ?? 0} deals
                                  {pipeline.isDefault ? " · default" : ""}
                                </p>
                              </div>
                              {pipeline.isDefault ? (
                                <Badge variant="secondary">Default</Badge>
                              ) : null}
                            </div>
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(pipeline.stages ?? []).map((stage) => (
                                <Badge
                                  key={stage.id}
                                  variant="outline"
                                  style={
                                    stage.color
                                      ? { borderColor: stage.color }
                                      : undefined
                                  }
                                >
                                  {stage.name}
                                  {stage.probability != null
                                    ? ` (${stage.probability}%)`
                                    : ""}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function UsersSettingsTab({ canWrite }: { canWrite: boolean }) {
  const queryClient = useQueryClient();
  const [form, setForm] = React.useState({
    name: "",
    email: "",
    password: "",
    roleSlug: "SALES_EXECUTIVE",
    department: "",
    designation: "",
  });
  const [formError, setFormError] = React.useState<string | null>(null);

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await apiFetch<unknown>("/api/users");
      return unwrapList<{
        id: string;
        name?: string | null;
        email: string;
        role?: { name: string; slug: string };
        isActive?: boolean;
      }>(res.data);
    },
    enabled: canWrite,
  });

  function validateInviteForm() {
    if (form.name.trim().length < 2) {
      return "Name must be at least 2 characters";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return "Enter a valid email address";
    }
    if (form.password.length < 8) {
      return "Password must be at least 8 characters";
    }
    if (!form.roleSlug) {
      return "Select a role";
    }
    return null;
  }

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/users", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password,
          roleSlug: form.roleSlug,
          department: form.department.trim() || undefined,
          designation: form.designation.trim() || undefined,
        }),
      }),
    onSuccess: () => {
      toast.success("User invited");
      setFormError(null);
      setForm({
        name: "",
        email: "",
        password: "",
        roleSlug: "SALES_EXECUTIVE",
        department: "",
        designation: "",
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (err: Error) => {
      setFormError(err.message);
      toast.error(err.message);
    },
  });

  if (!canWrite) {
    return (
      <EmptyState
        title="Users management"
        description="You need users:manage permission to invite teammates."
      />
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Invite user</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name *">
            <Input
              value={form.name}
              placeholder="Rohan Mehta"
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </Field>
          <Field label="Email (login ID) *">
            <Input
              type="email"
              value={form.email}
              placeholder="rohan@vayuguard.com"
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
          </Field>
          <Field label="Temp password * (min 8 characters)">
            <Input
              type="password"
              value={form.password}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              onChange={(e) =>
                setForm((f) => ({ ...f, password: e.target.value }))
              }
            />
          </Field>
          <Field label="Role *">
            <Select
              value={form.roleSlug}
              onValueChange={(v) =>
                setForm((f) => ({
                  ...f,
                  roleSlug:
                    typeof v === "string" && v.length > 0
                      ? v
                      : "SALES_EXECUTIVE",
                }))
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[
                  "SUPER_ADMIN",
                  "ADMIN",
                  "SALES_MANAGER",
                  "SALES_EXECUTIVE",
                  "MARKETING",
                  "SUPPORT",
                  "ACCOUNTANT",
                  "VIEWER",
                ].map((slug) => (
                  <SelectItem key={slug} value={slug}>
                    {slug}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Department">
            <Input
              value={form.department}
              placeholder="Sales"
              onChange={(e) =>
                setForm((f) => ({ ...f, department: e.target.value }))
              }
            />
          </Field>
          <Field label="Designation">
            <Input
              value={form.designation}
              placeholder="Sales Executive"
              onChange={(e) =>
                setForm((f) => ({ ...f, designation: e.target.value }))
              }
            />
          </Field>
        </div>
        {formError ? (
          <p className="text-sm text-destructive">{formError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            They log in with this email and temp password. Choose a role so they
            only see the modules allowed for that role.
          </p>
        )}
        <div className="flex justify-end">
          <Button
            disabled={createMutation.isPending}
            onClick={() => {
              const localError = validateInviteForm();
              if (localError) {
                setFormError(localError);
                toast.error(localError);
                return;
              }
              setFormError(null);
              createMutation.mutate();
            }}
          >
            {createMutation.isPending ? "Creating…" : "Create user"}
          </Button>
        </div>
        <Separator />
        {usersQuery.isLoading ? (
          <LoadingSkeleton rows={4} />
        ) : (
          <div className="space-y-2">
            {(usersQuery.data ?? []).map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium">{u.name ?? u.email}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </div>
                <Badge variant="secondary">{u.role?.name ?? u.role?.slug}</Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
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

function Row({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
