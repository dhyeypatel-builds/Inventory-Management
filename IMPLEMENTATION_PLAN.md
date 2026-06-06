# Tyre Inventory Management System — Implementation Plan for Claude Code

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-05-31 |
| **Companion doc** | [SRS_and_Technical_Design.md](SRS_and_Technical_Design.md) |
| **Scope** | Phase 1 (MVP). RBAC-ready, single ADMIN role. |

> **How to use this document:** Tasks are ordered for sequential execution. Each task is small, self-contained, and has explicit acceptance + testing criteria. Complete and verify a task before starting the next. Task IDs (e.g. `BE-03`) are stable references.

---

## Technology Stack (locked)

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, TanStack React Query, shadcn/ui, Tailwind CSS, React Router, React Hook Form + Zod |
| Backend | Node.js 22, Express, TypeScript, Prisma ORM, Zod, jsonwebtoken, argon2, Pino |
| Database | PostgreSQL 16 |
| Auth | JWT access tokens + rotating refresh tokens |
| Deployment | Docker, Docker Compose |
| Testing | Jest + Supertest (backend), Jest + React Testing Library (frontend) |

---

## 1. Complete Folder Structure

```
Inventory-Management/
├── docker-compose.yml
├── docker-compose.dev.yml
├── .env.example
├── .gitignore
├── README.md
├── package.json                      # root: workspaces + scripts
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.ts
│   ├── .env.example
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   └── src/
│       ├── index.ts                  # server bootstrap
│       ├── app.ts                    # express app (testable, no listen)
│       ├── config/
│       │   ├── env.ts                # zod-validated env
│       │   └── logger.ts
│       ├── db/
│       │   └── prisma.ts             # PrismaClient singleton
│       ├── middleware/
│       │   ├── auth.ts               # JWT verification
│       │   ├── rbac.ts               # requirePermission()
│       │   ├── validate.ts           # zod request validation
│       │   ├── audit.ts              # writes audit_logs
│       │   ├── error.ts              # central error handler
│       │   └── rateLimit.ts
│       ├── modules/
│       │   ├── auth/
│       │   │   ├── auth.routes.ts
│       │   │   ├── auth.controller.ts
│       │   │   ├── auth.service.ts
│       │   │   ├── auth.schema.ts
│       │   │   └── auth.test.ts
│       │   ├── catalog/              # product-types, attributes, brands, categories
│       │   ├── products/
│       │   ├── inventory/
│       │   ├── sales/
│       │   ├── customers/
│       │   ├── dashboard/
│       │   ├── reports/
│       │   ├── alerts/
│       │   └── settings/
│       ├── jobs/
│       │   └── alertEvaluation.ts
│       ├── utils/
│       │   ├── apiResponse.ts        # success/error envelope helpers
│       │   ├── errors.ts             # AppError, HttpError classes
│       │   └── pagination.ts
│       └── types/
│           └── express.d.ts          # req.user augmentation
│
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── jest.config.ts                # or vitest; spec uses Jest + RTL
    ├── index.html
    ├── tailwind.config.ts
    ├── components.json               # shadcn config
    └── src/
        ├── main.tsx
        ├── App.tsx                   # router + providers
        ├── app/
        │   ├── router.tsx
        │   ├── providers.tsx         # QueryClient, Auth, Theme
        │   └── layout/
        │       ├── AppShell.tsx
        │       ├── Sidebar.tsx
        │       └── Topbar.tsx
        ├── features/
        │   ├── auth/
        │   │   ├── api/  components/  hooks/  pages/  types.ts
        │   ├── dashboard/
        │   ├── products/
        │   ├── inventory/
        │   ├── sales/
        │   ├── customers/
        │   ├── reports/
        │   ├── alerts/
        │   └── settings/
        ├── shared/
        │   ├── ui/                   # shadcn components
        │   ├── api/
        │   │   ├── client.ts         # axios + interceptors (token refresh)
        │   │   └── queryClient.ts
        │   ├── lib/                  # currency(₹), date, cn()
        │   ├── hooks/
        │   └── types/
        └── test/
            └── setup.ts              # RTL + jest-dom
```

---

## 2. Database Schema (authoritative reference)

The full PostgreSQL DDL is in [SRS_and_Technical_Design.md §4.2](SRS_and_Technical_Design.md). It is the source of truth for the Prisma models below. Tables: `roles`, `permissions`, `role_permissions`, `users`, `refresh_tokens`, `brands`, `categories`, `product_types`, `attributes`, `attribute_options`, `products`, `product_variants`, `variant_attribute_values`, `inventory`, `stock_movements`, `customers`, `sales`, `sale_items`, `alerts`, `audit_logs`, `settings`.

Required Postgres extensions: `pgcrypto` (gen_random_uuid), `citext`, `pg_trgm`.

---

## 3. Prisma Models (`backend/prisma/schema.prisma`)

```prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum AttributeDatatype { TEXT NUMBER ENUM DATE BOOLEAN }
enum MovementType { OPENING SALE SALE_RETURN ADJUSTMENT PURCHASE TRANSFER DAMAGE }
enum SaleStatus { DRAFT CONFIRMED CANCELLED RETURNED }
enum AlertType { LOW_STOCK OUT_OF_STOCK }
enum AlertStatus { OPEN ACKNOWLEDGED RESOLVED }

model Role {
  id          Int    @id @default(autoincrement())
  name        String @unique
  description String?
  users       User[]
  permissions RolePermission[]
  @@map("roles")
}

model Permission {
  id    Int    @id @default(autoincrement())
  code  String @unique
  roles RolePermission[]
  @@map("permissions")
}

model RolePermission {
  roleId       Int
  permissionId Int
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)
  @@id([roleId, permissionId])
  @@map("role_permissions")
}

model User {
  id            String    @id @default(uuid())
  fullName      String    @map("full_name")
  email         String    @unique
  passwordHash  String    @map("password_hash")
  roleId        Int       @map("role_id")
  role          Role      @relation(fields: [roleId], references: [id])
  isActive      Boolean   @default(true) @map("is_active")
  lastLoginAt   DateTime? @map("last_login_at")
  failedLogins  Int       @default(0) @map("failed_logins")
  refreshTokens RefreshToken[]
  sales         Sale[]
  createdAt     DateTime  @default(now()) @map("created_at")
  updatedAt     DateTime  @updatedAt @map("updated_at")
  @@map("users")
}

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String    @map("user_id")
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  tokenHash String    @map("token_hash")
  expiresAt DateTime  @map("expires_at")
  revokedAt DateTime? @map("revoked_at")
  createdAt DateTime  @default(now()) @map("created_at")
  @@map("refresh_tokens")
}

model Brand {
  id        Int       @id @default(autoincrement())
  name      String    @unique
  logoUrl   String?   @map("logo_url")
  isActive  Boolean   @default(true) @map("is_active")
  products  Product[]
  createdAt DateTime  @default(now()) @map("created_at")
  deletedAt DateTime? @map("deleted_at")
  @@map("brands")
}

model Category {
  id        Int        @id @default(autoincrement())
  parentId  Int?       @map("parent_id")
  parent    Category?  @relation("CategoryTree", fields: [parentId], references: [id])
  children  Category[] @relation("CategoryTree")
  name      String
  slug      String     @unique
  isActive  Boolean    @default(true) @map("is_active")
  products  Product[]
  deletedAt DateTime?  @map("deleted_at")
  @@map("categories")
}

model ProductType {
  id          Int         @id @default(autoincrement())
  name        String      @unique
  isStockable Boolean     @default(true) @map("is_stockable")
  isActive    Boolean     @default(true) @map("is_active")
  attributes  Attribute[]
  products    Product[]
  @@map("product_types")
}

model Attribute {
  id                Int               @id @default(autoincrement())
  productTypeId     Int               @map("product_type_id")
  productType       ProductType       @relation(fields: [productTypeId], references: [id])
  code              String
  label             String
  datatype          AttributeDatatype
  isRequired        Boolean           @default(false) @map("is_required")
  isVariantDefining Boolean           @default(false) @map("is_variant_defining")
  displayOrder      Int               @default(0) @map("display_order")
  options           AttributeOption[]
  values            VariantAttributeValue[]
  @@unique([productTypeId, code])
  @@map("attributes")
}

model AttributeOption {
  id           Int       @id @default(autoincrement())
  attributeId  Int       @map("attribute_id")
  attribute    Attribute @relation(fields: [attributeId], references: [id], onDelete: Cascade)
  value        String
  displayOrder Int       @default(0) @map("display_order")
  values       VariantAttributeValue[]
  @@unique([attributeId, value])
  @@map("attribute_options")
}

model Product {
  id             String           @id @default(uuid())
  productTypeId  Int              @map("product_type_id")
  productType    ProductType      @relation(fields: [productTypeId], references: [id])
  categoryId     Int?             @map("category_id")
  category       Category?        @relation(fields: [categoryId], references: [id])
  brandId        Int?             @map("brand_id")
  brand          Brand?           @relation(fields: [brandId], references: [id])
  name           String
  description    String?
  warrantyMonths Int?             @map("warranty_months")
  isActive       Boolean          @default(true) @map("is_active")
  variants       ProductVariant[]
  createdAt      DateTime         @default(now()) @map("created_at")
  updatedAt      DateTime         @updatedAt @map("updated_at")
  deletedAt      DateTime?        @map("deleted_at")
  @@index([brandId])
  @@index([productTypeId])
  @@map("products")
}

model ProductVariant {
  id                String    @id @default(uuid())
  productId         String    @map("product_id")
  product           Product   @relation(fields: [productId], references: [id], onDelete: Cascade)
  sku               String    @unique
  manufacturingDate DateTime? @map("manufacturing_date")
  purchasePrice     Decimal   @default(0) @map("purchase_price") @db.Decimal(12,2)
  sellingPrice      Decimal   @default(0) @map("selling_price") @db.Decimal(12,2)
  taxRatePct        Decimal   @default(0) @map("tax_rate_pct") @db.Decimal(5,2)
  barcode           String?   @unique
  isActive          Boolean   @default(true) @map("is_active")
  attributeValues   VariantAttributeValue[]
  inventory         Inventory?
  movements         StockMovement[]
  saleItems         SaleItem[]
  alerts            Alert[]
  createdAt         DateTime  @default(now()) @map("created_at")
  deletedAt         DateTime? @map("deleted_at")
  @@map("product_variants")
}

model VariantAttributeValue {
  variantId   String          @map("variant_id")
  variant     ProductVariant  @relation(fields: [variantId], references: [id], onDelete: Cascade)
  attributeId Int             @map("attribute_id")
  attribute   Attribute       @relation(fields: [attributeId], references: [id])
  valueText   String?         @map("value_text")
  valueNumber Decimal?        @map("value_number") @db.Decimal(12,3)
  valueDate   DateTime?       @map("value_date")
  valueBool   Boolean?        @map("value_bool")
  optionId    Int?            @map("option_id")
  option      AttributeOption? @relation(fields: [optionId], references: [id])
  @@id([variantId, attributeId])
  @@index([attributeId, valueText])
  @@map("variant_attribute_values")
}

model Inventory {
  variantId    String         @id @map("variant_id")
  variant      ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  quantity     Int            @default(0)
  reorderLevel Int            @default(5) @map("reorder_level")
  rackLocation String?        @map("rack_location")
  updatedAt    DateTime       @updatedAt @map("updated_at")
  @@map("inventory")
}

model StockMovement {
  id            BigInt         @id @default(autoincrement())
  variantId     String         @map("variant_id")
  variant       ProductVariant @relation(fields: [variantId], references: [id])
  type          MovementType
  quantityDelta Int            @map("quantity_delta")
  balanceAfter  Int            @map("balance_after")
  referenceType String?        @map("reference_type")
  referenceId   String?        @map("reference_id")
  note          String?
  createdBy     String?        @map("created_by")
  createdAt     DateTime       @default(now()) @map("created_at")
  @@index([variantId, createdAt])
  @@map("stock_movements")
}

model Customer {
  id        String    @id @default(uuid())
  name      String
  phone     String?
  email     String?
  gstin     String?
  address   String?
  vehicleNo String?   @map("vehicle_no")
  notes     String?
  sales     Sale[]
  createdAt DateTime  @default(now()) @map("created_at")
  deletedAt DateTime? @map("deleted_at")
  @@index([phone])
  @@map("customers")
}

model Sale {
  id             String     @id @default(uuid())
  invoiceNo      String     @unique @map("invoice_no")
  customerId     String?    @map("customer_id")
  customer       Customer?  @relation(fields: [customerId], references: [id])
  status         SaleStatus @default(CONFIRMED)
  subtotal       Decimal    @default(0) @db.Decimal(12,2)
  discount       Decimal    @default(0) @db.Decimal(12,2)
  taxTotal       Decimal    @default(0) @map("tax_total") @db.Decimal(12,2)
  grandTotal     Decimal    @default(0) @map("grand_total") @db.Decimal(12,2)
  paymentMode    String?    @map("payment_mode")
  soldAt         DateTime   @default(now()) @map("sold_at")
  createdBy      String?    @map("created_by")
  createdByUser  User?      @relation(fields: [createdBy], references: [id])
  idempotencyKey String?    @unique @map("idempotency_key")
  items          SaleItem[]
  @@index([soldAt])
  @@index([customerId])
  @@map("sales")
}

model SaleItem {
  id          String         @id @default(uuid())
  saleId      String         @map("sale_id")
  sale        Sale           @relation(fields: [saleId], references: [id], onDelete: Cascade)
  variantId   String         @map("variant_id")
  variant     ProductVariant @relation(fields: [variantId], references: [id])
  description String
  quantity    Int
  unitPrice   Decimal        @map("unit_price") @db.Decimal(12,2)
  discount    Decimal        @default(0) @db.Decimal(12,2)
  taxRatePct  Decimal        @default(0) @map("tax_rate_pct") @db.Decimal(5,2)
  lineTotal   Decimal        @map("line_total") @db.Decimal(12,2)
  @@map("sale_items")
}

model Alert {
  id         String         @id @default(uuid())
  variantId  String         @map("variant_id")
  variant    ProductVariant @relation(fields: [variantId], references: [id])
  type       AlertType
  status     AlertStatus    @default(OPEN)
  message    String
  currentQty Int            @map("current_qty")
  threshold  Int
  createdAt  DateTime       @default(now()) @map("created_at")
  resolvedAt DateTime?      @map("resolved_at")
  @@unique([variantId, type, status])
  @@map("alerts")
}

model AuditLog {
  id         BigInt   @id @default(autoincrement())
  actorId    String?  @map("actor_id")
  action     String
  entityType String   @map("entity_type")
  entityId   String?  @map("entity_id")
  beforeData Json?    @map("before_data")
  afterData  Json?    @map("after_data")
  ipAddress  String?  @map("ip_address")
  userAgent  String?  @map("user_agent")
  createdAt  DateTime @default(now()) @map("created_at")
  @@index([entityType, entityId])
  @@index([actorId, createdAt])
  @@map("audit_logs")
}

model Setting {
  key       String   @id
  value     Json
  updatedAt DateTime @updatedAt @map("updated_at")
  @@map("settings")
}
```

