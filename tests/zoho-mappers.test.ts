import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  assertValidGstin,
  isValidGstin,
  resolveGstTreatment,
  resolvePlaceOfSupply,
} from "@/server/integrations/zoho/mappers/gst";
import { mapCustomerToZohoContact } from "@/server/integrations/zoho/mappers/customer";
import { mapPaymentToZoho } from "@/server/integrations/zoho/mappers/payment";
import { redactSecrets } from "@/server/integrations/zoho/redact";
import { ZohoValidationError } from "@/server/integrations/zoho/errors";
import { getZohoAccountsBaseUrl, getZohoBooksBaseUrl } from "@/server/integrations/zoho/config";

describe("zoho gst helpers", () => {
  it("validates GSTIN format", () => {
    expect(isValidGstin("27AABCU9603R1ZM")).toBe(true);
    expect(isValidGstin("bad")).toBe(false);
    expect(isValidGstin(null)).toBe(true);
    expect(() => assertValidGstin("INVALID")).toThrow(ZohoValidationError);
  });

  it("resolves gst treatment and place of supply", () => {
    expect(resolveGstTreatment({ gstNumber: "27AABCU9603R1ZM" })).toBe(
      "business_gst",
    );
    expect(resolveGstTreatment({})).toBe("consumer");
    expect(
      resolvePlaceOfSupply({ billingState: "Maharashtra" }),
    ).toBe("27");
    expect(
      resolvePlaceOfSupply({ gstNumber: "29AABCU9603R1ZM" }),
    ).toBe("29");
  });
});

describe("zoho mappers", () => {
  it("maps customer to contact", () => {
    const payload = mapCustomerToZohoContact({
      id: "c1",
      name: "Acme",
      legalName: "Acme Pvt Ltd",
      email: "a@acme.test",
      phone: "999",
      gstNumber: "27AABCU9603R1ZM",
      gstTreatment: null,
      placeOfSupply: null,
      billingAddress: "1 Main",
      billingCity: "Pune",
      billingState: "Maharashtra",
      billingCountry: "India",
      billingPinCode: "411001",
      shippingAddress: null,
      shippingCity: null,
      shippingState: null,
      shippingCountry: null,
      shippingPinCode: null,
    });
    expect(payload.contact_type).toBe("customer");
    expect(payload.gst_treatment).toBe("business_gst");
    expect(payload.place_of_supply).toBe("27");
  });

  it("rejects blank customer name", () => {
    expect(() =>
      mapCustomerToZohoContact({
        id: "c1",
        name: "  ",
        legalName: null,
        email: null,
        phone: null,
        gstNumber: null,
        gstTreatment: null,
        placeOfSupply: null,
        billingAddress: null,
        billingCity: null,
        billingState: null,
        billingCountry: null,
        billingPinCode: null,
        shippingAddress: null,
        shippingCity: null,
        shippingState: null,
        shippingCountry: null,
        shippingPinCode: null,
      }),
    ).toThrow(ZohoValidationError);
  });

  it("maps payment applied to invoice", () => {
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
