import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assertValidGstin,
  isValidGstin,
  resolveGstTreatment,
  resolvePlaceOfSupply,
} from "@/server/integrations/zoho/mappers/gst";
import {
  mapCustomerToZohoContact,
  mapZohoContactToCustomer,
} from "@/server/integrations/zoho/mappers/customer";
import {
  mapPaymentToZoho,
  mapZohoPaymentToCrm,
} from "@/server/integrations/zoho/mappers/payment";
import { mapZohoInvoiceToCrm } from "@/server/integrations/zoho/mappers/invoice";
import { redactSecrets } from "@/server/integrations/zoho/redact";
import { ZohoValidationError } from "@/server/integrations/zoho/errors";
import {
  getZohoAccountsBaseUrl,
  getZohoBooksBaseUrl,
} from "@/server/integrations/zoho/config";
import { toZohoPaymentMode } from "@/server/integrations/zoho/fields";

const baseCustomer = {
  id: "c1",
  name: "Acme",
  legalName: "Acme Pvt Ltd",
  email: "a@acme.test",
  phone: "999",
  website: null as string | null,
  gstNumber: "27AABCU9603R1ZM",
  gstTreatment: null as string | null,
  placeOfSupply: null as string | null,
  billingAddress: "1 Main",
  billingCity: "Pune",
  billingState: "Maharashtra",
  billingCountry: "India",
  billingPinCode: "411001",
  shippingAddress: null as string | null,
  shippingCity: null as string | null,
  shippingState: null as string | null,
  shippingCountry: null as string | null,
  shippingPinCode: null as string | null,
};

describe("zoho gst helpers", () => {
  it("validates GSTIN format", () => {
    expect(isValidGstin("27AABCU9603R1ZM")).toBe(true);
    expect(isValidGstin("bad")).toBe(false);
    expect(isValidGstin(null)).toBe(true);
    expect(() => assertValidGstin("INVALID")).toThrow(ZohoValidationError);
  });

  it("resolves gst treatment and alphabetic place codes", () => {
    expect(resolveGstTreatment({ gstNumber: "27AABCU9603R1ZM" })).toBe(
      "business_gst",
    );
    expect(resolveGstTreatment({})).toBe("consumer");
    expect(resolvePlaceOfSupply({ billingState: "Maharashtra" })).toBe("MH");
    expect(resolvePlaceOfSupply({ gstNumber: "29AABCU9603R1ZM" })).toBe("KA");
    expect(resolvePlaceOfSupply({ placeOfSupply: "TN" })).toBe("TN");
    expect(resolvePlaceOfSupply({ placeOfSupply: "27" })).toBe("MH");
  });
});

