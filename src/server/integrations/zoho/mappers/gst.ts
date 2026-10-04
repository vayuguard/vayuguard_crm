import { ZohoValidationError } from "@/server/integrations/zoho/errors";

/** Indian GSTIN: 15 chars, e.g. 27AABCU9603R1ZM */
const GSTIN_RE =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/i;

const STATE_CODES: Record<string, string> = {
  andaman: "35",
  "andhra pradesh": "37",
  "arunachal pradesh": "12",
  assam: "18",
  bihar: "10",
  chandigarh: "04",
  chhattisgarh: "22",
  delhi: "07",
  goa: "30",
  gujarat: "24",
  haryana: "06",
  "himachal pradesh": "02",
  "jammu and kashmir": "01",
  jharkhand: "20",
  karnataka: "29",
  kerala: "32",
  ladakh: "38",
  lakshadweep: "31",
  "madhya pradesh": "23",
  maharashtra: "27",
  manipur: "14",
  meghalaya: "17",
  mizoram: "15",
  nagaland: "13",
  odisha: "21",
  puducherry: "34",
  punjab: "03",
  rajasthan: "08",
  sikkim: "11",
  "tamil nadu": "33",
  telangana: "36",
  tripura: "16",
  "uttar pradesh": "09",
  uttarakhand: "05",
  "west bengal": "19",
};

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
  if (input.gstTreatment?.trim()) return input.gstTreatment.trim();
  return input.gstNumber?.trim() ? "business_gst" : "consumer";
}

/** Zoho place_of_supply expects state code like "MH" or "27" depending on setup; we send code. */
export function resolvePlaceOfSupply(input: {
  placeOfSupply?: string | null;
  billingState?: string | null;
  gstNumber?: string | null;
}) {
  if (input.placeOfSupply?.trim()) return input.placeOfSupply.trim();
  if (input.gstNumber && input.gstNumber.length >= 2) {
    return input.gstNumber.slice(0, 2);
  }
  const state = input.billingState?.trim().toLowerCase() ?? "";
  for (const [name, code] of Object.entries(STATE_CODES)) {
    if (state.includes(name)) return code;
  }
  return "27"; // Maharashtra default for VayuGuard India org — documented assumption
}

export function taxIdForPercent(percent: number) {
  // Zoho India orgs usually have tax names; we send tax_percentage on line items
  // and let Zoho resolve. Assumption: percentage-based line tax is accepted.
  return Math.round(percent);
}
