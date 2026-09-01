# Rorizon - Project Overview
A Resource Usage and impact analysis platform.

## What the project does

Rorizon is a carbon and resource reporting application. Users can manage
organizations and departments, record resource usage, upload evidence, calculate
emissions, submit data for review, prepare reports, and keep an audit history.
The application also contains alerts, notifications, imports, and subscription
management.

This is currently a prototype. The frontend is plain HTML, CSS, and JavaScript.
The backend is a NestJS application and stores its data in memory. Data is seeded
when the server starts, so this is not yet a production database-backed system.

---

## The main roles

These role names are used in both the backend and the frontend. Keep the spelling
and capitalization unchanged because the role guard compares the values directly.

| Role | Frontend area |
|---|---|
| `Super User` | `front-end/html/admin/` |
| `COO` | `front-end/html/coo/` |
| `Manager` | `front-end/html/manager/` |
| `Analyst` | `front-end/html/analyst/` |

In general, the Super User manages the platform, the COO works with organization
level data, Managers enter operational data and evidence, and Analysts review data
and prepare reports.


---

## Folder guide

```text
front-end/                Static pages, styles, scripts, and images
front-end/html/           Pages grouped by role
front-end/js/utils.js     Shared API, session, and local data logic
back-end/src/             NestJS modules, controllers, and services
back-end/src/common/      Shared DTOs, guards, middleware, filters, and logger
back-end/src/in-memory/   Entity definitions and seed data
back-end/docs/            Generated Swagger file
back-end/logs/            Runtime application and error logs
uploads/                  Files saved by upload endpoints
```

Most backend features follow the same pattern: a module, controller, service, and
DTOs. The main feature folders are authentication, users, organizations,
departments, submissions, reports, alerts, notifications, audit, resources,
factors, calculations, evidence, imports, revenue, and synchronization.

---

## Running it locally

From the repository root, install the packages and start the backend:

```powershell
npm install
npm --prefix back-end install
npm run start:backend
```

The useful URLs are:

- Frontend login: `http://127.0.0.1:3000/front-end/html/common/auth-login.html`
- Frontend root: `http://127.0.0.1:3000/front-end/`
- API: `http://127.0.0.1:3000/api`
- Swagger: `http://127.0.0.1:3000/api`

Build the backend with:

```powershell
npm run build:backend
```

For development with Nest watch mode:

```powershell
cd back-end
npm run start:dev
```

There is no plain `npm run build` command at the root. Use
`npm run build:backend` instead.

---

## How login works

The login form is in `front-end/html/common/auth-login.html`. It sends the email
and password to `POST /api/auth/login`.

After the backend accepts the credentials, the frontend checks that the account is
active, that its organization is active, and that maintenance mode is not blocking
that role. It then stores the user in browser `localStorage` and redirects to the
correct role dashboard.

The shared API code is in `front-end/js/utils.js`. When the frontend is opened on
another local port, it sends API requests to `http://127.0.0.1:3000`, which avoids
the common Live Server port mismatch.

---

## Middleware already in place

The middleware setup is in `back-end/src/app.module.ts` and `back-end/src/main.ts`.

### Logging

`ApiLoggerMiddleware` records each API request after it finishes. It includes the
method, URL, role, status code, duration, IP address, and user agent.

### Error handling

`HttpExceptionFilter` is registered globally. It turns thrown errors into a
consistent JSON response and writes the error details to the log files. Server
errors also include a stack trace in the log.

### File uploads

`back-end/src/common/middleware/file-upload.middleware.ts` contains the shared
Multer configuration. Uploaded files are saved in `uploads/`, filenames are cleaned
up and prefixed with a timestamp, and files are limited to 10 MB.

The supported upload types are PDF, JPEG, PNG, GIF, WebP, CSV, and Excel files.
The endpoints are:

- `POST /api/evidence/upload`
- `POST /api/imports/upload`

Both upload routes are currently available to `Super User` and `Manager` roles.

### Security and router middleware

The application uses Helmet, request body size limits, CORS, the global
`RolesGuard`, and an IP-based rate limiter. `AppModule.configure()` applies the
request logger to authentication and upload routes, and applies both the logger
and rate limiter to the remaining API routes.

---

## Logs

Winston writes daily rotating files under `back-end/logs/`:

- `app-YYYY-MM-DD.log` contains normal request and application entries.
- `errors-YYYY-MM-DD.log` contains warnings and errors.
- Older files are rotated and compressed according to the logger settings.

The log directory is created when the backend starts. Failed requests and
unexpected server errors can be checked there instead of relying only on the
terminal output.

---

## Where data comes from

The initial data is in `back-end/src/in-memory/seed.ts`. The shared runtime store
is `back-end/src/common/in-memory-store.service.ts`.

The frontend loads a snapshot through `GET /api/db` and can send updates through
`PUT /api/db/snapshot`. The API uses DTO validation with
`forbidNonWhitelisted: true`, so every collection included in a snapshot must be
listed in `SnapshotDto`.

---


## Quick verification

```powershell
npm run build:backend
```

The backend build passes. A valid login can be tested with the accounts above, and
request/error files should appear in `back-end/logs/` while the server is running.
