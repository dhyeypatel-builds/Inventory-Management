# Tyre Inventory Management System
## Software Requirements Specification (SRS) & Technical Design Document

| | |
|---|---|
| **Document Version** | 1.0 |
| **Date** | 2026-05-31 |
| **Status** | Draft for Review |
| **Author** | Engineering / Architecture |
| **System Codename** | TyreStock |

---

## Table of Contents

1. [Introduction](#1-introduction)
2. [Functional Analysis](#2-functional-analysis)
3. [System Design / Architecture](#3-system-design--architecture)
4. [Database Design](#4-database-design)
5. [Product Modeling](#5-product-modeling)
6. [REST API Design](#6-rest-api-design)
7. [Frontend Screens](#7-frontend-screens)
8. [Non-Functional Requirements](#8-non-functional-requirements)
9. [Development Roadmap](#9-development-roadmap)
10. [Appendices](#10-appendices)

---

## 1. Introduction

### 1.1 Purpose
This document defines the functional and technical requirements for the **Tyre Inventory Management System (TyreStock)** — a web and tablet-friendly application for a tyre/garage retail business to manage stock, sales, customers, and reporting in real time. It serves as the single source of truth for product, engineering, and QA during Phase 1 (MVP) and informs Phase 2/3 planning.

### 1.2 Scope
The MVP delivers inventory management, real-time stock tracking, sales/billing, customer records, dashboard, reports, stock alerts, and settings. Purchase management, supplier management, multi-user roles, barcode/QR, and value-added services are deferred to later phases per the requirements document.

### 1.3 Definitions & Abbreviations
| Term | Meaning |
|---|---|
| **SKU** | Stock Keeping Unit — unique code per product variant |
| **Variant** | A specific sellable combination of attributes (size, type, position…) |
| **Attribute** | A typed property of a product (Brand, Size, Width, Rim Size, Pattern, Warranty…) |
| **Stock Movement** | Any event that changes on-hand quantity (sale, adjustment, return, intake) |
| **MVP** | Minimum Viable Product (Phase 1) |
| **EAV** | Entity-Attribute-Value modeling pattern |

### 1.4 Key Design Principle
The catalog is modeled with a **Product Type + Attributes** system (not rigid category columns), so the platform scales beyond tyres to Alloy Wheels, Tubes, Accessories, and Services (Phase 2) **without schema migrations**.

---

## 2. Functional Analysis

### 2.1 Business Processes

| # | Process | Phase | Description |
|---|---|---|---|
| BP-1 | Catalog Management | MVP | Define product types, attributes, brands, categories; create products & variants |
| BP-2 | Inventory Tracking | MVP | Maintain on-hand quantity per variant, rack location, cost & price |
| BP-3 | Stock Movement Ledger | MVP | Record every quantity change with reason and reference (immutable ledger) |
| BP-4 | Sales / Billing | MVP | Create invoices, deduct stock atomically, compute tax & totals |
| BP-5 | Customer Management | MVP | Maintain customer records, link to sales history |
| BP-6 | Stock Alerts | MVP | Detect low/zero stock against reorder thresholds; notify |
| BP-7 | Reporting & Analytics | MVP | Sales, fast-moving, best-selling brand, tax, stock valuation |
| BP-8 | Dashboard Overview | MVP | Real-time KPIs and alerts at a glance |
| BP-9 | Settings & Master Data | MVP | Tax rates, company profile, units, thresholds, attribute lists |
| BP-10 | Purchase / GRN | Phase 2 | Purchase orders, goods receipt increasing stock |
| BP-11 | Supplier Management | Phase 2 | Supplier records, linked to purchases |
| BP-12 | User & Role Management | Phase 2 | Multiple users, RBAC |
| BP-13 | Barcode / QR | Phase 2 | Generate & scan codes for fast lookup/billing |
| BP-14 | Services Management | Phase 2 | Wheel alignment, balancing, fitting, etc. |

### 2.2 Actors & User Roles

> **MVP note:** Multi-user/role management is a Phase 2 feature. The MVP ships with a **single `ADMIN` role** but the data model and authorization layer are built RBAC-ready so Phase 2 only adds roles/permissions, not migrations.

| Actor | Phase | Responsibilities |
|---|---|---|
| **Admin / Owner** | MVP | Full access: catalog, inventory, sales, customers, reports, settings |
| **Sales Staff / Cashier** | Phase 2 | Create sales, look up stock, manage customers (no settings/cost visibility) |
| **Inventory Manager** | Phase 2 | Manage stock, adjustments, purchases, receive goods |
| **Auditor (read-only)** | Phase 2 | View reports & audit logs only |
| **System (scheduler)** | MVP | Background jobs: alert evaluation, report aggregation, backups |

### 2.3 Core Workflows

**W1 — Add Product & Stock (MVP)**
```
Admin → New Product → pick Product Type → fill typed attributes (Brand, Size, Type,
Vehicle Type, Position, Terrain, Warranty, Mfg Date) → set SKU (auto-suggested) →
set purchase/selling price, rack location, opening quantity →
Save → system creates Product + Variant + Inventory row + opening Stock Movement.
```

**W2 — Sell Products (MVP)**
```
Admin → New Sale → add/select Customer → search & add line items (by SKU/name/size) →
system validates available qty → apply discount/tax → Confirm →
[DB transaction] decrement inventory + write SALE stock movement + create Sale & SaleItems
+ generate invoice → re-evaluate low-stock alerts.
```

**W3 — Stock Adjustment (MVP)**
```
Admin → Inventory → select variant → Adjust → choose reason (damage, recount, return) →
enter delta → Save → write ADJUSTMENT stock movement, update on-hand.
```

**W4 — Low-Stock Alert (MVP, automated)**
```
Scheduler (or post-movement hook) → compare on-hand vs reorder_level per variant →
create/refresh ALERT (LOW_STOCK / OUT_OF_STOCK) → surface on Dashboard & Stock Alerts screen.
```

**W5 — Reporting (MVP)**
```
Admin → Reports → pick report + date range/filters → backend aggregates →
view on screen → export CSV/PDF.
```

### 2.4 MVP Feature Set (Phase 1)
- Inventory Management & Real-time Stock Tracking
- Product Type + Attributes catalog (Tyres)
- Sales Management with Invoice & Billing + Tax reports
- Customer Management
- Dashboard Overview
- Reports & Analytics: Low Stock, Fast-Moving, Best-Selling Brand, Stock Valuation, Sales, Tax
- Notifications & Alerts (low/out-of-stock)
- Settings (company, tax, thresholds, attribute master data)
- Mobile & Tablet responsive UI
- Audit logging of all mutations (foundation for Phase 2 auditor role)

### 2.5 Phase 2 / Phase 3 Features
- **Phase 2:** Purchase Management & GRN, Supplier Management, User & Role Management (RBAC), Barcode & QR generation/scanning, Services module, additional categories (Alloy Wheels, Tubes, Accessories).
- **Phase 3:** Multi-branch/warehouse, e-commerce/customer portal, GST e-invoicing integration, loyalty, advanced forecasting/demand planning, mobile native app.

---

## 3. System Design / Architecture

### 3.1 High-Level Architecture

```
                          ┌─────────────────────────────┐
                          │   Client (Browser / Tablet)  │
                          │  React SPA (Vite + TS)        │
                          └──────────────┬───────────────┘
                                         │ HTTPS / REST + JWT
                          ┌──────────────▼───────────────┐
                          │        API Gateway / CDN       │
                          │     (Nginx reverse proxy)      │
                          └──────────────┬───────────────┘
                          ┌──────────────▼───────────────┐
                          │   Node.js API (Express/TS)     │
                          │  Controllers→Services→Repos    │
                          │  Auth | Validation | Audit     │
                          └───┬───────────┬───────────┬───┘
                              │           │           │
                  ┌───────────▼──┐  ┌─────▼─────┐ ┌───▼─────────┐
                  │ PostgreSQL   │  │  Redis    │ │  Job Worker │
                  │ (primary DB) │  │ cache/queue│ │ (BullMQ)    │
                  └──────────────┘  └───────────┘ └─────────────┘
```

### 3.2 React Frontend Architecture
- **Stack:** React 18 + TypeScript, Vite, React Router, TanStack Query (server state), Zustand (light UI state), React Hook Form + Zod (forms/validation), Tailwind CSS + a component library (shadcn/ui or MUI), Recharts for analytics.
- **Structure (feature-sliced):**
  ```
  src/
    app/            # router, providers, layout shells
    features/
      auth/  products/  inventory/  sales/  customers/  reports/  dashboard/  settings/
        components/  hooks/  api/  types.ts
    shared/
      ui/           # design-system components
      api/          # axios client, interceptors (JWT refresh)
      lib/          # formatters, currency (₹), date utils
      hooks/  types/
  ```
- **Cross-cutting:** Axios instance with auth interceptor + automatic token refresh; global error boundary + toast notifications; route-level code splitting; responsive layout (desktop sidebar → tablet collapsible → mobile bottom-nav).

### 3.3 Node.js Backend Architecture
- **Stack:** Node.js (LTS) + TypeScript, Express (or Fastify), Prisma ORM (PostgreSQL), Zod for request validation, JWT (access + refresh), BullMQ + Redis for jobs, Pino for structured logging.
- **Layered design:**
  ```
  src/
    routes/         # express routers per resource
    controllers/    # HTTP I/O, status codes
    services/       # business logic, transactions
    repositories/   # Prisma data access
    middleware/     # auth, rbac, validation, error, audit, rate-limit
    jobs/           # alert evaluation, report aggregation, backups
    db/             # prisma schema, migrations, seeds
    config/  utils/  types/
  ```
- **Principles:** thin controllers, business logic in services, all multi-row mutations in DB transactions; every write passes through an **audit middleware** that records before/after diffs; idempotency keys on sale creation to prevent duplicate invoices.

### 3.4 PostgreSQL Strategy
- Single primary with daily logical backups + PITR (WAL archiving). Read replica added in Phase 3 for reporting load.
- Money stored as `NUMERIC(12,2)`; timestamps `TIMESTAMPTZ`; soft-delete via `deleted_at` on master data; hard ledger tables (`stock_movements`, `audit_logs`) are append-only.

### 3.5 REST API Architecture
- Versioned base path `/api/v1`. Resource-oriented nouns, plural. JSON only.
- Standard envelope:
  ```json
  { "success": true, "data": {...}, "meta": { "page": 1, "pageSize": 20, "total": 137 } }
  ```
  Errors:
  ```json
  { "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
  ```
- Pagination (`?page=&pageSize=`), filtering (`?brand=MRF&size=195/65 R15`), sorting (`?sort=-createdAt`), full-text search (`?q=`).
- Standard status codes: 200/201/204, 400 validation, 401 auth, 403 forbidden, 404, 409 conflict (e.g. insufficient stock / duplicate SKU), 422, 429 rate-limit, 500.

### 3.6 Authentication & Authorization Model
- **AuthN:** Email + password (Argon2id hashing). Login issues a short-lived **access JWT (15 min)** + long-lived **refresh token (7 days, rotating, stored hashed in DB)**. Refresh endpoint rotates and revokes on reuse detection.
- **AuthZ:** Role-Based Access Control. `users.role` → `roles` → `permissions` (e.g. `product:write`, `sale:create`, `report:read`, `settings:write`). MVP seeds a single `ADMIN` role with all permissions; middleware `requirePermission('sale:create')` is enforced from day one so Phase 2 only adds roles.
- **Hardening:** rate-limit login (5/min/IP), account lockout after N failures, password policy, all tokens over HTTPS, CSRF not applicable (Bearer tokens, no cookies for API) — refresh token optionally in httpOnly cookie if web-only.

---

## 4. Database Design

### 4.1 Entity-Relationship Overview

```
brands ─┐
        ├─< products >─< product_variants >─1:1─ inventory
categories ┘                    │                    │
product_types ─< attributes      │                    ├─< stock_movements
product_types ─< products        │                    └─ (reorder_level)
                                  └─< variant_attribute_values >─ attributes
customers ─< sales >─< sale_items >─ product_variants
users ─< sales (created_by)
users ─< audit_logs
product_variants ─< alerts
sales ─1:1─ invoices
```

### 4.2 Schema (PostgreSQL DDL — abridged but complete)

```sql
-- ============ USERS / AUTH (RBAC-ready) ============
CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(50) UNIQUE NOT NULL,        -- ADMIN, SALES, INVENTORY, AUDITOR
  description TEXT
);

CREATE TABLE permissions (
  id    SERIAL PRIMARY KEY,
  code  VARCHAR(60) UNIQUE NOT NULL                -- e.g. 'product:write'
);

CREATE TABLE role_permissions (
  role_id       INT REFERENCES roles(id) ON DELETE CASCADE,
  permission_id INT REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name      VARCHAR(120) NOT NULL,
  email          CITEXT UNIQUE NOT NULL,
  password_hash  TEXT NOT NULL,
  role_id        INT NOT NULL REFERENCES roles(id),
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  last_login_at  TIMESTAMPTZ,
  failed_logins  INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  revoked_at  TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============ CATALOG ============
CREATE TABLE brands (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(80) UNIQUE NOT NULL,          -- MRF, CEAT, Apollo...
  logo_url   TEXT,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE categories (
  id         SERIAL PRIMARY KEY,
  parent_id  INT REFERENCES categories(id),        -- self-referential tree
  name       VARCHAR(80) NOT NULL,                 -- Tyres > Car Tyres
  slug       VARCHAR(100) UNIQUE NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  deleted_at TIMESTAMPTZ
);

-- A product type defines WHICH attributes apply (Tyre, Alloy Wheel, Tube, Service...)
CREATE TABLE product_types (
  id         SERIAL PRIMARY KEY,
  name       VARCHAR(80) UNIQUE NOT NULL,          -- 'Car Tyre', 'Alloy Wheel'
  is_stockable BOOLEAN NOT NULL DEFAULT TRUE,       -- false for Services (Phase 2)
  is_active  BOOLEAN NOT NULL DEFAULT TRUE
);

-- Attribute definitions (the schema-less part made schema-ful)
CREATE TYPE attribute_datatype AS ENUM ('TEXT','NUMBER','ENUM','DATE','BOOLEAN');

CREATE TABLE attributes (
  id            SERIAL PRIMARY KEY,
  product_type_id INT NOT NULL REFERENCES product_types(id),
  code          VARCHAR(40) NOT NULL,              -- 'size','width','rim_size','pattern'...
  label         VARCHAR(80) NOT NULL,
  datatype      attribute_datatype NOT NULL,
  is_required   BOOLEAN NOT NULL DEFAULT FALSE,
  is_variant_defining BOOLEAN NOT NULL DEFAULT FALSE, -- size/position drive variants
  display_order INT NOT NULL DEFAULT 0,
  UNIQUE (product_type_id, code)
);

-- Allowed values for ENUM attributes (Tyre Type, Position, Terrain, Vehicle Type)
CREATE TABLE attribute_options (
  id           SERIAL PRIMARY KEY,
  attribute_id INT NOT NULL REFERENCES attributes(id) ON DELETE CASCADE,
  value        VARCHAR(80) NOT NULL,               -- 'Tubeless','Front','Highway'
  display_order INT NOT NULL DEFAULT 0,
  UNIQUE (attribute_id, value)
);

CREATE TABLE products (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type_id INT NOT NULL REFERENCES product_types(id),
  category_id     INT REFERENCES categories(id),
  brand_id        INT REFERENCES brands(id),
  name            VARCHAR(160) NOT NULL,           -- 'MRF ZLX'
  description     TEXT,
  warranty_months INT,                             -- 60 = 5 years
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);
CREATE INDEX idx_products_brand ON products(brand_id);
CREATE INDEX idx_products_type  ON products(product_type_id);
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

-- A sellable variant = product + specific attribute combination
CREATE TABLE product_variants (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id          UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku                 VARCHAR(60) UNIQUE NOT NULL, -- TYR-MRF-19565R15
  manufacturing_date  DATE,
  purchase_price      NUMERIC(12,2) NOT NULL DEFAULT 0,
  selling_price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate_pct        NUMERIC(5,2)  NOT NULL DEFAULT 0,  -- GST
  barcode             VARCHAR(64) UNIQUE,          -- Phase 2
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at          TIMESTAMPTZ
);

-- EAV: the actual attribute values for each variant
CREATE TABLE variant_attribute_values (
  variant_id    UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  attribute_id  INT  NOT NULL REFERENCES attributes(id),
  value_text    VARCHAR(160),
  value_number  NUMERIC(12,3),
  value_date    DATE,
  value_bool    BOOLEAN,
  option_id     INT REFERENCES attribute_options(id),
  PRIMARY KEY (variant_id, attribute_id)
);
CREATE INDEX idx_vav_attr_text ON variant_attribute_values(attribute_id, value_text);

-- ============ INVENTORY ============
CREATE TABLE inventory (
  variant_id    UUID PRIMARY KEY REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity      INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  reorder_level INT NOT NULL DEFAULT 5,
  rack_location VARCHAR(40),                        -- 'Rack A-12'
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE movement_type AS ENUM
  ('OPENING','SALE','SALE_RETURN','ADJUSTMENT','PURCHASE','TRANSFER','DAMAGE');

-- Append-only ledger; on-hand = sum of deltas (inventory.quantity is the cached projection)
CREATE TABLE stock_movements (
  id            BIGSERIAL PRIMARY KEY,
  variant_id    UUID NOT NULL REFERENCES product_variants(id),
  type          movement_type NOT NULL,
  quantity_delta INT NOT NULL,                      -- +intake / -sale
  balance_after INT NOT NULL,
  reference_type VARCHAR(30),                       -- 'SALE','ADJUSTMENT'
  reference_id  UUID,                               -- e.g. sale id
  note          TEXT,
  created_by    UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_movements_variant ON stock_movements(variant_id, created_at);

-- ============ CUSTOMERS ============
CREATE TABLE customers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(120) NOT NULL,
  phone       VARCHAR(20),
  email       CITEXT,
  gstin       VARCHAR(20),                          -- for B2B invoices
  address     TEXT,
  vehicle_no  VARCHAR(20),
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ
);
CREATE INDEX idx_customers_phone ON customers(phone);

-- ============ SALES / BILLING ============
CREATE TYPE sale_status AS ENUM ('DRAFT','CONFIRMED','CANCELLED','RETURNED');

CREATE TABLE sales (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no    VARCHAR(30) UNIQUE NOT NULL,        -- INV-2026-000123
  customer_id   UUID REFERENCES customers(id),
  status        sale_status NOT NULL DEFAULT 'CONFIRMED',
  subtotal      NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  grand_total   NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_mode  VARCHAR(20),                         -- CASH, CARD, UPI
  sold_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES users(id),
  idempotency_key VARCHAR(80) UNIQUE
);
CREATE INDEX idx_sales_date ON sales(sold_at);
CREATE INDEX idx_sales_customer ON sales(customer_id);

CREATE TABLE sale_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id      UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  variant_id   UUID NOT NULL REFERENCES product_variants(id),
  description  VARCHAR(200) NOT NULL,                -- snapshot of name+attrs
  quantity     INT NOT NULL CHECK (quantity > 0),
  unit_price   NUMERIC(12,2) NOT NULL,               -- snapshot at sale time
  discount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate_pct NUMERIC(5,2)  NOT NULL DEFAULT 0,
  line_total   NUMERIC(12,2) NOT NULL
);

-- ============ ALERTS ============
CREATE TYPE alert_type AS ENUM ('LOW_STOCK','OUT_OF_STOCK');
CREATE TYPE alert_status AS ENUM ('OPEN','ACKNOWLEDGED','RESOLVED');

CREATE TABLE alerts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id  UUID NOT NULL REFERENCES product_variants(id),
  type        alert_type NOT NULL,
  status      alert_status NOT NULL DEFAULT 'OPEN',
  message     TEXT NOT NULL,
  current_qty INT NOT NULL,
  threshold   INT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  UNIQUE (variant_id, type, status)                  -- avoid duplicate OPEN alerts
);

-- ============ AUDIT ============
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID REFERENCES users(id),
  action      VARCHAR(40) NOT NULL,                  -- CREATE/UPDATE/DELETE/LOGIN
  entity_type VARCHAR(60) NOT NULL,                  -- 'product','sale'...
  entity_id   VARCHAR(64),
  before_data JSONB,
  after_data  JSONB,
  ip_address  INET,
  user_agent  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_actor  ON audit_logs(actor_id, created_at);

-- ============ SETTINGS ============
CREATE TABLE settings (
  key        VARCHAR(60) PRIMARY KEY,                -- 'company.name','tax.default_pct'
  value      JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 4.3 Integrity & Consistency Rules
- `inventory.quantity` is a **cached projection** of the `stock_movements` ledger. Both are updated inside the same DB transaction; a reconciliation job verifies `quantity == SUM(quantity_delta)` nightly.
- Sales creation, inventory decrement, ledger insert, and alert refresh occur in **one serializable transaction**; insufficient stock → `409 CONFLICT`, full rollback.
- `sale_items` snapshot price/description so historical invoices remain correct after catalog edits.
- Master data uses **soft delete** (`deleted_at`); ledgers (`stock_movements`, `audit_logs`) are **append-only / never deleted**.

---

## 5. Product Modeling

### 5.1 Why Product Type + Attributes (EAV-hybrid)
A rigid table with columns `size`, `vehicle_type`, `position`… cannot represent Alloy Wheels or Services without ALTER TABLE. Instead:

- **`product_types`** define a class of product (Car Tyre, Alloy Wheel, Tube, Service).
- **`attributes`** belong to a product type and declare *what* properties exist, their datatype, whether required, and whether they are **variant-defining**.
- **`attribute_options`** enumerate allowed values for ENUM attributes.
- **`products`** hold the common, always-present fields (name, brand, category, warranty).
- **`product_variants`** are the actual sellable SKUs with price, stock, mfg date, barcode.
- **`variant_attribute_values`** (EAV) bind a variant to concrete attribute values.

This keeps **hot, universal fields as real columns** (fast, indexable: brand, name, price, warranty, mfg date) while **variable attributes live in EAV** — the pragmatic hybrid that avoids both rigid columns and a fully schema-less mess.

### 5.2 Required Attribute Coverage

| Requirement | Modeled as |
|---|---|
| Product Type | `product_types` + `products.product_type_id` |
| Brand | `brands` + `products.brand_id` (hot column) |
| Size | `attributes(code='size', ENUM)` + options (145/80 R12 …) — variant-defining |
| Width / Rim Size | `attributes(code='width'/'rim_size', NUMBER)` |
| Vehicle Type | `attributes(code='vehicle_type', ENUM)` (Hatchback, Sedan, SUV…) |
| Tyre Type | `attributes(code='tyre_type', ENUM)` (Tubeless, Tube Type, Radial, Bias) |
| Position | `attributes(code='position', ENUM)` (Front, Rear, Universal) |
| Terrain Type | `attributes(code='terrain', ENUM)` (Highway, City, Off-road, Mud, All) |
| Pattern | `attributes(code='pattern', TEXT)` |
| Warranty | `products.warranty_months` (hot column) |
| Manufacturing Date | `product_variants.manufacturing_date` (hot column) |

### 5.3 Worked Example (matches the PDF sample)

```
product_type: "Car Tyre"
product: { name:"MRF ZLX", brand:"MRF", category:"Car Tyres", warranty_months:60 }
variant: { sku:"TYR-MRF-19565R15", purchase_price:4000, selling_price:4800,
           mfg_date:"2026-01-01" }
variant_attribute_values:
  size        -> "195/65 R15"   (variant-defining)
  tyre_type   -> "Tubeless"
  vehicle_type-> "Sedan"
inventory: { quantity:20, rack_location:"Rack A-12", reorder_level:5 }
```

### 5.4 Future Categories (no migration needed)
Adding **Alloy Wheels** = insert a `product_type` + its attributes (Material, Diameter, Bolt Pattern). Adding **Services** = a `product_type` with `is_stockable=false` (skips inventory). Accessories/Tubes follow the same path — **zero schema changes**.

---

## 6. REST API Design

Base URL: `https://api.tyrestock.app/api/v1`. All non-auth endpoints require `Authorization: Bearer <accessToken>`.

### 6.1 Authentication APIs
| Method | Path | Description |
|---|---|---|
| POST | `/auth/login` | Email+password → `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | Rotate refresh → new token pair |
| POST | `/auth/logout` | Revoke refresh token |
| GET | `/auth/me` | Current user + permissions |
| POST | `/auth/change-password` | Change own password |

```http
POST /api/v1/auth/login
{ "email": "admin@garage.com", "password": "••••••" }
200 → { "success":true, "data":{ "accessToken":"...", "refreshToken":"...",
        "user":{ "id":"...", "fullName":"Owner", "role":"ADMIN",
                 "permissions":["product:write","sale:create", ...] } } }
```

### 6.2 Product / Catalog APIs
| Method | Path | Description |
|---|---|---|
| GET | `/product-types` | List product types |
| GET | `/product-types/:id/attributes` | Attribute schema (drives dynamic forms) |
| GET | `/brands` · POST · PATCH · DELETE | Brand CRUD |
| GET | `/categories` | Category tree |
| GET | `/products?q=&brand=&type=&page=` | Search/list products |
| POST | `/products` | Create product (+ optional first variant) |
| GET | `/products/:id` | Product detail with variants |
| PATCH | `/products/:id` | Update product |
| DELETE | `/products/:id` | Soft-delete |
| POST | `/products/:id/variants` | Add variant with attribute values |
| PATCH | `/variants/:id` | Update variant (price, mfg date, attrs) |
| GET | `/variants?size=&q=&inStock=true` | Variant search (used by sales screen) |

```http
POST /api/v1/products
{
  "productTypeId": 1, "brandId": 3, "categoryId": 2,
  "name": "MRF ZLX", "warrantyMonths": 60,
  "variant": {
    "sku": "TYR-MRF-19565R15", "purchasePrice": 4000, "sellingPrice": 4800,
    "taxRatePct": 18, "manufacturingDate": "2026-01-01",
    "attributes": { "size":"195/65 R15", "tyre_type":"Tubeless", "vehicle_type":"Sedan" },
    "openingStock": 20, "rackLocation": "Rack A-12", "reorderLevel": 5
  }
}
201 → { "success": true, "data": { "id":"...", "variants":[ ... ] } }
```

### 6.3 Inventory APIs
| Method | Path | Description |
|---|---|---|
| GET | `/inventory?lowStock=true&q=&rack=` | Stock list with on-hand & thresholds |
| GET | `/inventory/:variantId` | Single variant stock + rack |
| POST | `/inventory/:variantId/adjust` | `{ delta, reason, note }` → adjustment movement |
| PATCH | `/inventory/:variantId` | Update reorder level / rack location |
| GET | `/inventory/:variantId/movements?from=&to=` | Stock movement ledger |
| GET | `/inventory/valuation` | Total stock valuation (qty × purchase price) |

### 6.4 Sales APIs
| Method | Path | Description |
|---|---|---|
| GET | `/sales?from=&to=&customerId=&page=` | List sales/invoices |
| POST | `/sales` | Create sale (atomic stock deduction); `Idempotency-Key` header |
| GET | `/sales/:id` | Sale detail with items |
| POST | `/sales/:id/cancel` | Cancel & restock |
| POST | `/sales/:id/return` | Sale return (partial/full) → restock |
| GET | `/sales/:id/invoice` | Invoice PDF / printable payload |

```http
POST /api/v1/sales         Idempotency-Key: 9f3a...
{
  "customerId": "uuid-or-null",
  "items": [ { "variantId":"...", "quantity":4, "discount":0 } ],
  "discount": 200, "paymentMode": "UPI"
}
201 → { "data":{ "invoiceNo":"INV-2026-000123", "grandTotal":18464.00, ... } }
409 → { "error":{ "code":"INSUFFICIENT_STOCK", "details":[{ "variantId":"...","available":2 }] } }
```

### 6.5 Customer APIs
| Method | Path | Description |
|---|---|---|
| GET | `/customers?q=&page=` | Search by name/phone |
| POST | `/customers` | Create |
| GET | `/customers/:id` | Detail + purchase history |
| PATCH | `/customers/:id` | Update |
| DELETE | `/customers/:id` | Soft-delete |

### 6.6 Dashboard APIs
| Method | Path | Description |
|---|---|---|
| GET | `/dashboard/summary` | KPIs: today/MTD sales, revenue, total SKUs, stock value, open alerts |
| GET | `/dashboard/sales-trend?range=30d` | Time series for chart |
| GET | `/dashboard/top-brands?range=30d` | Best-selling brands |
| GET | `/dashboard/fast-moving?range=30d` | Fast-moving variants |

### 6.7 Reports APIs
| Method | Path | Description |
|---|---|---|
| GET | `/reports/sales?from=&to=&groupBy=day` | Sales report |
| GET | `/reports/fast-moving?from=&to=` | Fast-moving tyres |
| GET | `/reports/best-selling-brands?from=&to=` | Brand analytics |
| GET | `/reports/low-stock` | Items at/below reorder level |
| GET | `/reports/stock-valuation` | Valuation by brand/category |
| GET | `/reports/tax?from=&to=` | GST/tax summary |
| GET | `/reports/:name/export?format=csv\|pdf` | Export any report |

### 6.8 Alerts & Settings APIs
| Method | Path | Description |
|---|---|---|
| GET | `/alerts?status=OPEN` | List alerts |
| POST | `/alerts/:id/acknowledge` | Acknowledge |
| GET | `/settings` · PATCH `/settings` | Company profile, tax, thresholds, attribute master data |

---

## 7. Frontend Screens

| # | Screen | Phase | Key elements |
|---|---|---|---|
| S1 | **Login** | MVP | Email/password, validation, lockout messaging, brand logo |
| S2 | **Dashboard** | MVP | KPI cards (today's sales, revenue, total stock value, SKUs, open alerts), sales-trend chart, top-brands & fast-moving widgets, low-stock list |
| S3 | **Product Management** | MVP | Product list (search/filter by brand, type, size), create/edit with **dynamic attribute form** driven by product-type schema, variant manager, SKU auto-suggest |
| S4 | **Inventory Management** | MVP | Stock table (on-hand, reorder level, rack), low-stock filter, quick **Adjust** modal, per-variant movement ledger drawer, valuation summary |
| S5 | **Sales / Billing** | MVP | POS-style: customer picker, item search by SKU/name/size, cart with qty/discount/tax, live total, confirm → invoice; invoice print/PDF; sales history list |
| S6 | **Customers** | MVP | Customer list/search, profile with purchase history, add/edit |
| S7 | **Reports** | MVP | Report selector + date range/filters, table + chart, CSV/PDF export (Sales, Fast-moving, Best-selling brand, Low stock, Valuation, Tax) |
| S8 | **Stock Alerts** | MVP | Open/acknowledged alerts, acknowledge action, deep-link to inventory |
| S9 | **Settings** | MVP | Company profile, tax rates, default reorder level, attribute & option master data, brands/categories management |
| S10 | **Purchase / Suppliers** | Phase 2 | PO creation, GRN, supplier directory |
| S11 | **User & Roles** | Phase 2 | User CRUD, role/permission assignment |
| S12 | **Barcode/QR** | Phase 2 | Label generation, scan-to-add in sales |
| S13 | **Services** | Phase 2 | Service catalog, service billing |

**UX/Responsive:** desktop sidebar nav → tablet collapsible drawer → mobile bottom-nav. Sales screen optimized for tablet touch use at the counter. All currency in ₹, dates in dd-MMM-yyyy.

---

## 8. Non-Functional Requirements

### 8.1 Security
- Argon2id password hashing; JWT access (15 min) + rotating refresh (7 d) with reuse detection.
- RBAC enforced at middleware on every endpoint; principle of least privilege.
- Input validation via Zod on all request bodies/queries; parameterized queries (Prisma) → no SQL injection.
- HTTPS/TLS everywhere; HSTS; security headers via Helmet; CORS allowlist.
- Rate limiting (global + stricter on auth); account lockout after 5 failed logins.
- Secrets in env/secret manager, never in code; dependency scanning (npm audit / Dependabot).
- PII (customer phone/email/GSTIN) access logged in audit trail.

### 8.2 Performance
- API p95 < 300 ms for reads, < 500 ms for transactional writes under normal load.
- Indexed search (GIN trigram on product name, B-tree on SKU/brand/size); pagination everywhere (no unbounded lists).
- Redis caching for dashboard summary, attribute schemas, and reference data (brands/categories) with short TTL + invalidation on write.
- Frontend: route-based code splitting, TanStack Query caching, debounced search, virtualized long tables.

### 8.3 Scalability
- Stateless API → horizontal scaling behind a load balancer.
- Heavy report aggregation offloaded to BullMQ workers; results cached.
- DB read replica for reporting (Phase 3); table partitioning for `stock_movements`/`audit_logs` by month when volume grows.
- EAV catalog model scales to new product categories without migrations.

### 8.4 Auditability
- `audit_logs` capture actor, action, entity, before/after JSON diff, IP, user-agent, timestamp on every mutation.
- `stock_movements` is an immutable ledger giving full stock history per variant; on-hand is reconcilable from it.
- Login/logout/password events logged. Logs retained ≥ 1 year; append-only, never deleted.

### 8.5 Backup & Recovery
- Automated nightly logical `pg_dump` + continuous WAL archiving for Point-In-Time Recovery.
- Backups encrypted at rest, stored off-site (object storage), 30-day rolling retention + monthly long-term.
- Quarterly restore drills; documented RPO ≤ 24 h (≤ 5 min with PITR), RTO ≤ 2 h.
- Nightly inventory-vs-ledger reconciliation job flags discrepancies.

### 8.6 Reliability & Observability
- Structured logs (Pino), health/readiness endpoints, metrics (Prometheus), error tracking (Sentry).
- Graceful shutdown, DB connection pooling, ret/idempotency on sale creation.

---

## 9. Development Roadmap

### Phase 1 — MVP (≈ 8–10 weeks)
1. **Foundation (wk 1–2):** repo, CI/CD, Postgres + Prisma schema, auth (single ADMIN, RBAC-ready), audit middleware, settings.
2. **Catalog (wk 3–4):** product types, attributes, brands, categories, products & variants, dynamic attribute forms.
3. **Inventory (wk 5):** inventory table, stock movements ledger, adjustments, valuation.
4. **Sales & Billing (wk 6–7):** POS sales flow, atomic stock deduction, invoices/PDF, tax, customers.
5. **Dashboard, Reports, Alerts (wk 8):** KPIs, sales/fast-moving/best-brand/low-stock/tax reports, low-stock alerts + scheduler.
6. **Hardening (wk 9–10):** responsive polish, perf/caching, security pass, backups, UAT.

**MVP exit criteria:** Admin can manage tyre catalog, track stock in real time, bill customers, see dashboard & reports, and receive low-stock alerts on web + tablet.

### Phase 2 (≈ 6–8 weeks)
- Purchase Management & GRN, Supplier Management.
- User & Role Management (activate full RBAC, multiple staff roles).
- Barcode & QR generation + scan-to-bill.
- Services module (non-stockable product type) + service billing.
- Additional categories: Alloy Wheels, Tubes, Accessories (config-only, leveraging EAV).

### Phase 3 (future)
- Multi-branch / warehouse with stock transfers.
- Customer-facing portal / e-commerce, GST e-invoicing integration.
- Loyalty, demand forecasting & auto-reorder suggestions, BI dashboards.
- Native mobile app, DB read replicas & partitioning at scale.

---

## 10. Appendices

### 10.1 Reference Master Data (seed)
- **Brands:** MRF, CEAT, Apollo Tyres, Bridgestone, Michelin, Goodyear.
- **Categories (Tyres):** Car, Bike, Truck, Bus, Tractor, SUV, EV, Off-road.
- **Vehicle Types:** Hatchback, Sedan, SUV, Truck, Bike, Scooter, Tractor.
- **Tyre Sizes:** 145/80 R12, 165/80 R14, 195/65 R15, 205/55 R16.
- **Tyre Types:** Tubeless, Tube Type, Radial, Bias.
- **Positions:** Front, Rear, Universal.
- **Terrains:** Highway, City, Off-road, Mud Terrain, All Terrain.

### 10.2 Recommended Search Filters (Sales/Product screens)
Brand · Tyre Size · Vehicle Model · Vehicle Type · Stock Availability · Price Range.

### 10.3 Technology Summary
| Layer | Choice |
|---|---|
| Frontend | React 18 + TS, Vite, TanStack Query, Tailwind/shadcn, Recharts |
| Backend | Node.js + TS, Express/Fastify, Prisma |
| Database | PostgreSQL (CITEXT, pg_trgm, JSONB) |
| Cache/Queue | Redis + BullMQ |
| Auth | JWT (access+refresh), Argon2id, RBAC |
| Infra | Docker, Nginx, object storage for backups, Sentry/Prometheus |

---

*End of document.*
