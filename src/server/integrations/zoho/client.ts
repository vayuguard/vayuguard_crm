import {
  ZohoEntityType,
  ZohoSyncDirection,
  ZohoSyncStatus,
  type Prisma,
} from "@prisma/client";
import { prisma } from "@/server/db/client";
import {
  assertZohoCredentialsConfigured,
  getZohoBooksBaseUrl,
} from "@/server/integrations/zoho/config";
import {
  ZohoApiError,
  ZohoAuthError,
  ZohoRateLimitError,
} from "@/server/integrations/zoho/errors";
import { acquireZohoRateSlot } from "@/server/integrations/zoho/rate-limit";
import { redactSecrets } from "@/server/integrations/zoho/redact";
import {
  clearCachedAccessToken,
  getAccessToken,
} from "@/server/integrations/zoho/token";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  entityType?: ZohoEntityType;
  crmId?: string;
  action?: string;
  maxRetries?: number;
};

async function writeSyncLog(input: {
  action: string;
  entityType?: ZohoEntityType;
  crmId?: string;
  zohoId?: string;
  requestPayload?: unknown;
  responsePayload?: unknown;
  status: ZohoSyncStatus;
  errorMessage?: string;
  attempts: number;
}) {
  try {
    await prisma.zohoSyncLog.create({
      data: {
        direction: ZohoSyncDirection.crm_to_zoho,
        entityType: input.entityType,
        crmId: input.crmId,
        zohoId: input.zohoId,
        action: input.action,
        requestPayload: input.requestPayload
          ? (redactSecrets(input.requestPayload) as Prisma.InputJsonValue)
          : undefined,
        responsePayload: input.responsePayload
          ? (redactSecrets(input.responsePayload) as Prisma.InputJsonValue)
          : undefined,
        status: input.status,
        errorMessage: input.errorMessage,
        attempts: input.attempts,
      },
    });
  } catch {
    // Never fail the Zoho call because logging failed.
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function zohoRequest<T = unknown>(
  options: RequestOptions,
): Promise<T> {
  const cfg = assertZohoCredentialsConfigured();
  const maxRetries = options.maxRetries ?? 4;
  let attempts = 0;
  let tokenRefreshed = false;

  while (true) {
    attempts += 1;
    await acquireZohoRateSlot();
    const token = await getAccessToken();

    const url = new URL(`${getZohoBooksBaseUrl(cfg.dc)}${options.path}`);
    url.searchParams.set("organization_id", cfg.organizationId);
    for (const [k, v] of Object.entries(options.query ?? {})) {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    }

    const method = options.method ?? "GET";
    const init: RequestInit = {
      method,
      headers: {
        Authorization: `Zoho-oauthtoken ${token}`,
      },
    };
    // Zoho Books v3 write APIs expect form field JSONString (official docs).
    if (options.body !== undefined && method !== "GET") {
      const form = new URLSearchParams();
      form.set("JSONString", JSON.stringify(options.body));
      init.headers = {
        ...init.headers,
        "Content-Type": "application/x-www-form-urlencoded",
      };
      init.body = form.toString();
    }

    let res: Response;
    let json: Record<string, unknown> = {};
    try {
      res = await fetch(url.toString(), init);
      try {
        json = (await res.json()) as Record<string, unknown>;
      } catch {
        json = {};
      }
    } catch (error) {
      await writeSyncLog({
        action: options.action ?? options.path,
        entityType: options.entityType,
        crmId: options.crmId,
        requestPayload: options.body,
        status: ZohoSyncStatus.failed,
        errorMessage: error instanceof Error ? error.message : "network error",
        attempts,
      });
      if (attempts <= maxRetries) {
        await sleep(2 ** attempts * 250);
        continue;
      }
      throw error;
    }

    const code = String(json.code ?? res.status);
    const message = String(json.message ?? res.statusText ?? "Zoho error");

    if (res.status === 401 && !tokenRefreshed) {
      tokenRefreshed = true;
      await clearCachedAccessToken();
      continue;
    }

    if (res.status === 429 || res.status >= 500) {
      await writeSyncLog({
        action: options.action ?? options.path,
        entityType: options.entityType,
        crmId: options.crmId,
        requestPayload: options.body,
        responsePayload: json,
        status: ZohoSyncStatus.failed,
        errorMessage: message,
        attempts,
      });
      if (attempts <= maxRetries) {
        const retryAfter = Number(res.headers.get("retry-after") ?? 0);
        await sleep(
          retryAfter > 0 ? retryAfter * 1000 : 2 ** attempts * 400,
        );
        continue;
      }
      if (res.status === 429) {
        throw new ZohoRateLimitError(message, json);
      }
      throw new ZohoApiError(message, res.status, code, json);
    }

    if (!res.ok || (json.code !== undefined && Number(json.code) !== 0)) {
      await writeSyncLog({
        action: options.action ?? options.path,
        entityType: options.entityType,
        crmId: options.crmId,
        requestPayload: options.body,
        responsePayload: json,
        status: ZohoSyncStatus.failed,
        errorMessage: message,
        attempts,
      });
      if (res.status === 401) {
        throw new ZohoAuthError(message, json);
      }
      throw new ZohoApiError(message, res.status, code, json);
    }

    await writeSyncLog({
      action: options.action ?? options.path,
      entityType: options.entityType,
      crmId: options.crmId,
      requestPayload: options.body,
      responsePayload: json,
      status: ZohoSyncStatus.success,
      attempts,
    });

    return json as T;
  }
}

// ─── Contacts ───────────────────────────────────────────────────────────────

export async function createContactJson(
  contact: Record<string, unknown>,
  crmId?: string,
) {
  return zohoRequest<{ contact: { contact_id: string } }>({
    method: "POST",
    path: "/contacts",
    body: contact,
    entityType: ZohoEntityType.customer,
    crmId,
    action: "contacts.create",
  });
}

export async function updateContactJson(
  zohoId: string,
  contact: Record<string, unknown>,
  crmId?: string,
) {
  return zohoRequest<{ contact: { contact_id: string } }>({
    method: "PUT",
    path: `/contacts/${zohoId}`,
    body: contact,
    entityType: ZohoEntityType.customer,
    crmId,
    action: "contacts.update",
  });
}

export async function getContact(zohoId: string) {
  return zohoRequest<{ contact: Record<string, unknown> }>({
    method: "GET",
    path: `/contacts/${zohoId}`,
    action: "contacts.get",
  });
}

export async function searchContacts(params: {
  email?: string;
  gstNo?: string;
  page?: number;
}) {
  return zohoRequest<{
    contacts: Array<Record<string, unknown>>;
    page_context?: { has_more_page?: boolean };
  }>({
    method: "GET",
    path: "/contacts",
    query: {
      email: params.email,
      gst_no: params.gstNo,
      page: params.page ?? 1,
      per_page: 200,
      contact_type: "customer",
    },
    action: "contacts.search",
  });
}

export async function createEstimate(
  estimate: Record<string, unknown>,
  crmId?: string,
) {
  return zohoRequest<{ estimate: { estimate_id: string } }>({
    method: "POST",
    path: "/estimates",
    body: estimate,
    entityType: ZohoEntityType.quotation,
    crmId,
    action: "estimates.create",
  });
}

export async function updateEstimate(
  zohoId: string,
  estimate: Record<string, unknown>,
  crmId?: string,
) {
  return zohoRequest<{ estimate: { estimate_id: string } }>({
    method: "PUT",
    path: `/estimates/${zohoId}`,
    body: estimate,
    entityType: ZohoEntityType.quotation,
    crmId,
    action: "estimates.update",
  });
}

export async function createInvoice(
  invoice: Record<string, unknown>,
  crmId?: string,
) {
  return zohoRequest<{ invoice: { invoice_id: string } }>({
    method: "POST",
    path: "/invoices",
    body: invoice,
    entityType: ZohoEntityType.invoice,
    crmId,
    action: "invoices.create",
  });
}

export async function updateInvoice(
  zohoId: string,
  invoice: Record<string, unknown>,
  crmId?: string,
) {
  return zohoRequest<{ invoice: { invoice_id: string } }>({
    method: "PUT",
    path: `/invoices/${zohoId}`,
    body: invoice,
    entityType: ZohoEntityType.invoice,
    crmId,
    action: "invoices.update",
  });
}

export async function getInvoice(zohoId: string) {
  return zohoRequest<{ invoice: Record<string, unknown> }>({
    method: "GET",
    path: `/invoices/${zohoId}`,
    action: "invoices.get",
  });
}

export async function listInvoicesModifiedSince(
  lastModifiedTime: string,
  page = 1,
) {
  return zohoRequest<{
    invoices: Array<Record<string, unknown>>;
    page_context?: { has_more_page?: boolean };
  }>({
    method: "GET",
    path: "/invoices",
    query: {
      last_modified_time: lastModifiedTime,
      page,
      per_page: 200,
    },
    action: "invoices.list_modified",
  });
}

export async function createCustomerPayment(
  payment: Record<string, unknown>,
  crmId?: string,
) {
  return zohoRequest<{
    payment?: { payment_id: string };
    customerpayment?: { payment_id: string };
  }>({
    method: "POST",
    path: "/customerpayments",
    body: payment,
    entityType: ZohoEntityType.payment,
    crmId,
    action: "customerpayments.create",
  });
}

export async function getCustomerPayment(zohoId: string) {
  return zohoRequest<{ payment: Record<string, unknown> }>({
    method: "GET",
    path: `/customerpayments/${zohoId}`,
    action: "customerpayments.get",
  });
}

export async function listCustomerPaymentsModifiedSince(
  lastModifiedTime: string,
  page = 1,
) {
  return zohoRequest<{
    customerpayments: Array<Record<string, unknown>>;
    page_context?: { has_more_page?: boolean };
  }>({
    method: "GET",
    path: "/customerpayments",
    query: {
      last_modified_time: lastModifiedTime,
      page,
      per_page: 200,
    },
    action: "customerpayments.list_modified",
  });
}

export async function getOrganization() {
  return zohoRequest<{
    organizations?: Array<Record<string, unknown>>;
    organization?: Record<string, unknown>;
  }>({
    method: "GET",
    path: "/organizations",
    action: "organizations.get",
  });
}
