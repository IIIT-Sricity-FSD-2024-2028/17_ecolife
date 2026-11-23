# Tropos

Carbon accounting and ESG reporting for Indian SME manufacturers. Each company records its fuel, electricity, water and waste every month, gets the entries reviewed, closes the month, and produces reports an auditor can verify.

- `tropos-backend` — NestJS 12, Prisma 7, PostgreSQL with row-level security
- `tropos-frontend` — React 19, Vite, Tailwind CSS 4

## Run it locally

Needs Node.js 22+ and PostgreSQL 15+.

```bash
# 1. Database (as a PostgreSQL superuser)
createdb tropos

# 2. Backend
cd tropos-backend
cp .env.example .env     # set JWT_SECRET, DATA_ENCRYPTION_KEY, and the two database passwords (see the comments inside)
npm ci
npm run db:setup         # creates tables, the restricted role "tropos_app", security rules, base data
npm run start            # leave running; then, in a second terminal:
npm run db:seed-demo     # optional: a full demo story, every workflow state
npm run dev              # http://localhost:4000/api  (docs at /api/docs)

# 3. Frontend (new terminal)
cd tropos-frontend
cp .env.example .env
npm ci
npm run dev              # http://localhost:5173
```

Demo logins (password `Tropos@2026`): `lead@`, `plant@`, `admin@`, `finance@`, `exec@`, `auditor@bharatgears.in`, `verifier@acva-india.in`, `platform.admin@tropos.in`.

## Demo and evaluation

`npm run db:seed-demo` fills the database by using the real API as each role, so the data follows the same rules as live data.

## Database

- **The database itself is never committed.** No dump, no data files, no `.env`. The repository holds only the recipe: `prisma/schema.prisma`, the first migration in `prisma/migrations/`, `prisma/rls-and-constraints.sql` and `prisma/seed.ts`. Anyone who clones the repo rebuilds an identical database with `npm run db:setup`.
- **Two connections, on purpose.** `MIGRATE_DATABASE_URL` (owner) creates tables and seeds. `DATABASE_URL` is the restricted role `tropos_app` that the running API uses. Row-level security does not apply to superusers, so the API refuses to start if it is given one.
- Real secrets (JWT secret, payment keys, storage keys) go only in `.env`, which is git-ignored. `.env.example` has placeholders.


## Status

Billing needs the company's GST details and plan prices (from a CA). The Terms and Privacy pages hold placeholder text. Neither is deployed yet.
