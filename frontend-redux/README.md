# Tropos Frontend

React 19 + Vite + Tailwind CSS 4 app for Tropos, organised around the monthly cycle: Set up, Collect, Review, Close, Report, Verify.

## Structure
- `src/actors/` pages grouped by who uses them: `public`, `shared`, `plant-manager`, `sustainability-lead`, `finance-manager`, `executive-approver`, `internal-auditor`, `external-verifier`, `org-admin`, `platform-admin`, `external-supplier`
- `src/components/` `ui` (buttons, form fields, dialogs, `DataGrid`), `charts`, `shell` (search bar, notifications, app frame parts) and `dataEntry` (log workbench, bill reader)
- `src/app/` `routes`, `layouts` and `navigation.js`, the menu for each role (items can be hidden by the company's chosen tracking areas)
- `src/store/` Redux Toolkit: `resourceSlice.js` builds the common CRUD slice, and `slices/` holds one slice per backend resource in nine area folders (`app`, `workspace`, `dataCollection`, `monthEnd`, `planning`, `valueChain`, `finance`, `assurance`, `platform`), each listed in that folder's `index.js`
- `src/hooks`, `src/context`, `src/services/apiClient.js` data loading, sign-in state and the API client
- Lists, options and limits come from the backend (`/meta/options`, `/meta/public`), not from hardcoded values

## Run
```bash
cp .env.example .env
npm ci
npm run dev      # http://localhost:5173, proxies /api to http://localhost:4000
npm run build
```
