```
# MASTER TASK: Integrate this CRM with Zoho Books (end to end)
```

```
You are a senior backend engineer in my existing CRM project. Read this whole
file, then execute ALL phases in order, in one go, without waiting for me
between phases. Stop and ask only in the cases under "When to stop and ask".
```

# `## Working rules (all phases)` 

`1. Follow the existing language, framework, ORM, folder structure and code style. Do NOT introduce a new framework.` 

```
2. Never hardcode secrets. Use environment variables, document them
```

```
in .env.example, keep .env in .gitignore. Never print or log secrets or tokens.
3. Never call Zoho inside a user's request/save cycle. Always use a background
queue/job (use the project's queue, or a DB-backed queue table with a worker
command).
4. Every Zoho write must be idempotent: check the stored zoho_id first, then
create or update.
```

```
5. Log every Zoho request/response in a sync_log table (secrets removed).
```

`6. Retry with exponential backoff on HTTP 429 and 5xx. Respect rate limits (~100 requests/min per organization, configurable).` 

```
7. Database changes are additive only. Never drop, rename or destructively alter
existing tables or data.
8. Create git branch feature/zoho-integration first (if git exists) and commit
after each phase.
```

```
9. Write tests for new logic, run them, and fix failures before the next phase.
10. Use the Zoho sandbox/test organization only. ZOHO_SYNC_ENABLED defaults to
false.
```

```
11. Verify Zoho API paths, scopes and field names against Zoho's official Books
API docs. If you cannot access them, state which parts are assumptions.
```

# `## When to stop and ask` 

- `You need Zoho credentials/values. Tell me exactly which .env variable to fill. I will fill it myself; never ask me to paste secrets in chat.` 

- `CRM models lack something that makes mapping impossible (e.g. no GSTIN field). Suggest a fix and ask yes/no.` 

- `A change would be destructive or risky.` 

- `Something must run against a real DB or a real (non-sandbox) Zoho org. Otherwise decide sensibly, note the decision in the docs, and continue.` 

# `## Phase 1: Discover (no code changes)` 

```
Read the codebase and DB schema. Find: language/framework/ORM/DB, how queues,
config and env work, existing tables/models for customers, quotations, invoices,
payments, GST, items, where each is created/updated (files, events), and how
auth/admin permissions work. Write a "Project findings" section in
docs/ZOHO_INTEGRATION.md. Decide a folder structure for a new module
integrations/zoho that fits the project.
```

```
## Phase 2: Config and credentials
```

```
1. Add to .env.example and config loader: ZOHO_DC (in/com/eu), ZOHO_CLIENT_ID,
ZOHO_CLIENT_SECRET, ZOHO_REFRESH_TOKEN, ZOHO_ORGANIZATION_ID,
ZOHO_WEBHOOK_SECRET, ZOHO_SYNC_ENABLED (default false), ZOHO_RATE_LIMIT_PER_MIN
(default 90).
```

```
2. Helpers for base URLs from ZOHO_DC: accounts https://accounts.zoho.<dc>,
Books API https://www.zohoapis.<dc>/books/v3
```

```
3. Tell me which values to fill in my real .env and pause until I confirm. If I
have no refresh token: Zoho API Console (api-console.zoho.<dc>) > Add Client >
Self Client > generate a grant code (10 min) with scopes:
ZohoBooks.contacts.ALL,ZohoBooks.invoices.ALL,ZohoBooks.estimates.ALL,ZohoBooks.
customerpayments.ALL,ZohoBooks.settings.READ
Provide the one-time script that exchanges it for a refresh token.
```

# `## Phase 3: OAuth token manager` 

- `One-time CLI script: grant code to refresh token.` 

- `getAccessToken(): caches the token, refreshes ~5 min before expiry, safe against concurrent refreshes.` 

- `Clear error/log when the refresh token is invalid or revoked.` 

- `Unit tests with mocked HTTP, plus a connection-test command that fetches organization details and prints OK/FAIL.` 

```
## Phase 4: Database migrations (additive only)
1. zoho_links: entity_type (customer/quotation/invoice/payment), crm_id,
zoho_id, zoho_last_modified, last_synced_at; unique on (entity_type, crm_id) and
(entity_type, zoho_id).
2. sync_log: id, direction (crm_to_zoho/zoho_to_crm), entity_type, crm_id,
zoho_id, action, request_payload, response_payload, status, error_message,
attempts, created_at.
```

```
3. sync_state: key, value (last polling timestamp per entity).
```

```
4. sync_queue only if no queue exists: id, job_type, payload, status, attempts,
next_run_at, last_error, created_at.
```

```
Add sync-status columns to existing tables only if truly needed, as nullable
columns.
```

```
## Phase 5: Zoho Books API client (integrations/zoho/client)
- Generic request function: auth header + organization_id, backoff retries on
429/5xx, one token refresh on 401, rate limiter.
- Methods: contacts (create, update, get, search by email/GSTIN), estimates,
invoices (create, update, get, list modified since), customer payments (create,
get, list modified since).
```

