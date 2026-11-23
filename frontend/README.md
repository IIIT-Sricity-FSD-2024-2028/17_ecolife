# Tropos Frontend

React 19 + Vite + Tailwind CSS 4 app for Tropos, organised around the monthly cycle: Set up, Collect, Review, Close, Report, Verify.

## Structure
- `src/actors/` pages grouped by who uses them: `public`, `shared`, `plant-manager`, `sustainability-lead`, `finance-manager`, `executive-approver`, `internal-auditor`, `external-verifier`, `org-admin`, `platform-admin`, `external-supplier`
- `src/components/ui/` the shared kit: buttons, form fields, dialogs, and `DataGrid` (server-side paging, search, export)
- `src/config/actorNavigation.js` the menu for each role; items can be hidden by the company's chosen tracking areas
- `src/hooks`, `src/context`, `src/services/apiClient.js` data loading, sign-in state and the API client
- Lists, options and limits come from the backend (`/meta/options`, `/meta/public`), not from hardcoded values

## Run
```bash
cp .env.example .env
npm ci
npm run dev      # http://localhost:5173, proxies /api to http://localhost:4000
npm run build
```