---

## 4. Backend Modules (responsibilities)

| Module | Responsibility | Key endpoints |
|---|---|---|
| `auth` | Login, refresh rotation, logout, me, change-password | `/auth/*` |
| `catalog` | Product types, attributes, options, brands, categories | `/product-types`, `/brands`, `/categories` |
| `products` | Products + variants + attribute values, search | `/products`, `/variants` |
| `inventory` | On-hand, adjustments, movements ledger, valuation | `/inventory/*` |
| `sales` | Atomic billing, invoices, cancel/return | `/sales/*` |
| `customers` | Customer CRUD + history | `/customers/*` |
| `dashboard` | KPI summary, trends, top brands, fast-moving | `/dashboard/*` |
| `reports` | Sales, fast-moving, brands, low-stock, valuation, tax, export | `/reports/*` |
| `alerts` | List, acknowledge, evaluation job | `/alerts/*` |
| `settings` | Company/tax/threshold config + attribute master data | `/settings` |

Each module = `routes → controller → service → (prisma)`, with `schema.ts` (Zod) and `*.test.ts`.

---

## 5. Frontend Modules (feature folders)

| Feature | Pages | Key components/hooks |
|---|---|---|
| `auth` | Login | `useAuth`, `LoginForm`, token refresh interceptor |
| `dashboard` | Dashboard | KPI cards, `SalesTrendChart`, `TopBrands`, `LowStockList` |
| `products` | List, Create/Edit | `DynamicAttributeForm` (schema-driven), `VariantEditor`, `ProductTable` |
| `inventory` | List | `AdjustStockDialog`, `MovementLedgerDrawer`, valuation summary |
| `sales` | POS, History, Invoice | `Cart`, `ItemSearch`, `CustomerPicker`, `InvoiceView` |
| `customers` | List, Profile | `CustomerForm`, `PurchaseHistory` |
| `reports` | Reports | `ReportSelector`, `DateRangePicker`, export buttons |
| `alerts` | Stock Alerts | `AlertList`, acknowledge action |
| `settings` | Settings | `CompanyForm`, `TaxSettings`, attribute master data editors |

