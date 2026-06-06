# TyreStock — Phase 2B Implementation Plan: Master-Admin Console

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-06-06 |
| **Companion docs** | [2A — Multi-tenancy](IMPLEMENTATION_PLAN_PHASE2A.md), [2C — Auth & onboarding](IMPLEMENTATION_PLAN_PHASE2C.md), [2D — Reports](IMPLEMENTATION_PLAN_PHASE2D.md) |
| **Depends on** | Phase 2A complete (tenant model, scoping extension, `platform_admins` table, ALS context with `impersonatingTenantId`). |
| **Scope** | The control plane **you** use to provision and manage tenant shops. Independently shippable: provisioning hands over a copy-able invite link; email delivery of that link is wired later in 2C. |

> **How to use this document:** Same conventions as the MVP plan — each task has **Objective · Files · Acceptance · Testing**. Task IDs (`Y-02`) are stable references.

---

## 1. Shape

- Platform admins authenticate on a **separate path** (`/api/v1/platform/auth/*`) and receive a token with `platform: true` and **no** `tenantId`. The 2A scoping extension treats this as "bypass" unless an impersonation target is pinned.
- The admin UI is a **separate route tree** (`admin.tyrestock.app` in prod, `/admin` in dev) guarded by platform auth — never mixed into a tenant's app shell.
- **Provisioning never sets a password for the owner.** It creates the tenant + owner `User` record + an `Invite` token (2A/2C `invites` table). The admin copies the resulting invite link to hand over. In 2C this same link is emailed automatically.
- **Impersonation** issues a short-lived platform token carrying `impersonatingTenantId`; the ALS context pins that tenant so the admin sees exactly what the shop sees. Every impersonation start/stop is written to the platform audit log.

---

## 2. Schema changes (`backend/prisma/schema.prisma`)

Most tables already exist from 2A. Add:

```prisma
// Invite for a tenant owner or staff member. Email delivery is 2C; the token works now.
model Invite {
  id         String    @id @default(uuid())
  tenantId   String    @map("tenant_id")
  tenant     Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  email      String    @db.Citext
  roleId     Int       @map("role_id")
  role       Role      @relation(fields: [roleId], references: [id])
  token      String    @unique               // random, hashed at rest in a real build
  expiresAt  DateTime  @map("expires_at")
  acceptedAt DateTime? @map("accepted_at")
  invitedBy  String?   @map("invited_by")     // platform admin or tenant user id
  createdAt  DateTime  @default(now()) @map("created_at")
  @@index([tenantId])
  @@map("invites")
}

// Platform-level audit (separate from per-tenant audit_logs).
model PlatformAuditLog {
  id         BigInt   @id @default(autoincrement())
  actorId    String?  @map("actor_id")        // platform admin id
  action     String                            // PROVISION_TENANT, SUSPEND_TENANT, IMPERSONATE_START, ...
  tenantId   String?  @map("tenant_id")
  metadata   Json?
  ipAddress  String?  @map("ip_address")
  createdAt  DateTime @default(now()) @map("created_at")
  @@index([tenantId, createdAt])
  @@map("platform_audit_logs")
}
```

`Tenant` gains a forward-looking `plan` field now so monetization isn't another migration later (see 2A §6):

```prisma
  plan String @default("standard")   // placeholder for future billing tiers
```

---

## 3. Development Tasks

### EPIC X — Platform authentication

#### X-01 · Platform login service
- **Objective:** Email + password login for platform admins (the only method until 2C adds Google/OTP for them too), reusing the argon2 + JWT primitives from `auth.service.ts`. Issues a token with `{ sub, platform: true }`.
- **Files create:** `backend/src/modules/platform/platform-auth.service.ts`, `platform-auth.controller.ts`, `platform-auth.routes.ts`, `platform-auth.schema.ts`.
- **Files modify:** `backend/src/app.ts` (mount `/api/v1/platform`).
- **Acceptance:** Valid platform credentials return a token pair; the access token carries `platform: true` and no `tenantId`; wrong password → 401; lockout policy applies.
- **Testing:** Supertest: login happy/fail; token payload asserted; a tenant user's credentials are rejected on the platform path and vice-versa.

#### X-02 · Platform auth guard + context
- **Objective:** Middleware that verifies a platform token, sets the ALS context to platform (bypass) mode, and rejects tenant tokens. A `requirePlatform` guard for platform routes.
- **Files create:** `backend/src/middleware/platform-auth.ts`.
- **Files modify:** ALS context helpers from 2A `tenancy/context.ts` if needed.
- **Acceptance:** Platform routes return 401 for missing/tenant tokens; valid platform token enters bypass context; impersonation tokens pin the target tenant.
- **Testing:** Supertest against a stub platform route: tenant token → 401, platform token → 200, impersonation token → scoped reads of the target tenant only.

### EPIC Y — Tenant lifecycle management

