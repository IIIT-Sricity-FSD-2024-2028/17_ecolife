# Tropos Backend (NestJS 12 + Prisma 7 + PostgreSQL FORCE RLS)

Production backend for **Tropos — Carbon Accounting, Resource Analytics & Green Economy ERP**.

## Key Architecture
- **Framework:** NestJS 12 (`src/modules/*` split cleanly into `*.module.ts` + `*.controller.ts` + `*.service.ts`), Swagger OpenAPI UI at `/api/docs`.
- **Database & Isolation:** PostgreSQL + Prisma ORM (55 models, 49 enums, 44 `FORCE ROW LEVEL SECURITY` tables, 8 compliance triggers, cross-platform `prisma/apply-rls.ts`).
- **API Base Path:** `/api` (plus `/health` and `/health/ready`).
- **Local Bill OCR:** `POST /api/ocr/extract-bill` using `pdf-parse` + `tesseract.js` with automatic SHA-256 `EvidenceFile` archival & kVAh detection.
- **Automated QA/QC Engine:** Z-score anomaly detection, unit-cost outlier detection, duplicate invoice & SHA-256 detection, and automated Period-Close Readiness Gate (`GET /api/periods/:id/readiness`).
- **Real Email & OTP Dispatch:** `EmailOutboxModule` with Nodemailer SMTP (Supabase/Gmail/Brevo/SES) and Resend HTTP API adapters + background retry worker.

## Quick Start
```bash
cp .env.example .env     # fill JWT_SECRET, DATA_ENCRYPTION_KEY, and the database passwords
npm ci
npm run db:setup         # tables, restricted role, security rules, base data
npm run db:seed-demo     # (API running) adds the demo story: every workflow state, all roles
npm run dev
```
- API: `http://localhost:4000/api`
- Swagger Docs: `http://localhost:4000/api/docs`
- The API connects as the restricted role `tropos_app` and refuses to start as a superuser (see the repository README, "Database").
