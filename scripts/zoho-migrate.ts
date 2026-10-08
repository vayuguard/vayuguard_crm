/**
 * Initial CRM ↔ Zoho contact migration.
 *
 *   npx tsx scripts/zoho-migrate.ts --dry-run
 *   npx tsx scripts/zoho-migrate.ts --apply
 *   npx tsx scripts/zoho-migrate.ts --apply --invoices
 *
 * Options: --batch=50 --delay-ms=500 --resume
 * Reports written under tmp/zoho-migrate-*.csv
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ZohoEntityType } from "@prisma/client";
import { prisma } from "../src/server/db/client";
import { searchContacts } from "../src/server/integrations/zoho/client";
import { assertZohoCredentialsConfigured } from "../src/server/integrations/zoho/config";
import {
  getSyncState,
  setSyncState,
  upsertZohoLink,
} from "../src/server/integrations/zoho/queue";

type Row = {
  crmId: string;
  customerNumber: string;
  name: string;
  email: string;
  phone: string;
  gstNumber: string;
  status: "matched" | "unmatched" | "duplicate" | "conflict" | "created" | "linked" | "skipped";
  zohoId: string;
  note: string;
};

function parseArgs(argv: string[]) {
  const flags = new Set(argv.filter((a) => a.startsWith("--")));
  const getNum = (key: string, fallback: number) => {
    const hit = argv.find((a) => a.startsWith(`${key}=`));
    return hit ? Number(hit.split("=")[1]) : fallback;
  };
  return {
    dryRun: flags.has("--dry-run") || !flags.has("--apply"),
    apply: flags.has("--apply"),
    invoices: flags.has("--invoices"),
    resume: flags.has("--resume"),
    batch: getNum("--batch", 50),
    delayMs: getNum("--delay-ms", 500),
  };
}

function csvEscape(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

async function findZohoMatch(customer: {
  email: string | null;
  phone: string | null;
  gstNumber: string | null;
}) {
  const candidates: Array<{ id: string; via: string }> = [];
  if (customer.email) {
    const res = await searchContacts({ email: customer.email });
    for (const c of res.contacts ?? []) {
      candidates.push({ id: String(c.contact_id), via: "email" });
    }
  }
  if (customer.gstNumber) {
    const res = await searchContacts({ gstNo: customer.gstNumber });
    for (const c of res.contacts ?? []) {
      candidates.push({ id: String(c.contact_id), via: "gst" });
    }
  }
  const unique = new Map(candidates.map((c) => [c.id, c]));
  return [...unique.values()];
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  assertZohoCredentialsConfigured();

  mkdirSync(path.join(process.cwd(), "tmp"), { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(
    process.cwd(),
    "tmp",
    `zoho-migrate-${opts.apply ? "apply" : "dry-run"}-${stamp}.csv`,
  );

  const resumeKey = "migrate_customers_cursor";
  let cursor = opts.resume ? ((await getSyncState(resumeKey)) ?? "") : "";

  const rows: Row[] = [];
  let processed = 0;

  for (;;) {
    const customers = await prisma.customer.findMany({
      where: {
        deletedAt: null,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: "asc" },
      take: opts.batch,
    });
    if (!customers.length) break;

    for (const customer of customers) {
      const existing = await prisma.zohoLink.findUnique({
        where: {
          entityType_crmId: {
            entityType: ZohoEntityType.customer,
            crmId: customer.id,
          },
        },
      });

      if (existing) {
        rows.push({
          crmId: customer.id,
          customerNumber: customer.customerNumber,
          name: customer.name,
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          gstNumber: customer.gstNumber ?? "",
          status: "skipped",
          zohoId: existing.zohoId,
          note: "already linked",
        });
        cursor = customer.id;
        continue;
      }

      const matches = await findZohoMatch(customer);
      if (matches.length > 1) {
        rows.push({
          crmId: customer.id,
          customerNumber: customer.customerNumber,
          name: customer.name,
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          gstNumber: customer.gstNumber ?? "",
          status: "duplicate",
          zohoId: matches.map((m) => m.id).join("|"),
          note: `multiple Zoho contacts (${matches.map((m) => m.via).join(",")})`,
        });
      } else if (matches.length === 1) {
        const zohoId = matches[0]!.id;
        if (opts.apply) {
          await upsertZohoLink({
            entityType: ZohoEntityType.customer,
            crmId: customer.id,
            zohoId,
          });
        }
        rows.push({
          crmId: customer.id,
          customerNumber: customer.customerNumber,
          name: customer.name,
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          gstNumber: customer.gstNumber ?? "",
          status: opts.apply ? "linked" : "matched",
          zohoId,
          note: `matched via ${matches[0]!.via}`,
        });
      } else {
        // Inbound-only: never create contacts in Zoho from CRM.
        rows.push({
          crmId: customer.id,
          customerNumber: customer.customerNumber,
          name: customer.name,
          email: customer.email ?? "",
          phone: customer.phone ?? "",
          gstNumber: customer.gstNumber ?? "",
          status: "unmatched",
          zohoId: "",
          note: opts.apply
            ? "no Zoho match — skipped (outbound disabled; CRM does not write to Zoho)"
            : "no Zoho match — would not create (inbound-only)",
        });
      }

      cursor = customer.id;
      processed += 1;
      if (opts.delayMs > 0) {
        await new Promise((r) => setTimeout(r, opts.delayMs));
      }
    }

    await setSyncState(resumeKey, cursor);
  }

  if (opts.apply && opts.invoices) {
    console.warn(
      "Skipping --invoices: outbound invoice create is disabled (Zoho → CRM only).",
    );
  }

  const header =
    "crmId,customerNumber,name,email,phone,gstNumber,status,zohoId,note";
  const body = rows
    .map((r) =>
      [
        r.crmId,
        r.customerNumber,
        r.name,
        r.email,
        r.phone,
        r.gstNumber,
        r.status,
        r.zohoId,
        r.note,
      ]
        .map((v) => csvEscape(String(v)))
        .join(","),
    )
    .join("\n");
  writeFileSync(reportPath, `${header}\n${body}\n`, "utf8");

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  console.log(
    JSON.stringify(
      {
        mode: opts.apply ? "apply" : "dry-run",
        processed,
        counts,
        reportPath,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
