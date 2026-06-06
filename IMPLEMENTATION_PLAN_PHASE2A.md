# TyreStock — Phase 2A Implementation Plan: Multi-Tenancy Foundation

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-06-06 |
| **Companion docs** | [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) (Phase 1 MVP), [SRS_and_Technical_Design.md](SRS_and_Technical_Design.md) |
| **Scope** | Phase 2A only — convert the single-tenant MVP into a row-level multi-tenant platform. No new end-user features; everything keeps working as a "default tenant." |
| **Unlocks** | Phase 2B (master-admin console), 2C (Google + OTP auth, onboarding), 2D (reports revamp). |

> **How to use this document:** Same conventions as the MVP plan. Tasks are ordered for sequential execution, each with **Objective · Files · Acceptance · Testing**. Task IDs (e.g. `T-02`) are stable references. Complete and verify a task before starting the next. This phase is backend-heavy and migration-sensitive — **take a database backup before EPIC T runs against any real data.**

---

## 1. Tenancy model (the decisions, fixed)

- **Strategy:** shared database, shared schema, **row-level `tenant_id`**. One Postgres, one set of tables.
- **Enforcement:** a single Prisma client extension auto-injects `tenant_id` on every query against a scoped model, reading the current tenant from an `AsyncLocalStorage` context set per request. Individual services never hand-write `tenant_id` filters (except raw SQL — see the warning below).
- **Master admin:** a separate `platform_admins` table with its own auth path. Platform tokens carry `platform: true` and **bypass** tenant scoping (or pin a specific tenant when impersonating).

### Scoped vs. global

| Tenant-scoped (gets `tenant_id`) | Platform-global (shared by all tenants) |
|---|---|
| `users`, `refresh_tokens` (via user), `brands`, `categories`, `products`, `product_variants`, `variant_attribute_values` (via variant), `inventory`, `stock_movements`, `customers`, `sales`, `sale_items`, `alerts`, `audit_logs`, `settings` | `roles`, `permissions`, `role_permissions`, `product_types`, `attributes`, `attribute_options`, `tenants`, `platform_admins` |

EAV catalog templates (`product_types` / `attributes` / `attribute_options`) stay global and shared — a "Car Tyre" type with `size`/`tyre_type` is universal. Per-tenant custom types are a later phase. `brands` and `categories` become **per-tenant** because each shop curates its own list.

> ### ⚠️ Critical: the scoping extension does NOT intercept `$queryRaw`.
> Three services use raw SQL that the client extension **cannot** rewrite — they pass straight through with **no tenant filter**:
> - [`reports.service.ts`](backend/src/modules/reports/reports.service.ts) — all six reports + summaries.
> - [`dashboard.service.ts`](backend/src/modules/dashboard/dashboard.service.ts) — the KPI cards, sales trend, top brands.
> - [`inventory.service.ts`](backend/src/modules/inventory/inventory.service.ts) — low-stock / search queries.
>
> Every raw query must gain an explicit `AND <table>.tenant_id = ${tenantId}` predicate by hand, or one shop will see another's data on the dashboard and in every report. Tracked as **U-03** — the single highest-risk item in the phase.

---

## 2. Schema changes (`backend/prisma/schema.prisma`)

### 2.1 New models & enum

```prisma
enum TenantStatus { ACTIVE SUSPENDED }

model Tenant {
  id                   String       @id @default(uuid())
  name                 String                              // shop name
  slug                 String       @unique                // url-safe identifier
  status               TenantStatus @default(ACTIVE)
  onboardingCompletedAt DateTime?   @map("onboarding_completed_at")
  createdAt            DateTime     @default(now()) @map("created_at")
  updatedAt            DateTime     @updatedAt @map("updated_at")
  // back-relations added on each scoped model
  @@map("tenants")
}

// Master admin — lives outside all tenants. Separate auth path.
model PlatformAdmin {
  id           String    @id @default(uuid())
  fullName     String    @map("full_name")
  email        String    @unique @db.Citext
  passwordHash String?   @map("password_hash")   // nullable: Google/OTP added in 2C
  isActive     Boolean   @default(true) @map("is_active")
  lastLoginAt  DateTime? @map("last_login_at")
  createdAt    DateTime  @default(now()) @map("created_at")
  @@map("platform_admins")
}

// Per-tenant invoice counter (deterministic, lock-friendly).
model TenantCounter {
  tenantId String @map("tenant_id")
  scope    String                        // e.g. 'invoice:2026'
  value    Int    @default(0)
  @@id([tenantId, scope])
  @@map("tenant_counters")
}
```

