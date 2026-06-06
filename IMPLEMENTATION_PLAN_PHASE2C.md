# TyreStock — Phase 2C Implementation Plan: Modern Auth & Onboarding

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-06-06 |
| **Companion docs** | [2A — Multi-tenancy](IMPLEMENTATION_PLAN_PHASE2A.md), [2B — Master-admin](IMPLEMENTATION_PLAN_PHASE2B.md), [2D — Reports](IMPLEMENTATION_PLAN_PHASE2D.md) |
| **Depends on** | 2A (tenancy, auth carries tenantId) + 2B (provisioning creates `Invite` records). |
| **Scope** | Replace password login with **Google sign-in + Email OTP** (passwordless), deliver invites by email, and give a freshly provisioned shop a polished first-run onboarding wizard. |

> **How to use this document:** Each task has **Objective · Files · Acceptance · Testing**. Task IDs (`OA-01`) are stable references. EPIC ST and EM are prerequisites — do them first.

---

## 1. Shape & hard dependencies

- **Passwordless.** End-user login is Google OAuth **or** Email OTP. `passwordHash` stays nullable (migration safety / platform-admin fallback) but no tenant-user password UI ships.
- **You provision; no self-serve signup.** Unknown emails are rejected at login — there is no auto-tenant-creation. An email only works if it belongs to a provisioned user or an open invite.
- **Two external dependencies with lead time** (flagged in 2A §6 — resolve before coding the auth tasks):
  1. **Transactional email provider** (Resend / Postmark / SES) **+ a sending domain with SPF, DKIM, DMARC**. Without verified DNS, OTP/invite mail lands in spam.
  2. **Google Cloud OAuth client** (client id/secret, authorized redirect URIs per environment; production may need consent-screen verification).
- **Token storage hardening.** Move the refresh token from `localStorage` (current, XSS-exposed) to an **httpOnly, Secure, SameSite cookie**; the access token stays in memory. OAuth/OTP redirect flows are the moment to do this.

---

## 2. Schema changes (`backend/prisma/schema.prisma`)

```prisma
// One-time login codes (email OTP). Code stored hashed; never plaintext.
model OtpCode {
  id        String    @id @default(uuid())
  email     String    @db.Citext
  codeHash  String    @map("code_hash")
  expiresAt DateTime  @map("expires_at")
  attempts  Int       @default(0)
  consumedAt DateTime? @map("consumed_at")
  createdAt DateTime  @default(now()) @map("created_at")
  @@index([email, createdAt])
  @@map("otp_codes")
}

// Federated identity link (Google now; extensible to others).
model AuthIdentity {
  id         String   @id @default(uuid())
  userId     String?  @map("user_id")          // tenant user
  adminId    String?  @map("admin_id")          // or platform admin
  provider   String                              // 'google'
  providerId String   @map("provider_id")        // Google 'sub'
  email      String   @db.Citext
  createdAt  DateTime @default(now()) @map("created_at")
  @@unique([provider, providerId])
  @@map("auth_identities")
}
```

`User` gains nullable identity back-relations; `Invite` (from 2B) is reused for accept. No destructive change.

---

## 3. Development Tasks

### EPIC ST — File storage (prerequisite for logo upload)

#### ST-01 · Storage abstraction + upload endpoint
- **Objective:** A storage interface with a **local-disk transport (dev)** and an **S3/R2 transport (prod)**, plus a validated, size-limited image upload endpoint. Needed by the onboarding logo step (ON-02) and the branded PDF (2D).
- **Files create:** `backend/src/storage/` (interface + transports), `backend/src/modules/uploads/` (multer, mime/size validation, returns a stored URL).
- **Files modify:** `backend/.env.example` (storage config), `backend/Dockerfile` (writable volume for local transport).
- **Acceptance:** Upload an image → stored, returns a URL that resolves; non-image or oversized → 400; the URL is tenant-scoped.
- **Testing:** Integration: upload + fetch round-trip; rejects bad mime/size.

### EPIC EM — Email infrastructure

#### EM-01 · Email provider abstraction
- **Objective:** An `EmailSender` interface with a **dev transport (console/file)** and a **prod transport** (Resend/Postmark/SES). Config-driven, fail-soft logging.
- **Files create:** `backend/src/email/` (interface + transports + a `send()` facade).
- **Files modify:** `backend/.env.example`, `backend/src/config/env.ts`.
- **Acceptance:** In dev, sending logs the rendered message; in prod config, it calls the provider; missing required config aborts startup.
- **Testing:** Unit: dev transport captures messages; facade selects transport by env.