```
- Pagination (page, per_page=200), clear custom exceptions for Zoho error codes,
log every call to sync_log, tests with mocks.
## Phase 6: Mapping and GST
| CRM | Zoho Books |
|---|---|
| Customer | Contact (contact_type: customer) |
| Quotation | Estimate |
| Invoice + line items | Invoice |
| Payment received | Customer Payment (applied to invoice) |
- Include addresses, email, phone, currency, dates, invoice numbers.
- GST: GSTIN, gst_treatment, place_of_supply, HSN/SAC, tax rates, using the GST
fields my CRM already stores.
- Ownership: CRM owns customers and invoice creation. Zoho owns payment status
and tax calculation.
- Validate before sending (GSTIN format, required fields) with readable errors.
- Mappers are pure functions with unit tests. Put the final mapping table in the
docs.
## Phase 7: CRM to Zoho sync
1. Trigger background jobs from existing CRM events (customer created/updated,
quotation created, invoice created/updated, payment recorded).
2. Each job: load record, check zoho_links, create or update in Zoho, save
zoho_id, update sync status.
3. Before creating a contact, search Zoho by email and GSTIN to avoid
duplicates.
4. Order: customer, invoice, payment. If a dependency is not synced yet, wait
and retry.
5. Retry with backoff; after N attempts mark failed and store the error.
6. Respect ZOHO_SYNC_ENABLED (false = do nothing). Add tests.
```

```
## Phase 8: Zoho to CRM sync
1. POST /webhooks/zoho: verify ZOHO_WEBHOOK_SECRET (401 if wrong), reply 200
quickly, queue the real work, handle invoice updated and payment
created/updated.
```

```
2. Backup polling job every 10 minutes: fetch invoices, payments, contacts
modified since the last timestamp in sync_state; update payment status, balance
due, invoice number, paid date in the CRM. Save the new timestamp only after
success.
```

```
3. Never overwrite newer CRM data with older Zoho data (compare
zoho_last_modified).
```

```
4. Log everything to sync_log.
```

```
5. Document how I configure the webhook in Zoho Books (Settings > Automation >
Workflow Rules/Webhooks): URL, method, secret header.
```

```
## Phase 9: One-time initial migration command
```

```
- --dry-run: match CRM customers with Zoho contacts by email, phone, GSTIN;
output a CSV report (matched, unmatched, duplicates, conflicts); change nothing.
- --apply: create zoho_links for matches and create missing contacts in Zoho.
Optional flag for open invoices.
```

```
- Batch size and delay options, resume if interrupted.
```

```
Run the dry run against the sandbox only if credentials are available and show
me the report path.
```

```
## Phase 10: Admin screen "Zoho Sync"
```

```
Use existing UI components and permissions:
```

```
- Connection status, last successful sync time
```

- `Counters: pending, success, failed` 

- `Failed jobs table (error, entity, time) with Retry and Retry All` 

- `Per-record sync status on customer and invoice pages, with "Sync now" button` 

- `Admin-only toggle for ZOHO_SYNC_ENABLED` 

```
## Phase 11: Testing and security review
```

`1. Run all tests and fix failures.` 

```
2. Integration tests with mocked Zoho for: expired token, Zoho down, 429, bad
GSTIN, duplicate customer, webhook with wrong secret, payment for unknown
invoice.
```

`3. Security check: secrets never logged, webhook verified, no injection risks, sync_log never stores tokens.` 

`4. Find and fix anything that could create duplicate invoices or contacts.` 

`5. Write a step-by-step manual sandbox test checklist into the docs.` 

```
## Phase 12: Final documentation (docs/ZOHO_INTEGRATION.md)
```

```
A new developer must understand it in 30 minutes. Include:
```

`1. Overview and architecture diagram (mermaid)` 

`2. Project findings, folder structure, what each file does` 

`3. Environment variables (name, meaning, example, no real secrets)` 

`4. How to get and rotate Zoho credentials and generate the refresh token` 

`5. Mapping tables (CRM field to Zoho field) and GST notes` 

`6. Sync flows both directions (sequence diagrams)` 

`7. Database tables added` 

`8. How to run the queue worker, polling job, initial migration` 

`9. Webhook setup steps in Zoho` 

`10. Troubleshooting and how to retry failed syncs` 

`11. Manual sandbox test checklist` 

`12. Go-live checklist: switch to the production org, set ZOHO_SYNC_ENABLED=true, test 5-10 records first, watch sync_log and the admin page for a week, set up failure alerts` 

`13. Rollback plan: set ZOHO_SYNC_ENABLED=false` 

`14. List of assumptions and decisions made without asking me` 

```
## Final response format
```

`1. Short summary of what was built` 

`2. Files created or changed` 

`3. Exact commands to run (migrations, worker, polling, dry-run, tests)` 

`4. What I must still do manually (fill .env, configure the Zoho webhook, review the dry-run report, go-live)` 

`5. Risks or open questions` 

```
Start now with Phase 1.
```