---

## 6. API Contracts (summary)

Full specs in [SRS §6](SRS_and_Technical_Design.md). Conventions:
- Base path `/api/v1`. Bearer JWT on all non-auth routes.
- Success: `{ "success": true, "data": ..., "meta"?: {...} }`
- Error: `{ "success": false, "error": { "code", "message", "details"? } }`
- Pagination `?page=&pageSize=`; filter/sort/search per resource.
- Key contracts implemented in tasks: login/refresh (BE-04), products+variants (BE-08), inventory adjust + movements (BE-09), sales atomic create + 409 INSUFFICIENT_STOCK + idempotency (BE-10), dashboard/reports (BE-12/13).

---

## 7. Validation Rules (Zod, shared mental model)

| Entity | Rules |
|---|---|
| Login | `email` valid email; `password` ≥ 8 chars |
| Brand | `name` 1–80, unique |
| Product | `productTypeId` exists; `name` 1–160; `warrantyMonths` int ≥ 0; brand/category optional FK |
| Variant | `sku` matches `^[A-Z0-9-]{3,60}$`, unique; `purchasePrice`/`sellingPrice` ≥ 0; `sellingPrice` ≥ 0; `taxRatePct` 0–100; `attributes` must satisfy product-type's required attributes; ENUM values must be allowed options |
| Inventory adjust | `delta` non-zero int; resulting qty ≥ 0; `reason` required |
| Sale | ≥ 1 item; each `quantity` > 0; `variantId` exists & active; total discount ≤ subtotal; `paymentMode` ∈ {CASH,CARD,UPI} |
| Customer | `name` 1–120; `phone` optional E.164-ish; `email` optional valid; `gstin` optional 15-char pattern |
| Settings | keyed JSON; `tax.default_pct` 0–100; `inventory.default_reorder_level` int ≥ 0 |

Validation is enforced by the `validate(schema)` middleware on `body`/`query`/`params`. Frontend reuses equivalent Zod schemas with React Hook Form.

---

## 8. Development Tasks

> Legend — each task: **Objective · Files to create · Files to modify · Acceptance criteria · Testing requirements.**

### EPIC A — Project Foundation

---

#### A-01 · Monorepo scaffolding & tooling
- **Objective:** Initialize root workspace, git, editorconfig, and shared scripts.
- **Create:** `package.json` (root, npm workspaces: `backend`, `frontend`), `.gitignore`, `.editorconfig`, `README.md`, `.env.example`.
- **Modify:** —
- **Acceptance:** `npm install` at root installs both workspaces; `git status` clean ignores `node_modules`, `dist`, `.env`.
- **Testing:** `npm run` lists root scripts; CI lint placeholder passes.

#### A-02 · Docker & Compose for Postgres + services
- **Objective:** Containerize dev environment.
- **Create:** `docker-compose.yml` (postgres 16, backend, frontend), `docker-compose.dev.yml`, `backend/Dockerfile`, `frontend/Dockerfile`.
- **Modify:** `.env.example` (DATABASE_URL, JWT secrets, ports).
- **Acceptance:** `docker compose up postgres` starts a healthy Postgres with `pgcrypto`, `citext`, `pg_trgm` available; backend connects.
- **Testing:** Health check: `docker compose ps` shows postgres healthy; `psql` lists extensions.

#### A-03 · Backend TypeScript app skeleton
- **Objective:** Express app boots with config, logger, error handler, health route.
- **Create:** `backend/package.json`, `backend/tsconfig.json`, `backend/src/index.ts`, `backend/src/app.ts`, `backend/src/config/env.ts`, `backend/src/config/logger.ts`, `backend/src/middleware/error.ts`, `backend/src/utils/apiResponse.ts`, `backend/src/utils/errors.ts`.
- **Modify:** —
- **Acceptance:** `npm run dev` starts server; `GET /api/v1/health` → `{ success:true, data:{ status:"ok" } }`; invalid env aborts startup with clear message.
- **Testing:** Jest + Supertest: health returns 200; unknown route returns 404 envelope.

