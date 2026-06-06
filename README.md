# TyreStock — Inventory Management System

Phase 1 (MVP) of the Tyre Inventory Management System.  
See [SRS_and_Technical_Design.md](SRS_and_Technical_Design.md) for the full architecture spec and [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the task-by-task build plan.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite, TanStack React Query, shadcn/ui, Tailwind CSS |
| Backend | Node.js 22, Express, TypeScript, Prisma ORM, Zod |
| Database | PostgreSQL 16 |
| Auth | JWT access + rotating refresh tokens (Argon2id) |
| Deployment | Docker, Docker Compose |

---

## Quick Start (Development)

### Prerequisites
- Node.js ≥ 22, npm ≥ 10
- Docker & Docker Compose

### 1. Clone & install
```bash
git clone <repo-url>
cd Inventory-Management
cp .env.example .env          # edit secrets before running
npm install
```

### 2. Start Postgres
```bash
docker compose -f docker-compose.dev.yml up -d
```

### 3. Migrate & seed database
```bash
npm run db:migrate
npm run db:seed
```

### 4. Run dev servers
```bash
npm run dev
# Backend:  http://localhost:3001
# Frontend: http://localhost:3000
```

---

## Running with Docker Compose (full stack)

```bash
cp .env.example .env          # fill in secrets
docker compose up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:3001
# API:      http://localhost:3001/api/v1/health
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start backend + frontend dev servers concurrently |
| `npm run build` | Production build (both workspaces) |
| `npm run test` | Run all tests (Jest + Supertest + RTL) |
| `npm run typecheck` | TypeScript check (both workspaces) |
| `npm run lint` | ESLint (both workspaces) |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed database (brands, admin user, product types) |
| `npm run db:studio` | Open Prisma Studio |

---

## Project Structure

```
.
├── backend/          Node.js + Express API
│   ├── prisma/       Schema, migrations, seed
│   └── src/          Source (modules, middleware, config)
├── frontend/         React 19 + Vite SPA
│   └── src/          Source (features, shared, app)
├── docker/           Docker support files
│   └── postgres/     init.sql (extensions)
├── docker-compose.yml          Full stack (prod-like)
├── docker-compose.dev.yml      Postgres only (dev)
└── .env.example
```

---

## Default Credentials (development seed)

| Field | Value |
|---|---|
| Email | admin@tyrestock.app |
| Password | Admin@123! |

> Change these immediately in any non-development environment.
