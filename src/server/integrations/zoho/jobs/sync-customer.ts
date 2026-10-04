import { ZohoEntityType } from "@prisma/client";
import { prisma } from "@/server/db/client";
import {
  createContactJson,
  searchContacts,
  updateContactJson,
} from "@/server/integrations/zoho/client";
import { isZohoSyncEnabled } from "@/server/integrations/zoho/sync-enabled";
import { mapCustomerToZohoContact } from "@/server/integrations/zoho/mappers/customer";
import {
  getZohoLink,
  upsertZohoLink,
} from "@/server/integrations/zoho/queue";

export async function syncCustomerToZoho(
  customerId: string,
  opts?: { force?: boolean },
) {
  if (!opts?.force && !(await isZohoSyncEnabled())) {
    return { skipped: true as const };
  }

  const customer = await prisma.customer.findFirst({
    where: { id: customerId, deletedAt: null },
  });
  if (!customer) throw new Error(`Customer ${customerId} not found`);

  const payload = mapCustomerToZohoContact(customer);
  const existing = await getZohoLink(ZohoEntityType.customer, customerId);

  if (existing?.zohoId) {
    await updateContactJson(existing.zohoId, payload, customerId);
    await upsertZohoLink({
      entityType: ZohoEntityType.customer,
      crmId: customerId,
      zohoId: existing.zohoId,
    });
    return { zohoId: existing.zohoId, action: "updated" as const };
  }

  // Deduplicate by email / GSTIN before create
  let zohoId: string | undefined;
  if (customer.email) {
    const byEmail = await searchContacts({ email: customer.email });
    zohoId = String(byEmail.contacts?.[0]?.contact_id ?? "") || undefined;
  }
  if (!zohoId && customer.gstNumber) {
    const byGst = await searchContacts({ gstNo: customer.gstNumber });
    zohoId = String(byGst.contacts?.[0]?.contact_id ?? "") || undefined;
  }

  if (zohoId) {
    await updateContactJson(zohoId, payload, customerId);
  } else {
    const created = await createContactJson(payload, customerId);
    zohoId = created.contact.contact_id;
  }

  await upsertZohoLink({
    entityType: ZohoEntityType.customer,
    crmId: customerId,
    zohoId,
  });

  return { zohoId, action: zohoId ? ("created" as const) : ("linked" as const) };
}
