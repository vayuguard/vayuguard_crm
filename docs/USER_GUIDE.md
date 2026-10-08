# VayuGuard CRM — Complete User Guide

This guide explains **what every module means**, **how to use it**, and **how records flow together** from first login to paid invoice.

---

## 1. Big picture (what is what)

| Term | Meaning | Typical use |
|------|---------|-------------|
| **Lead** | A sales opportunity (person + company on one record) before they buy | Inbound enquiry, demo request, cold outreach |
| **Customer** | A company/account you sell to and bill | Won deal, existing client |
| **Contact** | A person (buyer, finance, stores) optionally linked to a Customer | Visiting cards, Zoho contact persons |
| **Deal** | Opportunity value on the Pipeline board | Expected revenue by stage |
| **Quotation** | Formal price offer to a Customer | Line items + GST |
| **Invoice** | Bill to a Customer | Collect payment |
| **Payment** | Money received against an Invoice | Cash / bank / UPI etc. |
| **Task** | Work item / call / follow-up | Personal or team to-do |
| **Ticket** | Support case | After-sales issues |
| **Campaign** | Marketing blast (record + metrics) | Email/SMS/WhatsApp plans |
| **Zoho Sync** | Pulls data **from** Zoho Books into CRM (inbound only) | Keep GST/books in sync |

### Happy-path sales flow

```
Lead  →  (qualify)  →  Convert to Customer (+ Contact)
                           ↓
                     Pipeline Deal (optional)
                           ↓
                      Quotation → Approve → Create Invoice
                           ↓
                      Record Payment → Paid
```

### Alternate entry points

- **Business card** → Contacts → **Convert to Lead** or **Convert to Customer**
- **Existing client** → create Customer directly → Add Contact → Quote → Invoice
- **Zoho Books** → link + pull updates onto existing Customer/Invoice (does not invent new CRM leads)

---

## 2. Login, roles, and navigation

1. Open the app → `/login` with email + password.
2. Sidebar shows only modules your **role** allows.
3. Use the **command palette** (search) for quick jumps.
4. **Notifications** sit in the top bar (including optional web push).

### Roles (default)

| Role | Can roughly… |
|------|----------------|
| **SUPER_ADMIN / ADMIN** | Everything |
| **SALES_MANAGER** | Full sales CRM (leads, customers, contacts, deals, quotes approve, reports…) |
| **SALES_EXECUTIVE** | Sell day-to-day; convert leads; create quotes (not always approve); no invoices/settings |
| **MARKETING** | Leads + campaigns; limited customers |
| **SUPPORT** | Tickets + read customers/contacts |
| **ACCOUNTANT** | Invoices, payments, reports |
| **VIEWER** | Read-only |

Permissions are named `module:action` (e.g. `leads:write`, `customers:export`). Admins can change role permissions under **Settings → Roles**.

---

## 3. Dashboard (`/dashboard`)

**What it means:** At-a-glance KPIs for the team.

**You will see:** lead counts, follow-ups, won/lost, monthly revenue, funnel, sources, recent activity, due tasks, upcoming meetings, employee performance.

**How to use:** View only — click into modules from the sidebar for actions.

---

## 4. Leads (`/leads`)

**What it means:** People/companies still in the sales funnel.

### Create
- **New lead** → fill name (required), company, email, phone, WhatsApp, website, address, source, campaign, assignee, status, priority, deal value, close date, notes, tags.
- Or **Import Excel** (needs `leads:import`). Duplicate emails are skipped.
- Or from a **Contact** → Convert to lead (see Contacts).

### Work a lead
- Open `/leads/[id]`.
- Move **status**: `NEW` → `CONTACTED` → `QUALIFIED` → `PROPOSAL` → `NEGOTIATION` → `WON` / `LOST` / `HOLD`.
- Set **priority**: `LOW` / `MEDIUM` / `HIGH` / `URGENT`.
- Add **attachments** (file name + URL).
- Timeline shows activities (created, updated, converted…).
- List tools: search, filters, **bulk** status/priority, **merge** duplicates, **saved views**, **export**.

### Convert Lead → Customer (built-in)
1. Open the lead.
2. Click **Convert to customer** (needs `leads:write` **and** `customers:write`).
3. Confirm.

**What happens:**
- Creates a **Customer** (`CU-YYYY-####`) from company/name + address.
- Creates a **Contact** from the person fields (default).
- Sets lead status to **WON** and links `customerId`.
- Moves related deals/tasks/meetings/communications/documents onto the customer.
- Lead row is kept (not deleted).

You are then sent to the customers list.

---

## 5. Customers (`/customers`)

**What it means:** Accounts you sell/bill to (company level).