#### A-04 · Prisma setup & full schema
- **Objective:** Wire Prisma, create the complete schema and initial migration.
- **Create:** `backend/prisma/schema.prisma` (from §3), `backend/src/db/prisma.ts`.
- **Modify:** `backend/package.json` (prisma scripts).
- **Acceptance:** `npx prisma migrate dev --name init` creates all 21 tables; `npx prisma generate` produces client; `prisma.ts` exports a singleton.
- **Testing:** Integration test connects, runs a trivial `prisma.role.count()` against a test DB.

#### A-05 · Seed script (master data + admin)
- **Objective:** Seed roles/permissions, ADMIN user, brands, Car Tyre product type with attributes/options, default settings.
- **Create:** `backend/prisma/seed.ts`.
- **Modify:** `backend/package.json` (`prisma.seed`).
- **Acceptance:** `npx prisma db seed` creates ADMIN role with all permissions, one admin user (from env), 6 brands, product type "Car Tyre" with attributes (size, tyre_type, vehicle_type, position, terrain, pattern) + options from SRS §10.1. Idempotent (re-runnable).
- **Testing:** Test asserts seed counts and that admin can be found by email.

---

### EPIC B — Authentication & Cross-Cutting

---

#### B-01 · Auth utilities (hashing, JWT, token store)
- **Objective:** Password hashing (argon2id) and JWT access/refresh helpers.
- **Create:** `backend/src/modules/auth/auth.service.ts` (partial: hash, verify, signAccess, signRefresh, rotateRefresh), `backend/src/modules/auth/auth.schema.ts`.
- **Modify:** `backend/src/config/env.ts` (JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, TTLs).
- **Acceptance:** Access token expires 15m, refresh 7d; refresh tokens stored hashed; rotation revokes prior token; reuse of revoked token detected.
- **Testing:** Unit tests for hash round-trip, token sign/verify, rotation revokes old, reuse detection throws.

#### B-02 · Auth middleware + RBAC + req.user typing
- **Objective:** Protect routes and enforce permissions.
- **Create:** `backend/src/middleware/auth.ts`, `backend/src/middleware/rbac.ts`, `backend/src/types/express.d.ts`.
- **Modify:** `backend/src/app.ts` (mount nothing yet; wiring ready).
- **Acceptance:** Missing/invalid token → 401; valid token populates `req.user` with `{id, role, permissions}`; `requirePermission('x')` → 403 when lacking.
- **Testing:** Supertest: protected stub route returns 401 without token, 403 without permission, 200 with both.

#### B-03 · Validation & audit middleware
- **Objective:** Generic Zod validation and audit logging.
- **Create:** `backend/src/middleware/validate.ts`, `backend/src/middleware/audit.ts`, `backend/src/middleware/rateLimit.ts`, `backend/src/utils/pagination.ts`.
- **Modify:** `backend/src/app.ts` (apply rate limit + base middleware).
- **Acceptance:** `validate({body,query,params})` returns 400 with field details; audit middleware writes `audit_logs` with before/after on mutating routes; auth routes rate-limited.
- **Testing:** Unit: validate rejects bad payload; integration: a mutation creates one audit_log row with correct action/entity.

#### B-04 · Auth endpoints
- **Objective:** Implement `/auth/login|refresh|logout|me|change-password`.
- **Create:** `backend/src/modules/auth/auth.routes.ts`, `backend/src/modules/auth/auth.controller.ts`, `backend/src/modules/auth/auth.test.ts`.
- **Modify:** `backend/src/app.ts` (mount `/api/v1/auth`), `auth.service.ts` (complete).
- **Acceptance:** Login returns token pair + user/permissions; refresh rotates; logout revokes; `/me` returns current user; 5 failed logins locks per env policy; passwords never returned.
- **Testing:** Supertest happy + failure paths: wrong password 401, lockout after N, refresh rotation works, reused refresh rejected.

---

### EPIC C — Catalog & Products

---

#### C-01 · Brands & Categories CRUD
- **Objective:** Manage brands and category tree.
- **Create:** `backend/src/modules/catalog/brands.{routes,controller,service,schema}.ts`, `categories.*`, `catalog.test.ts`.
- **Modify:** `backend/src/app.ts` (mount routes).
- **Acceptance:** CRUD with soft-delete; unique brand name; category tree (parent/children) returned; permission-gated.
- **Testing:** Supertest CRUD; duplicate name → 409; soft-deleted excluded from list.

#### C-02 · Product Types & Attributes (schema endpoints)
- **Objective:** Expose product types and their attribute schema (drives dynamic forms).
- **Create:** `backend/src/modules/catalog/productTypes.{routes,controller,service,schema}.ts`.
- **Modify:** `backend/src/app.ts`.
- **Acceptance:** `GET /product-types` lists types; `GET /product-types/:id/attributes` returns attributes with datatype, required, variant-defining, and ENUM options ordered by displayOrder.
- **Testing:** Supertest returns Car Tyre attribute schema matching seed.

