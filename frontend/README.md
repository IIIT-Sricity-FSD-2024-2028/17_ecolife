# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and Oxlint's TypeScript related rules in your project.


## UI conventions

- **Icons** come from [`lucide-react`](https://lucide.dev). Pass a component to `Button`'s `icon`, `CardHeader`/`SummaryCard`/`Tabs`/`PageHeader`/`EmptyState`, or add `icon` to a nav item in `utils/permissions.js`.
- **Confirmations**: `const confirm = useConfirm()` (from `components/shared/ConfirmProvider`), then
  `if (!(await confirm({ title, message, confirmLabel, danger, icon }))) return;` before any action that changes data for others, is hard to undo, or sends something for approval.
- **Topbar**: brand, notifications bell (derived from open alerts / pending approvals / platform warnings in `hooks/useNotifications.js`), and a profile menu (Profile, Log out).
