/**
 * Business-card OCR text → structured contact fields.
 *
 * Pure heuristics (no network). Shared by the client scan dialog and the
 * `/api/contacts/scan-card` route so both produce identical results.
 */

export type ParsedCard = {
  name: string;
  designation: string;
  company: string;
  email: string;
  phone: string;
  whatsapp: string;
  website: string;
  linkedinUrl: string;
  twitterUrl: string;
  facebookUrl: string;
  address: string;
  rawText: string;
};

const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]{2,}/g;
const URL_RE =
  /\b(?:https?:\/\/)?(?:www\.)?[\w-]+(?:\.[\w-]+)+(?:\/[\w./%#?=&-]*)?\b/g;

/** Matches +91 98765 43210, (022) 4567-8900, 98765-43210, etc. */
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,5}\)[\s.-]?)?\d{3,5}[\s.-]?\d{3,5}(?:[\s.-]?\d{2,5})?/g;

const DESIGNATION_KEYWORDS = [
  "ceo",
  "cto",
  "cfo",
  "coo",
  "cmo",
  "founder",
  "co-founder",
  "cofounder",
  "chairman",
  "president",
  "vice president",
  "vp",
  "director",
  "managing director",
  "md",
  "general manager",
  "manager",
  "head",
  "lead",
  "supervisor",
  "executive",
  "officer",
  "engineer",
  "architect",
  "consultant",
  "analyst",
  "specialist",
  "coordinator",
  "administrator",
  "associate",
  "assistant",
  "partner",
  "proprietor",
  "owner",
  "sales",
  "marketing",
  "business development",
  "procurement",
  "purchase",
  "operations",
  "technician",
  "designer",
  "developer",
  "scientist",
  "advisor",
  "accountant",
  "secretary",
  "principal",
  "professor",
  "doctor",
];

const COMPANY_KEYWORDS = [
  "pvt",
  "private",
  "ltd",
  "limited",
  "llp",
  "inc",
  "incorporated",
  "corp",
  "corporation",
  "company",
  "co.",
  "gmbh",
  "plc",
  "enterprises",
  "enterprise",
  "industries",
  "industry",
  "technologies",
  "technology",
  "solutions",
  "systems",
  "services",
  "group",
  "holdings",
  "ventures",
  "labs",
  "laboratories",
  "consulting",
  "associates",
  "traders",
  "trading",
  "engineering",
  "infotech",
  "software",
  "healthcare",
  "pharma",
  "logistics",
  "motors",
  "textiles",
  "energy",
  "foundation",
  "institute",
];

const ADDRESS_KEYWORDS = [
  "road",
  "rd",
  "street",
  "st.",
  "lane",
  "nagar",
  "sector",
  "plot",
  "block",
  "floor",
  "building",
  "tower",
  "park",
  "phase",
  "colony",
  "estate",
  "industrial",
  "market",
  "chowk",
  "marg",
  "cross",
  "avenue",
  "opposite",
  "near",
  "behind",
  "po",
  "post",
  "dist",
  "district",
  "pin",
  "pincode",
];

const NOISE_LABELS = [
  "mobile",
  "mob",
  "phone",
  "ph",
  "tel",
  "telephone",
  "cell",
  "email",
  "e-mail",
  "mail",
  "web",
  "website",
  "www",
  "fax",
  "office",
  "gst",
  "gstin",
  "pan",
  "address",
  "add",
  "whatsapp",
  "contact",
];

function includesKeyword(line: string, keywords: string[]) {
  const lower = ` ${line.toLowerCase().replace(/[^a-z0-9.\s-]/g, " ")} `;
  return keywords.some((kw) => lower.includes(` ${kw} `) || lower.includes(` ${kw}.`));
}

function stripLabel(value: string) {
  return value
    .replace(
      /^\s*(?:mobile|mob|phone|ph|tel|telephone|cell|email|e-mail|mail|web|website|fax|office|whatsapp|contact|address|add)\s*[:.\-—]?\s*/i,
      "",
    )
    .trim();
}

function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

/** Keeps 7–15 digit sequences; rejects PIN codes, GST numbers, years. */
function isPlausiblePhone(candidate: string) {
  const digits = digitsOnly(candidate);
  if (digits.length < 7 || digits.length > 15) return false;
  if (/^(?:19|20)\d{2}$/.test(digits)) return false;
  return true;
}

function normalizePhone(candidate: string) {
  const trimmed = candidate.trim().replace(/[.\s]+/g, " ");
  const hasPlus = trimmed.startsWith("+");
  const digits = digitsOnly(trimmed);
  return hasPlus ? `+${digits}` : digits;
}

function normalizeUrl(candidate: string) {
  const value = candidate.trim().replace(/[),.;]+$/, "");
  if (/^https?:\/\//i.test(value)) return value;
  return `https://${value.replace(/^\/+/, "")}`;
}

