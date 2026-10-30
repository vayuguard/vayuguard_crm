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