### 2.2 Scoped models — add to each

```prisma
  tenantId String @map("tenant_id")
  tenant   Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId])
```

### 2.3 Unique-constraint rewrites (these collide across tenants)

| Model | Was | Becomes |
|---|---|---|
| `ProductVariant.sku` | `@unique` | `@@unique([tenantId, sku])` |
| `ProductVariant.barcode` | `@unique` | `@@unique([tenantId, barcode])` |
| `Brand.name` | `@unique` | `@@unique([tenantId, name])` |
| `Category.slug` | `@unique` | `@@unique([tenantId, slug])` |
| `Sale.invoiceNo` | `@unique` | `@@unique([tenantId, invoiceNo])` |
| `Sale.idempotencyKey` | `@unique` | `@@unique([tenantId, idempotencyKey])` |
| `Alert` | `@@unique([variantId, type])` | unchanged (variant already tenant-bound) + add `tenantId` column |
| `Setting.key` | `@id` | `@@id([tenantId, key])` |
| `User.email` | `@unique` | **stays globally unique** — one email = one login identity |

> **Soft-delete + unique interaction:** composite uniques like `[tenantId, sku]` will block re-creating a SKU after a soft-delete (`deletedAt` set). The MVP already has this latent issue on `sku @unique`. Where it matters, use a **partial unique index** (`... WHERE deleted_at IS NULL`) in the hand-written migration. Decide per-constraint in T-02.

---

## 3. Development Tasks

> Legend — each task: **Objective · Files to create · Files to modify · Acceptance · Testing.** Backup first.

### EPIC T — Tenancy data model & migration

#### T-01 · Tenant, PlatformAdmin, TenantCounter models
- **Objective:** Add the three new models + `TenantStatus` enum to the schema with back-relations stubbed.
- **Files modify:** `backend/prisma/schema.prisma`.
- **Acceptance:** `npx prisma validate` passes; `npx prisma generate` produces the new client types.
- **Testing:** Type-check compiles; a trivial `prisma.tenant.count()` runs against the test DB.

#### T-02 · Add `tenant_id` to scoped models + composite uniques
- **Objective:** Add the `tenant_id` column, relation, and index to all 13 scoped models; rewrite the unique constraints per §2.3; convert `Setting` to a composite PK.
- **Files modify:** `backend/prisma/schema.prisma`.
- **Acceptance:** `prisma validate` passes; the diff shows every scoped model carrying `tenant_id` + `@@index([tenantId])`; no globally-unique constraint remains on tenant-scoped columns.
- **Testing:** Schema review checklist (the §2.1 table) — every scoped table present, no omissions.

