import { describe, expect, it, vi, beforeEach } from "vitest";

describe("zoho webhook auth", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("rejects wrong webhook secret with 401", async () => {
    process.env.ZOHO_WEBHOOK_SECRET = "correct-secret";
    const enqueue = vi.fn();
    vi.doMock("@/server/integrations/zoho/queue", () => ({
      enqueueZohoJob: enqueue,
    }));

    const { POST } = await import("@/app/api/webhooks/zoho/route");
    const req = new Request("http://localhost/api/webhooks/zoho", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-zoho-webhook-secret": "wrong",
      },
      body: JSON.stringify({ event: "invoice_updated" }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(401);
    expect(enqueue).not.toHaveBeenCalled();
  });

  it("accepts valid secret and enqueues work", async () => {
    process.env.ZOHO_WEBHOOK_SECRET = "correct-secret";
    const enqueue = vi.fn().mockResolvedValue({ id: "job1" });
    vi.doMock("@/server/integrations/zoho/queue", () => ({
      enqueueZohoJob: enqueue,
    }));

    const { POST } = await import("@/app/api/webhooks/zoho/route");
    const req = new Request("http://localhost/api/webhooks/zoho", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-zoho-webhook-secret": "correct-secret",
      },
      body: JSON.stringify({ event: "payment_created", payment_id: "1" }),
    });

    const res = await POST(req as never);
    expect(res.status).toBe(200);
    expect(enqueue).toHaveBeenCalledWith(
      "process_webhook",
      expect.objectContaining({ body: expect.any(Object) }),
    );
  });
});

describe("zoho client retries", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it("retries on 429 then succeeds", async () => {
    vi.doMock("@/server/db/client", () => ({
      prisma: {
        zohoSyncLog: { create: vi.fn().mockResolvedValue({}) },
        zohoTokenCache: {
          findUnique: vi.fn().mockResolvedValue({
            accessToken: "t",
            expiresAt: new Date(Date.now() + 3600_000),
          }),
          upsert: vi.fn(),
          deleteMany: vi.fn(),
        },
      },
    }));
    vi.doMock("@/server/integrations/zoho/rate-limit", () => ({
      acquireZohoRateSlot: vi.fn().mockResolvedValue(undefined),
    }));

    process.env.ZOHO_CLIENT_ID = "id";
    process.env.ZOHO_CLIENT_SECRET = "secret";
    process.env.ZOHO_REFRESH_TOKEN = "refresh";
    process.env.ZOHO_ORGANIZATION_ID = "org";
    process.env.ZOHO_DC = "in";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: () => "0" },
        json: async () => ({ code: 429, message: "rate" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        json: async () => ({
          code: 0,
          organizations: [{ name: "Sandbox" }],
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const { getOrganization } = await import(
      "@/server/integrations/zoho/client"
    );
    const org = await getOrganization();
    expect(org.organizations?.[0]?.name).toBe("Sandbox");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