#### EM-02 · Templated emails (OTP, invite, welcome)
- **Objective:** Three responsive HTML email templates with plaintext fallbacks: OTP code, tenant/staff invite, post-onboarding welcome. Per-tenant branding (shop name) where relevant.
- **Files create:** `backend/src/email/templates/`.
- **Acceptance:** Each template renders with injected data; links/codes correct; passes a basic email-client sanity check.
- **Testing:** Unit: template renders expected fields; snapshot of HTML + text parts.

### EPIC OA — OTP & Google authentication

#### OA-01 · Email OTP request/verify
- **Objective:** `POST /auth/otp/request` (generate 6-digit code, hash + store with ~10-min TTL, email it) and `POST /auth/otp/verify` (validate, consume, issue token pair). **Per-email** rate limiting + attempt lockout on top of the existing per-IP limiter (2A §6 — the limiter is per-IP only today).
- **Files create:** `backend/src/modules/auth/otp.service.ts`; routes/controller/schema additions.
- **Files modify:** `backend/src/middleware/rateLimit.ts` (per-email key for OTP).
- **Acceptance:** Valid code within TTL → token pair; expired/wrong/replayed code → 400; >N requests per email/window → 429; unknown email → generic 200 (no account enumeration) but no code issued.
- **Testing:** Integration: happy path; expiry; wrong code increments attempts then locks; rate limit triggers; enumeration-safe response.

#### OA-02 · Google OAuth (authorization code flow)
- **Objective:** `GET /auth/google` (redirect to Google) and `GET /auth/google/callback` (exchange code, verify `id_token`, resolve email → user/admin via `AuthIdentity` or first-time link, issue token pair). State/PKCE for CSRF safety.
- **Files create:** `backend/src/modules/auth/google.service.ts`; routes/controller additions.
- **Files modify:** `backend/src/config/env.ts` (Google client id/secret/redirect).
- **Acceptance:** A provisioned user's Google email logs in and links an `AuthIdentity`; an unknown email is rejected (no tenant created); state mismatch → 400.
- **Testing:** Integration with a mocked Google token endpoint: known email → tokens + identity row; unknown → 401; state/PKCE enforced.

#### OA-03 · Unified identity resolution + suspended-tenant block
- **Objective:** A single resolver used by OTP and Google: email → (tenant user | platform admin | open invite). Suspended tenant → 403 `TENANT_SUSPENDED`. Inactive user → 401.
- **Files modify:** `backend/src/modules/auth/auth.service.ts` (shared resolver), both OTP and Google services call it.
- **Acceptance:** All login methods enforce the same tenant/active checks; an open invite resolves into the accept flow (IN-01) rather than a normal login.
- **Testing:** Integration matrix across {OTP, Google} × {active user, suspended tenant, inactive user, open invite, unknown}.

#### OA-04 · Refresh-token cookie hardening
- **Objective:** Issue the refresh token as an **httpOnly + Secure + SameSite=Lax** cookie; `/auth/refresh` reads it from the cookie; logout clears it. Access token returned in the body (memory-only on the client).
- **Files modify:** `auth.controller.ts`, refresh/logout handlers, CORS config (credentials).
- **Acceptance:** Refresh works without the client ever touching the refresh token in JS; logout clears the cookie; rotation/reuse-detection (2A) still holds.
- **Testing:** Supertest: cookie set on login; refresh succeeds via cookie; logout clears; reuse still detected.

### EPIC IN — Invites & provisioning completion

#### IN-01 · Invite accept flow
- **Objective:** `GET /auth/invite/:token` (validate, return tenant + email) and accept: the invitee proves email ownership and chooses Google-link or OTP, after which the invite is marked accepted and a session issued.
- **Files create:** `backend/src/modules/auth/invite.service.ts`.
- **Acceptance:** Valid unexpired token → accept → user active + session; expired/used token → 410; email must match.
- **Testing:** Integration: accept via OTP and via Google; expired/used rejected.

#### IN-02 · Wire provisioning to send the invite email
- **Objective:** Connect 2B `Y-02` provisioning to EM-02 so the owner invite is emailed automatically (the copy-able link remains as a fallback).
- **Files modify:** `backend/src/modules/platform/tenants.service.ts`.
- **Acceptance:** Provisioning a tenant sends a branded invite email to the owner; failures are logged without rolling back tenant creation.
- **Testing:** Integration: provision triggers one captured email to the owner with a working link.

