import { ok } from "@/server/api/response";

const paths = [
  { path: "/api/health", methods: ["GET"] },
  { path: "/api/dashboard", methods: ["GET"] },
  { path: "/api/leads", methods: ["GET", "POST"] },
  { path: "/api/leads/{id}", methods: ["GET", "PATCH", "DELETE"] },
  { path: "/api/customers", methods: ["GET", "POST"] },
  { path: "/api/customers/{id}", methods: ["GET", "PATCH", "DELETE"] },
  { path: "/api/contacts", methods: ["GET", "POST"] },
  { path: "/api/contacts/{id}", methods: ["GET", "PATCH", "DELETE"] },
  { path: "/api/deals", methods: ["GET", "POST"] },
  { path: "/api/deals/{id}", methods: ["GET", "PATCH", "DELETE"] },
  { path: "/api/deals/{id}/move", methods: ["POST"] },
  { path: "/api/pipelines", methods: ["GET", "POST"] },
  { path: "/api/tasks", methods: ["GET", "POST"] },
  { path: "/api/tasks/{id}", methods: ["GET", "PATCH", "DELETE"] },
  { path: "/api/todo-lists", methods: ["GET", "POST"] },
  { path: "/api/todo-lists/{id}", methods: ["GET", "POST", "PATCH", "DELETE"] },
  { path: "/api/calendar", methods: ["GET", "POST"] },
  { path: "/api/products", methods: ["GET", "POST"] },
  { path: "/api/products/{id}", methods: ["GET", "PATCH", "DELETE"] },
  { path: "/api/quotations", methods: ["GET", "POST"] },
  { path: "/api/quotations/{id}", methods: ["GET", "PATCH", "DELETE"] },
  { path: "/api/quotations/{id}/approve", methods: ["POST"] },
  { path: "/api/quotations/{id}/pdf", methods: ["GET"] },
  { path: "/api/quotations/{id}/email", methods: ["POST"] },
  { path: "/api/invoices", methods: ["GET", "POST"] },
  { path: "/api/invoices/{id}", methods: ["GET", "PATCH", "DELETE"] },
  { path: "/api/invoices/{id}/payments", methods: ["POST"] },
  { path: "/api/invoices/{id}/pdf", methods: ["GET"] },
  { path: "/api/tickets", methods: ["GET", "POST"] },
  { path: "/api/tickets/{id}", methods: ["GET", "PATCH", "DELETE"] },
  { path: "/api/tickets/{id}/messages", methods: ["GET", "POST"] },
  { path: "/api/campaigns", methods: ["GET", "POST"] },
  { path: "/api/campaigns/{id}", methods: ["GET", "PATCH", "DELETE"] },
  { path: "/api/employees", methods: ["GET", "POST"] },
  { path: "/api/employees/{id}", methods: ["GET", "PATCH"] },
  { path: "/api/employees/leaderboard", methods: ["GET"] },
  { path: "/api/communications", methods: ["GET", "POST"] },
  { path: "/api/documents", methods: ["GET", "POST"] },
  { path: "/api/documents/{id}", methods: ["GET", "PATCH", "DELETE"] },
  { path: "/api/notifications", methods: ["GET", "PATCH"] },
  { path: "/api/notifications/stream", methods: ["GET"] },
  { path: "/api/reports", methods: ["GET"] },
  {
    path: "/api/reports/export",
    methods: ["GET"],
    description: "Export report as json|csv|xlsx|pdf via ?format=",
  },
  { path: "/api/search", methods: ["GET"] },
  { path: "/api/settings", methods: ["GET", "PATCH"] },
  { path: "/api/settings/roles", methods: ["GET", "PUT"] },
  { path: "/api/audit", methods: ["GET"] },
  { path: "/api/saved-views", methods: ["GET", "POST"] },
  { path: "/api/saved-views/{id}", methods: ["GET", "PATCH", "DELETE"] },
  { path: "/api/uploadthing", methods: ["GET", "POST"] },
  { path: "/api/openapi", methods: ["GET"] },
  { path: "/api/auth/{...nextauth}", methods: ["GET", "POST"] },
];

export async function GET() {
  const pathsObject: Record<string, Record<string, object>> = {};
  for (const entry of paths) {
    pathsObject[entry.path] = {};
    for (const method of entry.methods) {
      pathsObject[entry.path]![method.toLowerCase()] = {
        summary: entry.description ?? `${method} ${entry.path}`,
        responses: {
          "200": { description: "Success" },
          "401": { description: "Unauthorized" },
          "403": { description: "Forbidden" },
          "422": { description: "Validation error" },
        },
      };
    }
  }

  return ok({
    openapi: "3.0.3",
    info: {
      title: "VayuCrm API",
      version: "0.2.0",
      description:
        "OpenAPI listing of major CRM API paths including tasks, todo-lists, calendar, communications, and report exports.",
    },
    servers: [{ url: "/" }],
    paths: pathsObject,
  });
}