### Create
- **New customer** with GST fields, billing/shipping, assignee, notes.
- Or convert from **Lead** / **Contact**.
- Or **Excel import/export**.

### Detail page (`/customers/[id]`)
Tabs: Overview · Contacts · Projects · Invoices · Payments · Tickets · Documents · Communications · Deals · Timeline.

- **Edit** customer profile.
- **Add contact** on the Contacts tab (links person to this account).
- **Zoho badge**: Linked / Not linked · **Pull from Zoho** when linked.

**Note:** Creating a customer alone does **not** auto-create a contact — use **Add contact** or lead convert.

---

## 6. Contacts (`/contacts`)

**What it means:** Individual people. Optional link to a Customer.

### Create
- **New contact** — name, designation, department, email, phone, WhatsApp, birthday, customer, relationship score, social links, notes, tags.
- **Scan card** — camera/OCR fills fields (company may match an existing customer).
- **Excel import/export** — columns:  
  `name`, `email`, `phone`, `whatsapp`, `designation`, `department`, `customerNumber`, `customerEmail`, `interest` (`not_interested` / `cold` / `warm` / `interested` / `hot`), social URLs, `notes`, `tags`.  
  (`interest` maps to relationship score.)

### Convert Contact → Lead
1. On the contacts table, click the **person+** icon.
2. Confirm.
3. A new lead opens (source `Contact`). Contact itself is unchanged.

Needs `contacts:write` + `leads:write`.

### Convert Contact → Customer
1. Only if the contact is **not** already linked to a customer.
2. Click the **building** icon.
3. Optional company name → **Create customer**.
4. Customer is created and the contact is linked; you land on the customer page.

Needs `contacts:write` + `customers:write`.

### Link to existing customer
Edit contact → choose **Customer** → Save.  
Or Excel: set `customerNumber` / `customerEmail`.

---

## 7. Pipeline / Deals (`/pipeline`)

**What it means:** Visual sales board (stages) with deal values.

### How to use
1. Pick a pipeline (if more than one). Pipelines/stages are managed in **Settings → Pipelines**.
2. Click **New deal** — title, expected revenue, stage, optional customer.
3. **Drag** cards between stages to update progress.
4. Forecast cards show weighted value (`revenue × probability`).

Needs `deals:write` to create/move.

---

## 8. Tasks (`/tasks`)

**What it means:** Work items for you or teammates.

- Types: `TASK`, `CALL`, `MEETING`, `REMINDER`, `FOLLOW_UP`.
- Statuses: `TODO` → `IN_PROGRESS` → `DONE` / `CANCELLED`.
- Board or list; drag to change status; optional recurrence.
- **Todo lists** with checklist items live on the same page.

---

## 9. Calendar (`/calendar`)

**What it means:** Month/week/day view of tasks, calls, follow-ups, meetings, events.

**How to use:** Browse schedule. Creating calendar events from this screen is limited; use **Tasks** for actionable follow-ups. Google Calendar sync is a feature-flag stub unless configured.

---

## 10. Communications (`/communications`)

**What it means:** Log of emails / calls / WhatsApp / SMS / meeting notes (manual log, not a full mailbox).

- Create a log: type, direction (inbound/outbound), subject, body, link context.
- `@mention` teammates to notify them.
- Does **not** send real email/SMS by itself (except quotation email, which uses the configured/console email provider).

---

## 11. Products (`/products`)

**What it means:** Sellable catalog used on quotations and invoices.

Fields: SKU, name, price, GST %, category, inventory, description, image URLs.

Create/edit/delete with `products:write`.

---

## 12. Quotations (`/quotations`)

**What it means:** Formal offer to a **Customer**.

### Create
1. Select customer.
2. Add line items (pick product to auto-fill description/price/GST).
3. Discount, terms, notes, valid until → Save (`QT-YYYY-####`).

### Detail actions
- **Approve** (`quotes:approve`)
- **Email** (`quotes:write`) — sends via email provider (may log to console in dev)
- **Create invoice** (`invoices:write`) — copies lines into a draft invoice and opens Invoices
- **Open PDF** — text preview endpoint (not a designed PDF layout)

Statuses: `DRAFT` → `SENT` → `APPROVED` / `REJECTED` / `EXPIRED`.

---

## 13. Invoices (`/invoices`)

**What it means:** Bills to customers.

### Create
- Manually: customer + due date + line items.
- Or from a quotation: **Create invoice** on the quote.

### Collect money
- Open invoice → **Record payment** (amount, method, reference, date).
- Status/payment status auto-update: `PENDING` / `PARTIAL` / `PAID` / `OVERDUE`, etc.

Zoho badge appears when invoices are linked for inbound pull.

---

## 14. Support (`/support`)

**What it means:** Customer support tickets.