#### C-03 · Products CRUD + variant creation
- **Objective:** Create/read/update products with variants and EAV attribute values.
- **Create:** `backend/src/modules/products/products.{routes,controller,service,schema}.ts`, `products.test.ts`.
- **Modify:** `backend/src/app.ts`.
- **Acceptance:** `POST /products` (with optional first variant) validates required attributes & ENUM options, generates/validates SKU, creates Product+Variant+attribute values+opening Inventory+OPENING stock movement in one transaction; `GET /products/:id` returns variants with resolved attribute values; soft-delete supported.
- **Testing:** Integration: create matches SRS §5.3 example; missing required attribute → 400; invalid ENUM value → 400; duplicate SKU → 409; opening stock creates movement + inventory row.

#### C-04 · Variant search endpoint
- **Objective:** Fast variant lookup for the sales screen.
- **Create:** `backend/src/modules/products/variants.controller.ts` (search), schema additions.
- **Modify:** `products.routes.ts`.
- **Acceptance:** `GET /variants?q=&size=&inStock=true` returns variants with name, attributes, price, on-hand; trigram search on product name; paginated.
- **Testing:** Supertest: search by partial name and by size filter returns expected variants; `inStock=true` excludes zero-qty.

---

### EPIC D — Inventory & Movements

---

#### D-01 · Inventory list & detail & settings
- **Objective:** Read on-hand, reorder level, rack; update reorder/rack.
- **Create:** `backend/src/modules/inventory/inventory.{routes,controller,service,schema}.ts`, `inventory.test.ts`.
- **Modify:** `backend/src/app.ts`.
- **Acceptance:** `GET /inventory?lowStock=true&q=&rack=` lists with on-hand vs threshold; `PATCH /inventory/:variantId` updates reorderLevel/rackLocation.
- **Testing:** Supertest: lowStock filter returns only at/below threshold; patch persists.

#### D-02 · Stock adjustment + movement ledger
- **Objective:** Adjust stock with reason; expose movement history.
- **Create:** —
- **Modify:** `inventory.service.ts`, `inventory.controller.ts`, `inventory.routes.ts`.
- **Acceptance:** `POST /inventory/:variantId/adjust {delta,reason,note}` writes ADJUSTMENT movement, updates cached quantity in one transaction, rejects if result < 0 (409); `GET /inventory/:variantId/movements` returns ledger ordered by date with `balanceAfter`.
- **Testing:** Integration: positive/negative adjust updates qty & ledger; negative beyond stock → 409; ledger `balanceAfter` matches running sum.

#### D-03 · Stock valuation
- **Objective:** Aggregate stock value.
- **Create:** —
- **Modify:** `inventory.controller.ts`, `inventory.routes.ts`.
- **Acceptance:** `GET /inventory/valuation` returns total and breakdown by brand/category (qty × purchasePrice).
- **Testing:** Supertest asserts computed totals against seeded data.

---

### EPIC E — Customers & Sales

---

#### E-01 · Customers CRUD + history
- **Objective:** Manage customers and view purchase history.
- **Create:** `backend/src/modules/customers/customers.{routes,controller,service,schema}.ts`, `customers.test.ts`.
- **Modify:** `backend/src/app.ts`.
- **Acceptance:** CRUD with soft-delete; search by name/phone; `GET /customers/:id` includes recent sales.
- **Testing:** Supertest CRUD + search; history reflects created sales.

#### E-02 · Sales creation (atomic) + invoice numbering
- **Objective:** The core transactional flow.
- **Create:** `backend/src/modules/sales/sales.{routes,controller,service,schema}.ts`, `sales.test.ts`.
- **Modify:** `backend/src/app.ts`.
- **Acceptance:** `POST /sales` in a serializable transaction: validates stock, decrements inventory, writes SALE movements, creates Sale + SaleItems (price/description snapshots), computes subtotal/tax/discount/grandTotal, generates sequential `invoiceNo` (`INV-YYYY-NNNNNN`), honors `Idempotency-Key` (duplicate returns the same sale); insufficient stock → 409 `INSUFFICIENT_STOCK` with details and full rollback.
- **Testing:** Integration: successful sale deducts stock & writes movements; concurrent oversell prevented; idempotency key returns identical invoice; totals math verified; rollback leaves stock unchanged on failure.

#### E-03 · Sales list/detail, cancel, return, invoice
- **Objective:** Manage existing sales.
- **Create:** —
- **Modify:** `sales.service.ts`, `sales.controller.ts`, `sales.routes.ts`.
- **Acceptance:** `GET /sales` (filters: date/customer), `GET /sales/:id`; `POST /sales/:id/cancel` and `/return` restock via SALE_RETURN movements and set status; `GET /sales/:id/invoice` returns printable payload.
- **Testing:** Integration: cancel restocks and writes return movements; double-cancel rejected; return partial quantity restocks correct amount.

---

### EPIC F — Alerts, Dashboard, Reports, Settings

---

#### F-01 · Alert evaluation + endpoints
- **Objective:** Low/out-of-stock detection and management.
- **Create:** `backend/src/modules/alerts/alerts.{routes,controller,service,schema}.ts`, `backend/src/jobs/alertEvaluation.ts`, `alerts.test.ts`.
- **Modify:** `inventory.service.ts` & `sales.service.ts` (trigger re-evaluation after movements), `backend/src/app.ts`.
- **Acceptance:** After any movement, variants at/below reorder level get an OPEN `LOW_STOCK` (or `OUT_OF_STOCK` at 0) alert; unique constraint prevents duplicate OPEN; `GET /alerts?status=OPEN` lists; `POST /alerts/:id/acknowledge` works; restock resolves alert.
- **Testing:** Integration: selling to threshold creates alert; restock above threshold resolves it; no duplicate OPEN alerts.

