import { ZohoValidationError } from "@/server/integrations/zoho/errors";
import {
  GST_NUMERIC_TO_ALPHA,
  STATE_NAME_TO_ALPHA,
  toZohoStateCode,
} from "@/server/integrations/zoho/fields";

/** Indian GSTIN: 15 chars, e.g. 27AABCU9603R1ZM */
const GSTIN_RE =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

export function isValidGstin(gstin: string | null | undefined) {
  if (!gstin?.trim()) return true; // optional
  return GSTIN_RE.test(gstin.trim());
}

export function assertValidGstin(gstin: string | null | undefined) {
  if (gstin?.trim() && !isValidGstin(gstin)) {
    throw new ZohoValidationError(
      `Invalid GSTIN "${gstin}". Expected 15-character Indian GSTIN.`,
    );
  }
}

export function resolveGstTreatment(input: {
  gstTreatment?: string | null;
  gstNumber?: string | null;
}) {
  if (input.gstTreatment?.trim()) {
    // Zoho values: business_gst | business_none | consumer | overseas
    return input.gstTreatment.trim();
  }
  return input.gstNumber?.trim() ? "business_gst" : "consumer";
}

/**
 * Resolve Zoho place_of_contact / place_of_supply as alphabetic state code (MH, TN…).
 * Prefer explicit placeOfSupply, then GSTIN prefix, then billing state name.
 */
export function resolvePlaceOfSupply(input: {
  placeOfSupply?: string | null;
  billingState?: string | null;
  gstNumber?: string | null;
}): string {
  const fromExplicit = toZohoStateCode(input.placeOfSupply);
  if (fromExplicit) return fromExplicit;

  if (input.gstNumber && input.gstNumber.length >= 2) {
    const numeric = input.gstNumber.slice(0, 2);
    const alpha = GST_NUMERIC_TO_ALPHA[numeric];
    if (alpha) return alpha;
  }

  const state = input.billingState?.trim().toLowerCase() ?? "";
  for (const [name, code] of Object.entries(STATE_NAME_TO_ALPHA)) {
    if (state.includes(name)) return code;
  }

  return "MH"; // VayuGuard India org default — documented assumption
}

export function taxIdForPercent(percent: number) {
  // Zoho India orgs accept tax_percentage on line items.
  return Number(percent);
}
