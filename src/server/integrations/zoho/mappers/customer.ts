import type { Contact, Customer } from "@prisma/client";
import {
  assertValidGstin,
  resolveGstTreatment,
  resolvePlaceOfSupply,
} from "@/server/integrations/zoho/mappers/gst";
import { ZohoValidationError } from "@/server/integrations/zoho/errors";
import {
  ZOHO_ADDRESS,
  ZOHO_CONTACT,
  ZOHO_CONTACT_PERSON,
  splitPersonName,
  str,
} from "@/server/integrations/zoho/fields";

export type CustomerLike = Pick<
  Customer,
  | "id"
  | "name"
  | "legalName"
  | "email"
  | "phone"
  | "website"
  | "gstNumber"
  | "gstTreatment"
  | "placeOfSupply"
  | "billingAddress"
  | "billingCity"
  | "billingState"
  | "billingCountry"
  | "billingPinCode"
  | "shippingAddress"
  | "shippingCity"
  | "shippingState"
  | "shippingCountry"
  | "shippingPinCode"
>;

export type ContactLike = Pick<
  Contact,
  "name" | "email" | "phone" | "whatsapp" | "designation" | "department"
>;

function mapAddress(input: {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  zip?: string | null;
  phone?: string | null;
}) {
  return {
    [ZOHO_ADDRESS.address]: input.address ?? undefined,
    [ZOHO_ADDRESS.city]: input.city ?? undefined,
    [ZOHO_ADDRESS.state]: input.state ?? undefined,
    [ZOHO_ADDRESS.country]: input.country ?? "India",
    [ZOHO_ADDRESS.zip]: input.zip ?? undefined,
    [ZOHO_ADDRESS.phone]: input.phone ?? undefined,
  };
}

/**
 * Pure mapper: CRM Customer (+ optional primary Contact) → Zoho Books Contact.
 * Uses official Zoho field names: place_of_contact, gst_no, contact_persons, …
 */
export function mapCustomerToZohoContact(
  customer: CustomerLike,
  primaryContact?: ContactLike | null,
) {
  if (!customer.name?.trim()) {
    throw new ZohoValidationError("Customer name is required for Zoho sync");
  }
  assertValidGstin(customer.gstNumber);

  const gstTreatment = resolveGstTreatment(customer);
  const placeOfContact = resolvePlaceOfSupply(customer);

  const personSource = primaryContact?.name?.trim()
    ? primaryContact
    : {
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        whatsapp: null as string | null,
        designation: null as string | null,
        department: null as string | null,
      };

  const names = splitPersonName(personSource.name || customer.name);
  const contactPersons = [
    {
      [ZOHO_CONTACT_PERSON.firstName]: names.first_name,
      [ZOHO_CONTACT_PERSON.lastName]: names.last_name,
      [ZOHO_CONTACT_PERSON.email]:
        personSource.email ?? customer.email ?? undefined,
      [ZOHO_CONTACT_PERSON.phone]:
        personSource.phone ?? customer.phone ?? undefined,
      [ZOHO_CONTACT_PERSON.mobile]: personSource.whatsapp ?? undefined,
      [ZOHO_CONTACT_PERSON.designation]: personSource.designation ?? undefined,
      [ZOHO_CONTACT_PERSON.department]: personSource.department ?? undefined,
      [ZOHO_CONTACT_PERSON.isPrimaryContact]: true,
    },
  ];

  return {
    [ZOHO_CONTACT.contactName]: customer.name.trim(),
    [ZOHO_CONTACT.companyName]:
      customer.legalName?.trim() || customer.name.trim(),
    [ZOHO_CONTACT.contactType]: "customer",
    // Keep root email/phone for search compatibility; Zoho also stores them on contact_persons
    [ZOHO_CONTACT.email]: customer.email ?? undefined,
    [ZOHO_CONTACT.phone]: customer.phone ?? undefined,
    [ZOHO_CONTACT.website]: customer.website ?? undefined,
    [ZOHO_CONTACT.gstNo]: customer.gstNumber?.trim() || undefined,
    [ZOHO_CONTACT.gstTreatment]: gstTreatment,
    [ZOHO_CONTACT.placeOfContact]: placeOfContact,
    [ZOHO_CONTACT.billingAddress]: mapAddress({
      address: customer.billingAddress,
      city: customer.billingCity,
      state: customer.billingState,
      country: customer.billingCountry,
      zip: customer.billingPinCode,
      phone: customer.phone,
    }),
    [ZOHO_CONTACT.shippingAddress]: mapAddress({
      address: customer.shippingAddress,
      city: customer.shippingCity,
      state: customer.shippingState,
      country: customer.shippingCountry,
      zip: customer.shippingPinCode,
    }),
    [ZOHO_CONTACT.contactPersons]: contactPersons,
  };
}