#### F-02 · Dashboard endpoints
- **Objective:** KPI summary and widgets.
- **Create:** `backend/src/modules/dashboard/dashboard.{routes,controller,service}.ts`, `dashboard.test.ts`.
- **Modify:** `backend/src/app.ts`.
- **Acceptance:** `/dashboard/summary` (today & MTD sales count/revenue, total SKUs, stock value, open alerts), `/sales-trend?range`, `/top-brands`, `/fast-moving`.
- **Testing:** Supertest asserts KPIs against seeded sales.

#### F-03 · Reports + export
- **Objective:** Analytical reports with CSV/PDF export.
- **Create:** `backend/src/modules/reports/reports.{routes,controller,service}.ts`, `reports.test.ts`.
- **Modify:** `backend/src/app.ts`.
- **Acceptance:** `/reports/sales|fast-moving|best-selling-brands|low-stock|stock-valuation|tax` with date filters; `/reports/:name/export?format=csv|pdf` streams a file.
- **Testing:** Supertest: each report returns expected aggregates; CSV export has correct headers/rows.

#### F-04 · Settings endpoints
- **Objective:** Read/update keyed settings + attribute master data.
- **Create:** `backend/src/modules/settings/settings.{routes,controller,service,schema}.ts`, `settings.test.ts`.
- **Modify:** `backend/src/app.ts`.
- **Acceptance:** `GET /settings` returns all; `PATCH /settings` validates and upserts (tax %, default reorder level, company profile).
- **Testing:** Supertest: patch persists & validates ranges (tax 0–100).

---

### EPIC G — Frontend Foundation

---

#### G-01 · Vite + React 19 + TS + Tailwind + shadcn setup
- **Objective:** Bootstrap frontend app shell.
- **Create:** `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/index.html`, `frontend/tailwind.config.ts`, `frontend/components.json`, `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/shared/lib/cn.ts`.
- **Modify:** —
- **Acceptance:** `npm run dev` serves app; Tailwind classes apply; one shadcn component (Button) renders.
- **Testing:** RTL: App renders without crashing; Button renders with label.

#### G-02 · API client, React Query, providers, router
- **Objective:** Networking, caching, routing, global providers.
- **Create:** `frontend/src/shared/api/client.ts` (axios + auth/refresh interceptors), `frontend/src/shared/api/queryClient.ts`, `frontend/src/app/providers.tsx`, `frontend/src/app/router.tsx`, `frontend/src/app/layout/{AppShell,Sidebar,Topbar}.tsx`, `frontend/test/setup.ts`, `frontend/jest.config.ts`.
- **Modify:** `frontend/src/App.tsx`, `frontend/src/main.tsx`.
- **Acceptance:** 401 triggers silent refresh then retry; refresh failure redirects to login; protected routes guard via auth state; AppShell renders sidebar nav for all MVP screens.
- **Testing:** RTL: unauthenticated visit to `/` redirects to `/login`; interceptor refresh logic unit-tested with mocked axios.

#### G-03 · Auth feature (Login + useAuth)
- **Objective:** Login flow and session state.
- **Create:** `frontend/src/features/auth/{api,hooks,components,pages}/*`, `types.ts`, `LoginForm.test.tsx`.
- **Modify:** `router.tsx`, `providers.tsx`.
- **Acceptance:** Login form validates (Zod + RHF), calls `/auth/login`, stores tokens, populates user, redirects to dashboard; logout clears session.
- **Testing:** RTL: invalid email shows error; successful login (mocked) redirects; failed login shows server error.

---

### EPIC H — Frontend Features

---

#### H-01 · Dashboard screen
- **Objective:** KPI cards + charts + low-stock list.
- **Create:** `frontend/src/features/dashboard/*` (page, hooks using React Query, `SalesTrendChart`, `KpiCard`, `LowStockList`).
- **Modify:** `router.tsx`, `Sidebar.tsx`.
- **Acceptance:** Renders KPIs from `/dashboard/summary`; chart from trend; loading/empty/error states.
- **Testing:** RTL with mocked queries: KPIs render; loading skeleton shows; error state shows retry.

#### H-02 · Product Management (list + dynamic form)
- **Objective:** Product list and schema-driven create/edit.
- **Create:** `frontend/src/features/products/*` (`ProductTable`, `ProductForm`, `DynamicAttributeForm`, `VariantEditor`, hooks).
- **Modify:** `router.tsx`, `Sidebar.tsx`.
- **Acceptance:** List with filters (brand/type/size, search); create form fetches attribute schema by product type and renders fields by datatype (ENUM→select, NUMBER→number, DATE→date); submits to `/products`; SKU auto-suggested; validation mirrors backend.
- **Testing:** RTL: selecting product type renders correct attribute fields; required attribute blocks submit; successful create (mocked) shows toast and updates list.

#### H-03 · Inventory Management screen
- **Objective:** Stock table, adjust dialog, movement ledger.
- **Create:** `frontend/src/features/inventory/*` (`InventoryTable`, `AdjustStockDialog`, `MovementLedgerDrawer`, hooks).
- **Modify:** `router.tsx`, `Sidebar.tsx`.
- **Acceptance:** Table shows on-hand/threshold/rack with low-stock highlight + filter; adjust dialog posts to adjust endpoint and refetches; ledger drawer lists movements.
- **Testing:** RTL: adjust submits delta+reason; low-stock filter narrows rows; ledger renders movements.