- Create: subject, description, priority, department, customer id, assignee, SLA due.
- Statuses: `OPEN` → `IN_PROGRESS` → `WAITING` → `RESOLVED` → `CLOSED`.
- Reply / internal notes on the ticket thread.

---

## 15. Marketing (`/marketing`)

**What it means:** Campaign records and performance metrics.

- Create: name, channel (`EMAIL` / `SMS` / `WHATSAPP`), subject, content, budget, status.
- View metrics (sent/open/click/leads/revenue) when populated.
- Full send/schedule engines and recipient pickers are limited — treat as campaign planning + tracking unless outbound providers are wired.

---

## 16. Employees (`/employees`)

**What it means:** Team directory + sales leaderboard.

- Browse profiles, targets, attendance, commissions (often read-only in UI).
- Invite/manage login users under **Settings → Users**.
- Recording attendance/targets/commissions is primarily API-backed unless you extend the UI.

---

## 17. Reports (`/reports`)

**What it means:** Analytics slices: sales, revenue, conversion, performance, sources, ROI, tickets, invoices, payments.

Pick report type + date range → chart/table → **Export** CSV/XLSX/PDF (`reports:export`).

---

## 18. Documents (`/documents`)

**What it means:** File library linked to categories (contract, invoice, customer, etc.).

Upload via name + category + **file URL** (and versioning). Prefer storing files in your upload service and pasting the URL.

---

## 19. Settings (`/settings`)

| Tab | Purpose |
|-----|---------|
| **Company** | Name, logo, brand colors, GST/PAN, address, currency, timezone |
| **Channels** | Email / SMS / WhatsApp settings JSON |
| **Feature flags** | AI, Google Calendar, WhatsApp campaigns |
| **Roles** | Edit permission sets |
| **Users** | Invite users (name, email, password, role…), rename, deactivate |
| **Custom fields** | Define extra fields (definitions only — not yet rendered on all forms) |
| **Pipelines** | Create sales pipelines |

Needs `settings:read` / `settings:write`. User management needs `users:manage` / write as configured.

---

## 20. Zoho Sync (`/settings/zoho`)

**What it means:** **Inbound-only** sync from Zoho Books → CRM.

| Zoho | CRM |
|------|-----|
| Contact (company) | Customer |
| `contact_persons` | Contact people |
| Invoice / Payment | Invoice / Payment |

### How to use
1. Configure Zoho env vars (see `docs/ZOHO_INTEGRATION.md`).
2. Open Zoho Sync — connection badge, pull toggle, job counters.
3. **Pull updates now** / retry failed jobs.
4. On a customer/invoice: badge shows Linked; use **Pull from Zoho**.

CRM does **not** push creates to Zoho in the current product mode. Unknown Zoho records are not auto-created without an existing link.

---

## 21. Audit (`/audit`)

**What it means:** Security/compliance trail of who did what.

Filter by action family, search entities. Read-only (`audit:read`).

---

## 22. Excel round-trips (Leads / Customers / Contacts)

| Action | Where |
|--------|--------|
| Download template | Export with `?template=1` via UI **Template** |
| Export current filters | **Export** button |
| Import | **Import** upload |

Always use the same column headers for import as export. Contacts use `interest` instead of numeric relationship score / birthday.

---

## 23. End-to-end recipes

### A) New enquiry → paid invoice
1. Create **Lead** → qualify statuses.
2. **Convert to customer**.
3. Optional: **New deal** on Pipeline.
4. Create **Quotation** → Approve → **Create invoice**.
5. **Record payment** until Paid.

### B) Visiting card → account
1. **Scan card** / New contact.
2. Either **Convert to lead** (still selling) or **Convert to customer** (already a client).
3. Continue with quote/invoice as needed.

### C) Existing Zoho customer
1. Ensure CRM customer exists and is **linked**.
2. **Pull from Zoho** to refresh GST/address/persons.
3. Quote/invoice in CRM as usual.

---

## 24. What was added for complete workflow

These were missing and are now available in the product:

| Feature | Where |
|---------|--------|
| Contact → Lead | Contacts row action |
| Contact → Customer | Contacts row action |
| Add contact on customer | Customer detail → Contacts tab |
| Create deal in UI | Pipeline → New deal |
| Quotation → Invoice | Quotation detail → Create invoice |

---

## 25. Known limits (honest)

- PDF for quotes/invoices is a **text preview**, not a designed PDF.
- Outbound email/SMS/WhatsApp sending depends on providers (often console/stub in local).
- Custom field definitions are not fully painted on every form yet.
- Calendar/Google sync and campaign blast engines are partial.
- Projects / attendance entry UIs are limited relative to the database.

For Zoho field mapping and ops, read **`docs/ZOHO_INTEGRATION.md`**.