function looksLikePersonName(line: string) {
  if (/\d/.test(line)) return false;
  if (line.includes("@")) return false;
  const cleaned = line.replace(/[^A-Za-z.\s'-]/g, "").trim();
  if (!cleaned) return false;
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 5) return false;
  if (includesKeyword(cleaned, COMPANY_KEYWORDS)) return false;
  if (includesKeyword(cleaned, DESIGNATION_KEYWORDS)) return false;
  if (NOISE_LABELS.some((n) => cleaned.toLowerCase().startsWith(n))) return false;
  // Reject SHOUTING blocks longer than 3 words (usually company names)
  if (cleaned === cleaned.toUpperCase() && words.length > 3) return false;
  return words.every((w) => /^[A-Za-z][A-Za-z.'-]*$/.test(w));
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/**
 * Parses raw OCR output from a business card.
 * Every field falls back to an empty string so callers can prefill forms safely.
 */
export function parseBusinessCard(rawText: string): ParsedCard {
  const text = (rawText ?? "").replace(/\r/g, "");
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\s{2,}/g, " ").trim())
    .filter((l) => l.length > 1);

  // ── Emails ────────────────────────────────────────────────────────────────
  const emails = Array.from(text.matchAll(EMAIL_RE)).map((m) =>
    m[0].toLowerCase(),
  );
  const email = emails[0] ?? "";
  const emailDomains = new Set(emails.map((e) => e.split("@")[1] ?? ""));

  // ── Social + website ──────────────────────────────────────────────────────
  // Emails are removed first, otherwise "rohan.mehta@x.in" yields "rohan.mehta"
  // as a bogus domain.
  const textWithoutEmails = text.replace(EMAIL_RE, " ");
  const urls = Array.from(textWithoutEmails.matchAll(URL_RE)).map((m) => m[0]);

  let linkedinUrl = "";
  let twitterUrl = "";
  let facebookUrl = "";
  let website = "";

  for (const url of urls) {
    const lower = url.toLowerCase();
    if (!linkedinUrl && lower.includes("linkedin.")) {
      linkedinUrl = normalizeUrl(url);
      continue;
    }
    if (!twitterUrl && (lower.includes("twitter.") || lower.includes("x.com"))) {
      twitterUrl = normalizeUrl(url);
      continue;
    }
    if (!facebookUrl && (lower.includes("facebook.") || lower.includes("fb.com"))) {
      facebookUrl = normalizeUrl(url);
      continue;
    }
    if (website) continue;
    // Skip bare email domains and non-domain noise
    const host = lower.replace(/^https?:\/\//, "").split("/")[0];
    if (emailDomains.has(host) && !lower.includes("www.")) continue;
    if (!/\.[a-z]{2,}$/.test(host)) continue;
    if (NOISE_LABELS.includes(host)) continue;
    website = normalizeUrl(url);
  }

  // ── Phones ────────────────────────────────────────────────────────────────
  const phoneCandidates: string[] = [];
  for (const line of lines) {
    const withoutUrls = line.replace(EMAIL_RE, " ").replace(URL_RE, " ");
    // GST/PAN lines carry long alphanumerics — skip them
    if (/\b(?:gst|gstin|pan)\b/i.test(withoutUrls)) continue;
    for (const match of withoutUrls.matchAll(PHONE_RE)) {
      const candidate = match[0];
      if (!isPlausiblePhone(candidate)) continue;
      const normalized = normalizePhone(candidate);
      if (!phoneCandidates.includes(normalized)) phoneCandidates.push(normalized);
    }
  }

  // Prefer a line explicitly labelled WhatsApp
  let whatsapp = "";
  const whatsappLine = lines.find((l) => /whats\s?app/i.test(l));
  if (whatsappLine) {
    const match = Array.from(whatsappLine.matchAll(PHONE_RE))
      .map((m) => m[0])
      .find(isPlausiblePhone);
    if (match) whatsapp = normalizePhone(match);
  }

  const phone = phoneCandidates[0] ?? "";
  if (!whatsapp) {
    // Mobile-length alternate number becomes WhatsApp
    whatsapp =
      phoneCandidates.find(
        (p) => p !== phone && digitsOnly(p).length >= 10,
      ) ?? "";
  }

  // ── Company ───────────────────────────────────────────────────────────────
  let company = "";
  for (const line of lines) {
    if (includesKeyword(line, COMPANY_KEYWORDS)) {
      company = stripLabel(line).replace(/\s{2,}/g, " ");
      break;
    }
  }

  // ── Designation ───────────────────────────────────────────────────────────
  let designation = "";
  let designationIndex = -1;
  for (const [index, line] of lines.entries()) {
    if (line === company) continue;
    if (includesKeyword(line, DESIGNATION_KEYWORDS)) {
      const cleaned = stripLabel(line).replace(/[|•]/g, " ").replace(/\s{2,}/g, " ");
      if (cleaned.length <= 60) {
        designation = cleaned;
        designationIndex = index;
        break;
      }
    }
  }

  // ── Name ──────────────────────────────────────────────────────────────────
  let name = "";
  // Prefer the line directly above the designation (classic card layout)
  if (designationIndex > 0) {
    const above = lines[designationIndex - 1];
    if (above && above !== company && looksLikePersonName(above)) {
      name = above;
    }
  }
  if (!name) {
    const candidate = lines.find(
      (l) => l !== company && l !== designation && looksLikePersonName(l),
    );
    if (candidate) name = candidate;
  }
  if (!name && email) {
    // Fall back to the email local part: "rohan.mehta@x.com" → "Rohan Mehta"
    const local = email.split("@")[0].replace(/\d+/g, "");
    const words = local.split(/[._-]+/).filter((w) => w.length > 1);
    if (words.length >= 1) name = titleCase(words.join(" "));
  }
  name = name.replace(/[^A-Za-z.\s'-]/g, "").replace(/\s{2,}/g, " ").trim();

  // ── Address ───────────────────────────────────────────────────────────────
  const addressLines = lines.filter((line) => {
    if (line === company || line === designation || line === name) return false;
    if (line.includes("@")) return false;
    if (/whats\s?app/i.test(line)) return false;
    return includesKeyword(line, ADDRESS_KEYWORDS) || /\b\d{6}\b/.test(line);
  });

  return {
    name,
    designation,
    company,
    email,
    phone,
    whatsapp: whatsapp === phone ? "" : whatsapp,
    website,
    linkedinUrl,
    twitterUrl,
    facebookUrl,
    address: addressLines.join(", "),
    rawText: text.trim(),
  };
}