#### H-04 · Sales (POS) screen + invoice
- **Objective:** Counter billing flow.
- **Create:** `frontend/src/features/sales/*` (`PosPage`, `ItemSearch`, `Cart`, `CustomerPicker`, `InvoiceView`, `SalesHistory`, hooks).
- **Modify:** `router.tsx`, `Sidebar.tsx`.
- **Acceptance:** Search adds items to cart; qty/discount edit recomputes totals (subtotal/tax/grand); customer optional; confirm posts to `/sales` with Idempotency-Key; insufficient-stock 409 shows inline error; success shows printable invoice; history list with filters.
- **Testing:** RTL: cart math correct; confirm calls API once even on double-click (idempotency); 409 surfaces error; invoice renders totals.

#### H-05 · Customers screen
- **Objective:** Customer list and profile.
- **Create:** `frontend/src/features/customers/*` (`CustomerTable`, `CustomerForm`, `PurchaseHistory`, hooks).
- **Modify:** `router.tsx`, `Sidebar.tsx`.
- **Acceptance:** List/search; create/edit with validation; profile shows purchase history.
- **Testing:** RTL: create validates name; search filters; profile renders history (mocked).

#### H-06 · Reports & Alerts screens
- **Objective:** Reports with export and stock alerts management.
- **Create:** `frontend/src/features/reports/*` (`ReportSelector`, `DateRangePicker`, table/chart, export buttons), `frontend/src/features/alerts/*` (`AlertList`).
- **Modify:** `router.tsx`, `Sidebar.tsx`.
- **Acceptance:** Selecting report + range fetches & renders table/chart; export triggers file download; alerts list with acknowledge action.
- **Testing:** RTL: report renders rows; export button calls export endpoint; acknowledge updates alert state.

#### H-07 · Settings screen
- **Objective:** Company/tax/threshold config + attribute master data.
- **Create:** `frontend/src/features/settings/*` (`CompanyForm`, `TaxSettings`, `ReorderSettings`, attribute/option editors).
- **Modify:** `router.tsx`, `Sidebar.tsx`.
- **Acceptance:** Loads `/settings`, edits persist via `PATCH`; tax % range-validated; brands/categories manageable.
- **Testing:** RTL: save persists (mocked); invalid tax % blocked.

---

### EPIC I — Integration, Quality, Deployment

---

#### I-01 · Responsive layout & tablet POS polish
- **Objective:** Desktop sidebar → tablet drawer → mobile bottom-nav; touch-friendly POS.
- **Create:** —
- **Modify:** `AppShell.tsx`, `Sidebar.tsx`, sales components.
- **Acceptance:** Layout adapts at sm/md/lg breakpoints; POS usable on tablet; ₹ currency + dd-MMM-yyyy dates app-wide.
- **Testing:** RTL: nav renders correct variant at mocked breakpoints; currency formatter unit tests.

#### I-02 · End-to-end smoke flow
- **Objective:** Verify the full path: login → create product+stock → sell → alert → report.
- **Create:** `backend/src/__tests__/e2e.smoke.test.ts` (Supertest against test DB).
- **Modify:** —
- **Acceptance:** Scripted flow passes: auth, product create with opening stock, sale deducts stock & creates invoice, low-stock alert raised, sales report reflects the sale.
- **Testing:** The smoke test itself; runs in CI against ephemeral Postgres.

#### I-03 · Production Docker Compose & docs
- **Objective:** One-command run + onboarding docs.
- **Create:** `README.md` run/setup section, `.env.example` complete.
- **Modify:** `docker-compose.yml` (prod profile: build images, migrate on start, serve frontend via Nginx).
- **Acceptance:** `docker compose up` brings up Postgres + migrated backend + frontend; seeded admin can log in end-to-end in a browser.
- **Testing:** Manual verification checklist in README; CI builds both images successfully.

#### I-04 · CI pipeline
- **Objective:** Automated lint, typecheck, test on push.
- **Create:** `.github/workflows/ci.yml`.
- **Modify:** root `package.json` scripts.
- **Acceptance:** CI runs backend (Jest+Supertest w/ Postgres service) and frontend (Jest+RTL), typecheck, lint; fails on any error.
- **Testing:** CI green on a clean checkout.

---

## Execution Order Summary

```
A-01 → A-02 → A-03 → A-04 → A-05            (foundation)
B-01 → B-02 → B-03 → B-04                    (auth + cross-cutting)
C-01 → C-02 → C-03 → C-04                    (catalog + products)
D-01 → D-02 → D-03                           (inventory)
E-01 → E-02 → E-03                           (customers + sales)
F-01 → F-02 → F-03 → F-04                    (alerts/dashboard/reports/settings)
G-01 → G-02 → G-03                           (frontend foundation)
H-01 → H-02 → H-03 → H-04 → H-05 → H-06 → H-07   (frontend features)
I-01 → I-02 → I-03 → I-04                     (integration, deploy, CI)
```

**Definition of Done (per task):** code compiles & typechecks, tests written and passing, acceptance criteria demonstrably met, no lint errors, audit logging present on mutations.

---

*End of implementation plan.*
