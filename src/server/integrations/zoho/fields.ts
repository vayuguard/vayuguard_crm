/**
 * Canonical Zoho Books API field names + bidirectional helpers.
 * Keep CRM camelCase internally; always convert at the mapper boundary.
 */

/** Contact (customer) payload keys — Zoho Books /contacts */
export const ZOHO_CONTACT = {
  contactId: "contact_id",
  contactName: "contact_name",
  companyName: "company_name",
  contactType: "contact_type",
  email: "email",
  phone: "phone",
  website: "website",
  gstNo: "gst_no",
  gstTreatment: "gst_treatment",
  /** Contacts use place_of_contact (NOT place_of_supply). */
  placeOfContact: "place_of_contact",
  billingAddress: "billing_address",
  shippingAddress: "shipping_address",
  contactPersons: "contact_persons",
  lastModifiedTime: "last_modified_time",
} as const;

/** Nested address keys shared by billing_address / shipping_address */
export const ZOHO_ADDRESS = {
  attention: "attention",
  address: "address",
  street2: "street2",
  city: "city",
  state: "state",
  stateCode: "state_code",
  zip: "zip",
  country: "country",
  phone: "phone",
  fax: "fax",
} as const;

/** Contact person keys under contact_persons[] */
export const ZOHO_CONTACT_PERSON = {
  contactPersonId: "contact_person_id",
  firstName: "first_name",
  lastName: "last_name",
  email: "email",
  phone: "phone",
  mobile: "mobile",
  designation: "designation",
  department: "department",
  isPrimaryContact: "is_primary_contact",
} as const;

/** Invoice / Estimate transaction keys */
export const ZOHO_TXN = {
  customerId: "customer_id",
  invoiceId: "invoice_id",
  invoiceNumber: "invoice_number",
  estimateId: "estimate_id",
  estimateNumber: "estimate_number",
  date: "date",
  dueDate: "due_date",
  expiryDate: "expiry_date",
  notes: "notes",
  gstTreatment: "gst_treatment",
  /** Transactions use place_of_supply (NOT place_of_contact). */
  placeOfSupply: "place_of_supply",
  isInclusiveTax: "is_inclusive_tax",
  lineItems: "line_items",
  balance: "balance",
  total: "total",
  lastModifiedTime: "last_modified_time",
} as const;

/** Line item keys */
export const ZOHO_LINE = {
  name: "name",
  description: "description",
  rate: "rate",
  quantity: "quantity",
  discount: "discount",
  taxPercentage: "tax_percentage",
  hsnOrSac: "hsn_or_sac",
} as const;

/** Customer payment keys */
export const ZOHO_PAYMENT = {
  paymentId: "payment_id",
  customerId: "customer_id",
  paymentMode: "payment_mode",
  amount: "amount",
  date: "date",
  referenceNumber: "reference_number",
  description: "description",
  invoices: "invoices",
  invoiceId: "invoice_id",
  amountApplied: "amount_applied",
  lastModifiedTime: "last_modified_time",
} as const;

/**
 * Zoho Books payment_mode allowed values:
 * check | cash | creditcard | banktransfer | bankremittance | autotransaction | others
 */
const PAYMENT_MODE_MAP: Record<string, string> = {
  cash: "cash",
  cheque: "check",
  check: "check",
  "credit card": "creditcard",
  creditcard: "creditcard",
  card: "creditcard",
  upi: "others",
  neft: "banktransfer",
  rtgs: "banktransfer",
  imps: "banktransfer",
  "bank transfer": "banktransfer",
  banktransfer: "banktransfer",
  bank_transfer: "banktransfer",
  "bank remittance": "bankremittance",
  bankremittance: "bankremittance",
  autotransaction: "autotransaction",
  others: "others",
  other: "others",
};

export function toZohoPaymentMode(method: string | null | undefined): string {
  if (!method?.trim()) return "cash";
  const key = method.trim().toLowerCase();
  return PAYMENT_MODE_MAP[key] ?? "others";
}

export function fromZohoPaymentMode(mode: string | null | undefined): string | null {
  if (!mode?.trim()) return null;
  const key = mode.trim().toLowerCase().replace(/_/g, "");
  const reverse: Record<string, string> = {
    cash: "cash",
    check: "cheque",
    creditcard: "credit card",
    banktransfer: "bank transfer",
    bankremittance: "bank remittance",
    autotransaction: "autotransaction",
    others: "others",
  };
  return reverse[key] ?? mode.trim();
}

/** GSTIN numeric prefix → Zoho alphabetic state code (place_of_contact / place_of_supply). */
export const GST_NUMERIC_TO_ALPHA: Record<string, string> = {
  "01": "JK",
  "02": "HP",
  "03": "PB",
  "04": "CH",
  "05": "UK",
  "06": "HR",
  "07": "DL",
  "08": "RJ",
  "09": "UP",
  "10": "BR",
  "11": "SK",
  "12": "AR",
  "13": "NL",
  "14": "MN",
  "15": "MZ",
  "16": "TR",
  "17": "ML",
  "18": "AS",
  "19": "WB",
  "20": "JH",
  "21": "OD",
  "22": "CG",
  "23": "MP",
  "24": "GJ",
  "26": "DN",
  "27": "MH",
  "29": "KA",
  "30": "GA",
  "31": "LD",
  "32": "KL",
  "33": "TN",
  "34": "PY",
  "35": "AN",
  "36": "TS",
  "37": "AP",
  "38": "LA",
};

export const STATE_NAME_TO_ALPHA: Record<string, string> = {
  "andaman and nicobar": "AN",
  "andhra pradesh": "AP",
  "arunachal pradesh": "AR",
  assam: "AS",
  bihar: "BR",
  chandigarh: "CH",
  chhattisgarh: "CG",
  delhi: "DL",
  goa: "GA",
  gujarat: "GJ",
  haryana: "HR",
  "himachal pradesh": "HP",
  "jammu and kashmir": "JK",
  jharkhand: "JH",
  karnataka: "KA",
  kerala: "KL",
  ladakh: "LA",
  lakshadweep: "LD",
  "madhya pradesh": "MP",
  maharashtra: "MH",
  manipur: "MN",
  meghalaya: "ML",
  mizoram: "MZ",
  nagaland: "NL",
  odisha: "OD",
  orissa: "OD",
  puducherry: "PY",
  pondicherry: "PY",
  punjab: "PB",
  rajasthan: "RJ",
  sikkim: "SK",
  "tamil nadu": "TN",
  telangana: "TS",
  tripura: "TR",
  "uttar pradesh": "UP",
  uttarakhand: "UK",
  "west bengal": "WB",
};

/** Normalize any CRM place-of-supply value to Zoho alpha code (e.g. MH, TN). */
export function toZohoStateCode(input: string | null | undefined): string | undefined {
  if (!input?.trim()) return undefined;
  const raw = input.trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(raw)) return raw;
  if (/^\d{2}$/.test(raw) && GST_NUMERIC_TO_ALPHA[raw]) {
    return GST_NUMERIC_TO_ALPHA[raw];
  }
  const lower = input.trim().toLowerCase();
  for (const [name, code] of Object.entries(STATE_NAME_TO_ALPHA)) {
    if (lower.includes(name)) return code;
  }
  return raw.slice(0, 2);
}

export function splitPersonName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "Contact", last_name: "" };
  if (parts.length === 1) return { first_name: parts[0]!, last_name: "" };
  return {
    first_name: parts[0]!,
    last_name: parts.slice(1).join(" "),
  };
}

export function str(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  const s = String(value).trim();
  return s.length ? s : null;
}

export function num(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