describe("zoho mappers", () => {
  it("maps customer to Zoho contact with place_of_contact (not place_of_supply)", () => {
    const payload = mapCustomerToZohoContact(baseCustomer);
    expect(payload.contact_type).toBe("customer");
    expect(payload.gst_treatment).toBe("business_gst");
    expect(payload.gst_no).toBe("27AABCU9603R1ZM");
    expect(payload.place_of_contact).toBe("MH");
    expect(
      (payload as { place_of_supply?: string }).place_of_supply,
    ).toBeUndefined();
    expect(payload.contact_persons?.[0]?.email).toBe("a@acme.test");
    expect(payload.billing_address?.zip).toBe("411001");
  });

  it("maps Zoho contact back to CRM customer fields", () => {
    const crm = mapZohoContactToCustomer({
      contact_name: "Acme",
      company_name: "Acme Pvt Ltd",
      gst_no: "27AABCU9603R1ZM",
      gst_treatment: "business_gst",
      place_of_contact: "MH",
      email: "a@acme.test",
      billing_address: {
        address: "1 Main",
        city: "Pune",
        state: "Maharashtra",
        country: "India",
        zip: "411001",
      },
      contact_persons: [
        {
          first_name: "Will",
          last_name: "Smith",
          email: "will@acme.test",
          is_primary_contact: true,
        },
      ],
    });
    expect(crm.name).toBe("Acme");
    expect(crm.placeOfSupply).toBe("MH");
    expect(crm.gstNumber).toBe("27AABCU9603R1ZM");
    expect(crm.billingPinCode).toBe("411001");
    expect(crm.email).toBe("a@acme.test");
  });

  it("rejects blank customer name", () => {
    expect(() =>
      mapCustomerToZohoContact({ ...baseCustomer, name: "  " }),
    ).toThrow(ZohoValidationError);
  });

  it("normalizes payment_mode and maps payment applied to invoice", () => {
    expect(toZohoPaymentMode("upi")).toBe("others");
    expect(toZohoPaymentMode("NEFT")).toBe("banktransfer");
    expect(toZohoPaymentMode("Credit Card")).toBe("creditcard");

    const payload = mapPaymentToZoho(
      {
        id: "p1",
        paymentNumber: "PAY-1",
        invoiceId: "i1",
        customerId: "c1",
        amount: 100,
        method: "upi",
        reference: "R1",
        paidAt: new Date("2026-01-15"),
        notes: null,
        createdById: null,
        createdAt: new Date(),
      } as unknown as Parameters<typeof mapPaymentToZoho>[0],
      "zoho-c",
      "zoho-i",
    );
    expect(payload.invoices[0]?.invoice_id).toBe("zoho-i");
    expect(payload.amount).toBe(100);
    expect(payload.payment_mode).toBe("others");

    const back = mapZohoPaymentToCrm({
      amount: 100,
      payment_mode: "banktransfer",
      reference_number: "R1",
      description: "note",
      date: "2026-01-15",
    });
    expect(back.method).toBe("bank transfer");
    expect(back.reference).toBe("R1");
  });

  it("maps Zoho invoice payment status fields", () => {
    const paid = mapZohoInvoiceToCrm({
      invoice_number: "INV-1",
      total: 1000,
      balance: 0,
    });
    expect(paid.paymentStatus).toBe("PAID");
    expect(paid.amountPaid).toBe(1000);

    const partial = mapZohoInvoiceToCrm({
      invoice_number: "INV-2",
      total: 1000,
      balance: 400,
    });
    expect(partial.paymentStatus).toBe("PARTIAL");
    expect(partial.amountPaid).toBe(600);
  });
});

describe("zoho redact", () => {
  it("redacts tokens and secrets", () => {
    const out = redactSecrets({
      authorization: "secret",
      refresh_token: "abc",
      nested: { access_token: "xyz", ok: 1 },
    }) as Record<string, unknown>;
    expect(out.authorization).toBe("[REDACTED]");
    expect(out.refresh_token).toBe("[REDACTED]");
    expect((out.nested as { access_token: string }).access_token).toBe(
      "[REDACTED]",
    );
    expect((out.nested as { ok: number }).ok).toBe(1);
  });
});

describe("zoho config urls", () => {
  it("builds DC-aware base urls", () => {
    expect(getZohoAccountsBaseUrl("in")).toBe("https://accounts.zoho.in");
    expect(getZohoBooksBaseUrl("com")).toBe(
      "https://www.zohoapis.com/books/v3",
    );
  });
});

describe("zoho token manager", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("refreshes access token and caches it", async () => {
    vi.resetModules();
    const upsert = vi.fn().mockResolvedValue({});
    const findUnique = vi.fn().mockResolvedValue(null);
    vi.doMock("@/server/db/client", () => ({
      prisma: {
        zohoTokenCache: { findUnique, upsert, deleteMany: vi.fn() },
      },
    }));

    process.env.ZOHO_CLIENT_ID = "id";
    process.env.ZOHO_CLIENT_SECRET = "secret";
    process.env.ZOHO_REFRESH_TOKEN = "refresh";
    process.env.ZOHO_ORGANIZATION_ID = "org";
    process.env.ZOHO_DC = "in";

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: "atok", expires_in: 3600 }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getAccessToken } = await import("@/server/integrations/zoho/token");
    const token = await getAccessToken();
    expect(token).toBe("atok");
    expect(upsert).toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
