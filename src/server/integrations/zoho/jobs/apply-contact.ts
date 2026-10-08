import { prisma } from "@/server/db/client";
import { getContact } from "@/server/integrations/zoho/client";
import {
  mapZohoContactPersonToCrmContact,
  mapZohoContactToCustomer,
} from "@/server/integrations/zoho/mappers/customer";
import {
  ZOHO_CONTACT,
  ZOHO_CONTACT_PERSON,
} from "@/server/integrations/zoho/fields";

/** Apply a Zoho Books contact payload onto a linked CRM customer (+ primary person). */
export async function applyZohoContactToCrm(
  zohoId: string,
  crmId: string,
  thin: Record<string, unknown>,
) {
  let zoho = thin;
  if (!zoho[ZOHO_CONTACT.billingAddress] && !zoho[ZOHO_CONTACT.gstNo]) {
    try {
      const full = await getContact(zohoId);
      zoho = full.contact;
    } catch {
      // keep thin payload
    }
  }

  const mapped = mapZohoContactToCustomer(zoho);
  await prisma.customer.updateMany({
    where: { id: crmId, deletedAt: null },
    data: {
      name: mapped.name,
      legalName: mapped.legalName,
      email: mapped.email,
      phone: mapped.phone,
      website: mapped.website,
      gstNumber: mapped.gstNumber,
      gstTreatment: mapped.gstTreatment,
      placeOfSupply: mapped.placeOfSupply,
      billingAddress: mapped.billingAddress,
      billingCity: mapped.billingCity,
      billingState: mapped.billingState,
      billingCountry: mapped.billingCountry,
      billingPinCode: mapped.billingPinCode,
      shippingAddress: mapped.shippingAddress,
      shippingCity: mapped.shippingCity,
      shippingState: mapped.shippingState,
      shippingCountry: mapped.shippingCountry,
      shippingPinCode: mapped.shippingPinCode,
    },
  });

  const persons = Array.isArray(zoho[ZOHO_CONTACT.contactPersons])
    ? (zoho[ZOHO_CONTACT.contactPersons] as Array<Record<string, unknown>>)
    : [];
  const primary =
    persons.find((p) => p[ZOHO_CONTACT_PERSON.isPrimaryContact] === true) ??
    persons[0];
  if (primary) {
    const person = mapZohoContactPersonToCrmContact(primary);
    const existing = await prisma.contact.findFirst({
      where: { customerId: crmId, deletedAt: null },
      orderBy: { createdAt: "asc" },
    });
    if (existing) {
      await prisma.contact.update({
        where: { id: existing.id },
        data: person,
      });
    }
  }
}