#### T-03 · Hand-written migration: structure + backfill
- **Objective:** A safe, multi-step SQL migration (not Prisma's destructive auto-gen — follow the UK-localisation rename precedent).
- **Files create:** `backend/prisma/migrations/<ts>_multitenancy/migration.sql`.
- **Steps (in one migration):**
  1. Create `tenants`, `platform_admins`, `tenant_counters`, `TenantStatus`.
  2. Insert one **default tenant** (fixed UUID, `slug = 'default'`, name from existing `settings['company.name']` if present).
  3. For each scoped table: `ADD COLUMN tenant_id UUID` (nullable).
  4. Backfill `UPDATE <table> SET tenant_id = '<default-uuid>'`.
  5. `ALTER COLUMN tenant_id SET NOT NULL`, add FK `ON DELETE CASCADE`, add index.
  6. Drop old unique constraints; add composite uniques (partial `WHERE deleted_at IS NULL` where T-02 flagged).
  7. Migrate `settings` PK from `(key)` to `(tenant_id, key)`; backfill `tenant_id`.
  8. Seed `tenant_counters` for the default tenant's current invoice year from `MAX(invoice_no)`.
- **Acceptance:** `prisma migrate deploy` applies cleanly on a **copy** of real data; all existing rows belong to the default tenant; row counts unchanged; existing app behaviour identical when the default tenant is the active context.
- **Testing:** Run against dev DB **and** test DB. Assert: `SELECT COUNT(*) FROM products WHERE tenant_id IS NULL` = 0 for every scoped table; existing sales/invoices still resolve.

#### T-04 · Seed rework: platform admin + default tenant
- **Objective:** Seed now creates a platform admin (from env) and the default tenant; existing brand/admin seed becomes tenant-scoped to the default tenant. Keep idempotent.
- **Files modify:** `backend/prisma/seed.ts`, `backend/.env.example` (add `PLATFORM_ADMIN_EMAIL`/`PASSWORD`).
- **Acceptance:** `npx prisma db seed` is re-runnable; creates one platform admin, one default tenant, and seeds that tenant's brands/admin user/settings.
- **Testing:** Assert seed counts; platform admin found by email; default tenant's brands scoped correctly.

---

### EPIC U — Tenant context & enforcement

#### U-01 · AsyncLocalStorage tenant context
- **Objective:** A request-scoped context holding `{ tenantId | null, platform: boolean, impersonatingTenantId? }`, with helpers `runWithTenant(ctx, fn)` and `currentTenant()`.
- **Files create:** `backend/src/tenancy/context.ts`.
- **Files modify:** `backend/src/middleware/auth.ts` (enter the context after token verify).
- **Acceptance:** Within a request, `currentTenant()` returns the caller's tenant; outside a request it throws (fail-closed).
- **Testing:** Unit: two concurrent `runWithTenant` calls never leak context into each other (the classic ALS footgun).

#### U-02 · Prisma client extension — auto-scoping
- **Objective:** `prisma.$extends({ query })` that, for every scoped model, injects `where.tenantId = currentTenant()` on reads/updates/deletes and `data.tenantId` on creates. Platform context bypasses; impersonation pins the target tenant.
- **Files create:** `backend/src/tenancy/scoped-prisma.ts`.
- **Files modify:** `backend/src/db/prisma.ts` (export the extended client).
- **Acceptance:** A `findMany` issued in tenant A's context returns only A's rows; a `create` without an explicit `tenantId` still persists with A's id; a query with **no** tenant context (and not platform) throws rather than returning all rows.
- **Testing:** Integration: seed two tenants, assert each model's list/get/update/delete is scoped; assert fail-closed on missing context.

#### U-03 · ⚠️ Tenant-scope all raw SQL
- **Objective:** Add an explicit `AND <table>.tenant_id = ${tenantId}` predicate (sourced from `currentTenant()`) to every raw query in the three confirmed services. Verify completeness with `grep -rn "queryRaw\|executeRaw" backend/src`.
- **Files modify:** `backend/src/modules/reports/reports.service.ts` (six reports + summary queries), `backend/src/modules/dashboard/dashboard.service.ts` (KPIs, trend, top brands), `backend/src/modules/inventory/inventory.service.ts` (low-stock / search).
- **Acceptance:** Every raw query filters by tenant; both the dashboard and all six reports run in tenant A's context exclude tenant B's data entirely.
- **Testing:** Integration: two tenants with distinct sales/stock; each tenant's dashboard KPIs and sales/tax/valuation report totals match only its own data. **This test is the security gate for the phase.**

#### U-04 · Per-tenant invoice sequencing
- **Objective:** Replace the global invoice sequence with a per-tenant counter via `tenant_counters` (scope `invoice:<year>`), incremented under a row lock inside the sale transaction.
- **Files modify:** `backend/src/modules/sales/sales.service.ts`.
- **Acceptance:** Two tenants both start at `INV-2026-000001`; numbers are gap-free and unique per tenant; concurrent sales in one tenant never collide (existing idempotency + `SELECT ... FOR UPDATE` on the counter row).
- **Testing:** Integration: concurrent sales in the same tenant produce sequential numbers; the same number can exist in two different tenants.

#### U-05 · Cross-tenant isolation test suite
- **Objective:** A dedicated suite proving no scoped model or report leaks across tenants.
- **Files create:** `backend/src/__tests__/tenant-isolation.test.ts`.
- **Acceptance:** Seeds tenants A and B, exercises products/inventory/customers/sales/alerts/settings + all six reports, asserting strict isolation both directions; asserts a suspended tenant cannot authenticate.
- **Testing:** Suite is green and is wired into CI as a required check.

---

### EPIC V — Auth & settings carry tenant

#### V-01 · Login resolves tenant; JWT carries `tenantId`
- **Objective:** `login()` resolves the user's tenant, blocks login when the tenant is `SUSPENDED`, and embeds `tenantId` in the access token. Refresh-token rotation preserves it.
- **Files modify:** `backend/src/modules/auth/auth.service.ts`, `auth.schema.ts`.
- **Acceptance:** Access token payload includes `tenantId`; suspended-tenant login → 403 `TENANT_SUSPENDED`; refresh keeps the same tenant.
- **Testing:** Supertest: login of a tenant user yields a tenant-scoped token; suspended tenant rejected; refresh round-trip preserves `tenantId`.

#### V-02 · `req.user` / context population from token
- **Objective:** `authenticate` reads `tenantId` (and `platform`) from the token and enters the U-01 context before any handler runs.
- **Files modify:** `backend/src/middleware/auth.ts`, the Express `Request` type augmentation.
- **Acceptance:** Every authenticated handler runs inside the correct tenant context; platform tokens enter platform context.
- **Testing:** Supertest against a stub route: tenant token → scoped reads; platform token → unscoped.

#### V-03 · Settings service → per-tenant
- **Objective:** Rework settings read/write for the composite `(tenant_id, key)` PK so each shop has independent settings (company name, VAT number, tax default, logo URL).
- **Files modify:** `backend/src/modules/settings/settings.service.ts`, `settings.schema.ts`.
- **Acceptance:** Two tenants store independent values for the same key; reads return only the caller's tenant's settings.
- **Testing:** Integration: set `company.name` differently in A and B; each reads back its own.

---

### EPIC W — Test migration & operational hardening

#### W-01 · Migrate existing integration tests to a tenant context
- **Objective:** Update every backend integration test (`sales.test`, `sales-manage.test`, products/inventory/customers/etc.) to provision/use a tenant in setup and run inside its context.
- **Files modify:** all `backend/src/**/*.test.ts` with DB setup; a shared `backend/src/__tests__/helpers/tenant.ts`.
- **Acceptance:** Full backend suite green under the new scoping.
- **Testing:** `npm test` in `backend/` passes end to end.

#### W-02 · Config, secrets, and `.env.example`
- **Objective:** Document the growing secret surface and any new env (platform admin creds now; placeholders noted for 2C Google/email).
- **Files modify:** `backend/.env.example`, `backend/src/config/env.ts`.
- **Acceptance:** Invalid/missing required env aborts startup with a clear message; `.env.example` lists every key.
- **Testing:** Boot with a missing required var → clean failure.

#### W-03 · Tenant-aware logging
- **Objective:** Include `tenantId` (or `platform`) in the Pino request logger so production logs are debuggable per shop.
- **Files modify:** `backend/src/config/logger.ts`, request-logging middleware.
- **Acceptance:** Each request log line carries the tenant identifier.
- **Testing:** Manual log inspection in dev; a unit asserting the field is attached.

---

## 4. Definition of Done (Phase 2A)

- Existing app runs unchanged as the **default tenant**; no end-user-visible regression.
- A second tenant can be created (via seed/script) and is **provably isolated** — U-05 green, including all six reports (U-03).
- Suspended tenants cannot authenticate.
- Invoice numbers are per-tenant and gap-free under concurrency.
- Full backend test suite green; cross-tenant isolation is a required CI check.
- Migration verified on a copy of real data with zero orphaned (`tenant_id IS NULL`) rows.

---

## 5. Out of scope for 2A (handled later)

- Master-admin **UI** and provisioning flow → Phase 2B.
- Google/OTP login, invites, onboarding wizard, email infra → Phase 2C.
- Branded PDF / XLSX / charts → Phase 2D (note: branded PDF depends on per-tenant settings + logo from V-03 and the logo-upload prerequisite below).
- Frontend tenant-awareness beyond not breaking — the SPA still assumes the default tenant until 2C.

---

## 6. Cross-cutting prerequisites & debt to sort before the next phase

Things outside the feature list that will bite if not handled. Grouped by when they must be resolved.

### Sort before / during 2A
- **Backup + dry-run the migration.** T-03 backfills real customer/sales data. Run it against a restored copy first; keep a rollback snapshot. Irreversible if rushed.
- **Raw-SQL leak surface (U-03).** Confirmed in three services — `reports`, `dashboard`, `inventory`. The dashboard is the sneaky one: its KPIs are raw SQL and would silently show cross-tenant totals. This is the security gate.
- **AsyncLocalStorage context leakage.** Under load, a mis-wired ALS context can bleed one request's tenant into another (cross-tenant data served to the wrong shop). Needs the concurrency test in U-01, not just a happy-path check.
- **Soft-delete vs. composite uniques.** `[tenantId, sku]` blocks recreating a SKU after soft-delete. Decide per-constraint whether to use a partial unique index (`WHERE deleted_at IS NULL`). The MVP already has this latent on `sku @unique`.
- **Session kill on tenant suspend.** Suspending a tenant must also revoke its users' active refresh tokens, or existing sessions keep working until token expiry.

### Sort before 2C (auth) / 2D (reports)
- **Transactional email is a hard dependency with lead time.** OTP and invites both need it. Beyond signing up for a provider (Resend/Postmark/SES), a **sending domain with SPF + DKIM + DMARC DNS records** is required or codes land in spam. Provision the domain early.
- **Logo upload + object storage does not exist.** `logoUrl` is a column with no upload path — no multer, no S3, nothing. The onboarding wizard (2C) and branded PDF (2D) both need real file upload + storage (local disk for dev, S3/R2 for prod). Decide the storage backend before those phases.
- **Token storage is `localStorage` (XSS-exposed).** Tokens live in `localStorage` (`frontend/src/shared/api/client.ts`, `providers.tsx`). OAuth/OTP redirect flows are a natural moment to move refresh tokens to **httpOnly cookies**. Worth deciding before reworking auth in 2C rather than after.
- **OTP needs per-identity rate limiting.** The current limiter (`rateLimit.ts`) is per-IP only (`max: 10/min`). OTP request/verify needs **per-email** throttling + lockout too, or it's a code-spray / email-bomb vector.
- **Google OAuth = external config + lead time.** A Google Cloud OAuth client (ID/secret, authorized redirect URIs per environment) must be provisioned; the consent screen may need verification for production.

### Decide consciously (not necessarily build now)
- **Commercial model.** You provision tenants — is there billing/subscription? Not building it now, but `Tenant.status` should anticipate a `plan`/trial state so a later add isn't another migration.
- **UK data protection (GDPR).** `customers` holds personal data (name, phone, email, vehicle reg) and you're now a processor across multiple shops. A per-tenant data export + delete capability and a basic processing stance will be expected. Note it; don't let it surprise you at sales time.
- **Frontend is entirely single-tenant today.** API client, routing, and auth context assume one global app. 2C carries the bulk of this rework — budget for it.
