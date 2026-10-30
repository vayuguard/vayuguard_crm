/** Plain-language labels for status / priority enums shown to non-technical users. */

export const LEAD_STATUS_LABELS: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Interested",
  PROPOSAL: "Quote sent",
  NEGOTIATION: "Negotiating",
  WON: "Won",
  LOST: "Lost",
  HOLD: "On hold",
};

export const LEAD_STATUS_ORDER = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
  "HOLD",
] as const;

export const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  MEDIUM: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export const TASK_STATUS_LABELS: Record<string, string> = {
  TODO: "To do",
  IN_PROGRESS: "Doing",
  DONE: "Done",
  CANCELLED: "Cancelled",
};

export function leadStatusLabel(status?: string | null) {
  if (!status) return "—";
  return LEAD_STATUS_LABELS[status] ?? status;
}

export function priorityLabel(priority?: string | null) {
  if (!priority) return "—";
  return PRIORITY_LABELS[priority] ?? priority;
}

/** How the employee talked to the client (stored on LeadActivity.type). */
export const TALK_TYPE_OPTIONS = [
  { value: "CALL", label: "Call" },
  { value: "VISIT", label: "Visit" },
  { value: "WHATSAPP", label: "WhatsApp" },
  { value: "EMAIL", label: "Email" },
  { value: "NOTE", label: "Other" },
] as const;

export const TALK_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TALK_TYPE_OPTIONS.map((o) => [o.value, o.label]),
);

export function talkTypeLabel(type?: string | null) {
  if (!type) return "Note";
  return TALK_TYPE_LABELS[type] ?? type.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}
