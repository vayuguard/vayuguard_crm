import type { Customer } from "@prisma/client";
import {
  assertValidGstin,
  resolveGstTreatment,
  resolvePlaceOfSupply,
} from "@/server/integrations/zoho/mappers/gst";
import { ZohoValidationError } from "@/server/integrations/zoho/errors";

export type CustomerLike = Pick<
  Customer,
  | "id"
  | "name"
  | "legalName"
  | "email"
  | "phone"
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

/** Pure mapper: CRM Customer → Zoho Books Contact (customer). */
export function mapCustomerToZohoContact(customer: CustomerLike) {
  if (!customer.name?.trim()) {
    throw new ZohoValidationError("Customer name is required for Zoho sync");
  }
  assertValidGstin(customer.gstNumber);

  const gstTreatment = resolveGstTreatment(customer);
  const placeOfSupply = resolvePlaceOfSupply(customer);

  return {
    contact_name: customer.name.trim(),
    company_name: customer.legalName?.trim() || customer.name.trim(),
    contact_type: "customer",
    email: customer.email ?? undefined,
    phone: customer.phone ?? undefined,
    gst_no: customer.gstNumber?.trim() || undefined,
    gst_treatment: gstTreatment,
    place_of_supply: placeOfSupply,
    billing_address: {
      address: customer.billingAddress ?? undefined,
      city: customer.billingCity ?? undefined,
      state: customer.billingState ?? undefined,
      country: customer.billingCountry ?? "India",
      zip: customer.billingPinCode ?? undefined,
    },
    shipping_address: {
      address: customer.shippingAddress ?? undefined,
      city: customer.shippingCity ?? undefined,
      state: customer.shippingState ?? undefined,
      country: customer.shippingCountry ?? "India",
      zip: customer.shippingPinCode ?? undefined,
    },
  };
}