function readAddress(raw: unknown) {
  if (!raw || typeof raw !== "object") {
    return {
      address: null as string | null,
      city: null as string | null,
      state: null as string | null,
      country: null as string | null,
      zip: null as string | null,
    };
  }
  const a = raw as Record<string, unknown>;
  return {
    address: str(a[ZOHO_ADDRESS.address]),
    city: str(a[ZOHO_ADDRESS.city]),
    state: str(a[ZOHO_ADDRESS.state]),
    country: str(a[ZOHO_ADDRESS.country]),
    zip: str(a[ZOHO_ADDRESS.zip] ?? a.zip),
  };
}

/**
 * Pure mapper: Zoho Books Contact → CRM Customer patch fields.
 */
export function mapZohoContactToCustomer(zoho: Record<string, unknown>) {
  const persons = Array.isArray(zoho[ZOHO_CONTACT.contactPersons])
    ? (zoho[ZOHO_CONTACT.contactPersons] as Array<Record<string, unknown>>)
    : [];
  const primary =
    persons.find((p) => p[ZOHO_CONTACT_PERSON.isPrimaryContact] === true) ??
    persons[0];

  const billing = readAddress(zoho[ZOHO_CONTACT.billingAddress]);
  const shipping = readAddress(zoho[ZOHO_CONTACT.shippingAddress]);

  const email =
    str(zoho[ZOHO_CONTACT.email]) ??
    str(primary?.[ZOHO_CONTACT_PERSON.email]);
  const phone =
    str(zoho[ZOHO_CONTACT.phone]) ??
    str(primary?.[ZOHO_CONTACT_PERSON.phone]) ??
    str(primary?.[ZOHO_CONTACT_PERSON.mobile]);

  return {
    name:
      str(zoho[ZOHO_CONTACT.contactName]) ??
      str(zoho[ZOHO_CONTACT.companyName]) ??
      "Zoho Contact",
    legalName: str(zoho[ZOHO_CONTACT.companyName]),
    email,
    phone,
    website: str(zoho[ZOHO_CONTACT.website]),
    gstNumber: str(zoho[ZOHO_CONTACT.gstNo]),
    gstTreatment: str(zoho[ZOHO_CONTACT.gstTreatment]),
    placeOfSupply: str(zoho[ZOHO_CONTACT.placeOfContact]),
    billingAddress: billing.address,
    billingCity: billing.city,
    billingState: billing.state,
    billingCountry: billing.country,
    billingPinCode: billing.zip,
    shippingAddress: shipping.address,
    shippingCity: shipping.city,
    shippingState: shipping.state,
    shippingCountry: shipping.country,
    shippingPinCode: shipping.zip,
  };
}

/**
 * Pure mapper: Zoho contact_persons[0] → CRM Contact patch (person, not company).
 */
export function mapZohoContactPersonToCrmContact(
  person: Record<string, unknown>,
) {
  const first = str(person[ZOHO_CONTACT_PERSON.firstName]) ?? "";
  const last = str(person[ZOHO_CONTACT_PERSON.lastName]) ?? "";
  const name = [first, last].filter(Boolean).join(" ").trim() || "Contact";
  return {
    name,
    email: str(person[ZOHO_CONTACT_PERSON.email]),
    phone: str(person[ZOHO_CONTACT_PERSON.phone]),
    whatsapp: str(person[ZOHO_CONTACT_PERSON.mobile]),
    designation: str(person[ZOHO_CONTACT_PERSON.designation]),
    department: str(person[ZOHO_CONTACT_PERSON.department]),
  };
}