#### IN-03 · Staff invites (tenant owner → staff)
- **Objective:** A tenant owner can invite staff to their **own** tenant with a role; reuses `Invite` + IN-01. Permission-gated; tenant-scoped.
- **Files create:** `backend/src/modules/team/` (invite list/create/revoke), routes.
- **Acceptance:** Owner invites staff in their tenant only; invited staff accept and appear scoped to that tenant; cross-tenant invite impossible.
- **Testing:** Integration: owner-scoped invite + accept; cross-tenant attempt blocked; isolation holds.

### EPIC ON — Onboarding wizard

#### ON-01 · Onboarding state + gating
- **Objective:** Use `Tenant.onboardingCompletedAt` (2A) to gate: a tenant whose onboarding is incomplete is routed to the wizard on login; completing it sets the timestamp.
- **Files modify:** auth `getMe`/session payload to expose onboarding state; frontend routing guard.
- **Acceptance:** Incomplete tenant → wizard; complete tenant → dashboard; state survives reload.
- **Testing:** Integration/RTL: gating both directions.

#### ON-02 · Wizard UI
- **Objective:** A guided multi-step first-run flow: (1) confirm shop details + **logo upload** (ST-01) + VAT number, (2) tax defaults, (3) pick starter brands from a suggested UK list, (4) add first product or skip / CSV import, (5) invite staff (IN-03) or skip, (6) finish. Save-as-you-go; resumable.
- **Files create:** `frontend/src/features/onboarding/`.
- **Acceptance:** Each step persists; back/forward works; skipping optional steps allowed; finishing lands on a non-empty dashboard.
- **Testing:** RTL per step; full-flow happy path; design pass with the `impeccable onboard` command.

#### ON-03 · Empty states + optional demo seed
- **Objective:** First-class empty states across dashboard/inventory/sales/customers for a brand-new tenant, plus an optional "load demo data" action (per-tenant demo seeder) so an evaluating owner sees a populated app.
- **Files create:** `backend/src/modules/tenants/demo-seed.service.ts`; empty-state components.
- **Acceptance:** New tenant shows guidance, not broken/blank screens; demo seed populates that tenant only and is reversible/clearable.
- **Testing:** RTL empty states; integration: demo seed is tenant-scoped and isolated.

### EPIC FA — Frontend auth rework

#### FA-01 · New login UI (Google + OTP)
- **Objective:** Replace the password form with a "Continue with Google" button and an email→OTP flow (enter email, then enter the 6-digit code). No password field.
- **Files modify:** `frontend/src/features/auth/` (LoginPage, new OTP step), remove password form.
- **Acceptance:** Both methods complete a login; clear error/resend states for OTP; accessible and responsive; matches the Light Industrial system.
- **Testing:** RTL: Google button initiates flow; OTP request→verify happy/fail; design pass.

#### FA-02 · Redirect + cookie session handling
- **Objective:** Handle the OAuth redirect return and OTP success: store access token in memory, rely on the httpOnly refresh cookie (OA-04), and bootstrap the session.
- **Files modify:** `frontend/src/shared/api/client.ts`, `frontend/src/app/providers.tsx` (drop refresh-token localStorage; keep access token in memory; silent refresh on load).
- **Acceptance:** Reload keeps the user logged in via cookie refresh; no refresh token in `localStorage`; logout clears everything.
- **Testing:** RTL/integration: session survives reload; logout clears; no token in storage.

#### FA-03 · Tenant-aware app context
- **Objective:** Expose the current tenant (name, logo, settings) in the SPA so headers, invoices, and the PDF reflect the shop; ensure all API calls carry the tenant token.
- **Files modify:** `frontend/src/app/providers.tsx`, app shell header.
- **Acceptance:** The shop's name/logo appear in-app; switching tenant (re-login/impersonate) updates context cleanly.
- **Testing:** RTL: context renders tenant identity; impersonation banner integrates (2B Z-03).

---

## 4. Definition of Done (Phase 2C)
- Tenant users log in with Google or Email OTP only; no password UI; unknown emails rejected.
- Provisioning (2B) emails a working invite; owners accept and are dropped into onboarding.
- A new shop completes a polished wizard (incl. logo upload) and lands on a populated dashboard.
- Refresh tokens are httpOnly cookies; nothing sensitive in `localStorage`.
- Suspended-tenant and inactive-user blocks hold across every login method.

## 5. Out of scope for 2C
- Passkeys/WebAuthn (possible future add).
- Self-serve signup / billing.
- Reports redesign → 2D (depends on ST-01 storage + tenant logo from this phase).