#### Y-01 · Tenant list + detail with usage metrics
- **Objective:** `GET /platform/tenants` (paginated, filter by status, search by name/slug) and `GET /platform/tenants/:id` returning usage: SKU count, customer count, sales count (30d), last activity, onboarding status.
- **Files create:** `backend/src/modules/platform/tenants.service.ts`, `tenants.controller.ts`, `tenants.routes.ts`.
- **Note:** Usage aggregates are **raw SQL across tenants** — these run in platform/bypass context **intentionally** and must NOT carry a tenant filter (the inverse of 2A U-03; document clearly so a later reviewer doesn't "fix" them).
- **Acceptance:** List returns all tenants with metrics; detail returns one tenant's usage; suspended tenants flagged.
- **Testing:** Seed two tenants with differing data; assert metrics are correct and per-tenant.

#### Y-02 · Provision tenant
- **Objective:** `POST /platform/tenants` creates a `Tenant` (ACTIVE), seeds its defaults (settings row, default brand list, links to global product types), creates the owner `User` (no password), and creates an `Invite`. Returns the invite link.
- **Files modify:** `backend/src/modules/platform/tenants.service.ts`; reuse the per-tenant seed logic from 2A T-04.
- **Acceptance:** One call yields a usable tenant + owner + invite link; the new tenant is isolated (2A guarantees); re-running with the same slug → 409.
- **Testing:** Integration: provision → owner user exists with the owner role, default settings present, invite token valid and unexpired, tenant passes an isolation smoke check.

#### Y-03 · Suspend / reactivate
- **Objective:** `POST /platform/tenants/:id/suspend` and `/reactivate`. Suspend flips status to `SUSPENDED` **and revokes the tenant's active refresh tokens** (kills live sessions — 2A §6 item).
- **Files modify:** `tenants.service.ts`; reuse `revokeAllRefreshTokens` pattern scoped to the tenant's users.
- **Acceptance:** Suspended tenant's users cannot log in (403 `TENANT_SUSPENDED` from 2A V-01) and existing sessions stop working on next request; reactivate restores access.
- **Testing:** Integration: a logged-in tenant user is locked out after suspend; reactivate restores; both actions write a `PlatformAuditLog` row.

#### Y-04 · Impersonation ("view as tenant")
- **Objective:** `POST /platform/tenants/:id/impersonate` issues a short-lived token with `platform: true` + `impersonatingTenantId`. A matching "stop" clears it. Both audited.
- **Files modify:** `platform-auth.service.ts`, `tenants.service.ts`.
- **Acceptance:** While impersonating, all reads/writes are scoped to the target tenant; the token is short-lived (e.g. 30 min); start and stop write `IMPERSONATE_START` / `IMPERSONATE_STOP` audit rows.
- **Testing:** Integration: impersonation token reads only the target tenant's data; expiry enforced; audit rows present.

#### Y-05 · Platform audit log
- **Objective:** Write `PlatformAuditLog` on every platform mutation (provision, suspend, reactivate, impersonate). `GET /platform/audit` lists them.
- **Files modify:** a small `platform-audit` helper; wire into Y-02/Y-03/Y-04.
- **Acceptance:** Each platform mutation produces exactly one audit row with actor, action, tenant, ip.
- **Testing:** Integration asserts one row per action with correct fields.

### EPIC Z — Master-admin frontend

#### Z-01 · Admin app shell + routing
- **Objective:** A separate admin route tree + shell (distinct visual treatment from the tenant app so it's unmistakable), guarded by platform auth, with its own login page.
- **Files create:** `frontend/src/admin/` (shell, router, platform auth provider, api client).
- **Files modify:** app bootstrap to mount the admin tree under `/admin` (dev) / host-based in prod.
- **Acceptance:** Visiting `/admin` unauthenticated → platform login; authenticated → admin shell; tenant users can't reach it.
- **Testing:** RTL: guard redirects unauthenticated; renders shell when authenticated.

#### Z-02 · Tenant list + provisioning UI
- **Objective:** Tenant table (status, usage, last activity, search/filter) + a provisioning form that returns and lets you copy the invite link.
- **Files create:** `frontend/src/admin/features/tenants/`.
- **Acceptance:** List paginates and filters; provisioning shows the copy-able invite link on success; validation errors surfaced.
- **Testing:** RTL: list renders mocked tenants; provisioning success reveals the link; invalid input blocked. Design pass with the `impeccable` skill on the admin surface.

#### Z-03 · Tenant detail + suspend / impersonate
- **Objective:** Tenant detail view with usage, suspend/reactivate controls (confirm dialog), and an "Open as this shop" impersonation action.
- **Files create:** `frontend/src/admin/features/tenants/TenantDetailPage.tsx`.
- **Acceptance:** Suspend/reactivate reflect immediately; impersonation opens the tenant app in impersonation context with a persistent "viewing as <shop>" banner + exit.
- **Testing:** RTL: actions call the right endpoints; impersonation banner shows and exit clears it.

---

## 4. Definition of Done (Phase 2B)
- You can provision, list, inspect, suspend/reactivate, and impersonate tenants entirely from the admin console.
- Provisioning produces a usable, isolated tenant with a copy-able invite link (email delivery deferred to 2C).
- Suspending a tenant kills its live sessions; reactivating restores them.
- Every platform mutation is audited; cross-tenant usage metrics are correct.
- Platform auth is fully separated from tenant auth; neither token works on the other's routes.

## 5. Out of scope for 2B
- Emailing the invite link, and the owner's accept/onboarding experience → 2C.
- Google/OTP for platform admins → 2C (password-only here).
- Billing UI — `Tenant.plan` exists as a placeholder only.
