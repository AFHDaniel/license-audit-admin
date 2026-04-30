# Application Tracker

Atlanta Fine Homes' internal admin dashboard for tracking SaaS applications, license spend, and renewals across departments. Records live on a few Monday.com boards; this app reads them, normalizes the shape, and gives stakeholders a place to review upcoming renewals, drill into department spend, and edit a record without opening Monday.

## Stack

- React 19 + TypeScript, Vite, Tailwind v4
- React Router 7, framer-motion
- Recharts for analytics
- Okta (OIDC + PKCE) for frontend auth
- Node 22 reverse proxy (`server/mondayProxy.mjs`) wrapping the Monday GraphQL API
- Azure App Service (Linux, Node 22) behind a custom domain

## What it does

- Syncs inventory from multiple Monday boards on a 30s interval
- Department-aware scoping (each board maps to a department)
- Co-owner sharing so a user outside a department can still see records they own
- Click-through filters from the dashboard into a multi-select inventory view
- Sortable, paginated inventory table with quick filters and saved drilldowns
- Renewal write-back: edit terms in the dashboard, type-aware Monday payloads (`text` / `numbers` / `date` / `status` / `dropdown`), single-item refetch after the write
- Analytics: org-wide and per-department views, renewal runway, data quality flags, top upcoming renewals
- Light + dark mode (HSL token system, persists per user)

## Local setup

Two processes: Vite frontend on `:3000`, Monday proxy on `:8787`. Vite proxies `/api/*` to the proxy.

```bash
npm install
cp .env.example .env.local   # fill in MONDAY_API_TOKEN + Okta values
npm run dev
```

The proxy expects `MONDAY_API_TOKEN` plus a board id list and a JSON `MONDAY_BOARD_DEPARTMENT_MAP` so it knows which board is which department.

```bash
curl http://localhost:8787/api/health
curl http://localhost:8787/api/licenses | jq '.licenses | length'
```

## Build and test

```bash
npm run build
npm test
```

In production, `node server/mondayProxy.mjs` with `NODE_ENV=production` serves both the SPA and `/api/*` from the same process.

## A few notes on the design

**Monday is the source of truth.** Renewal edits go to Monday first; the app waits on a single-item refetch before patching its cache. No write that succeeds in the UI but fails in Monday.

**Type-aware write-back.** `change_multiple_column_values` expects different payload shapes per column type. The proxy inspects column type before sending: `{ date: "YYYY-MM-DD" }` for date columns, `{ label: "..." }` for status, plain strings for text, etc.

**Targeted cache invalidation.** A successful write refetches only the touched item via `items(ids: [...])` and patches the in-memory cache, instead of triggering a 9-board re-sync.

**One filter engine.** `utils/inventoryView.ts` is the single function that decides which licenses match a filter set. The inventory table, dashboard drilldowns, and CSV export all call it.

**Access on one predicate.** A user can see a record because their grant covers its department, or because they're listed as a co-owner. Both paths run through `canAccessLicense()`.

## Not in scope here

- Server-side auth on `/api/*` (department scoping currently runs on the client)
- Email reminders (cadence helpers are written; the Azure Function + ACS path is documented but not built)
- Monday webhook signature verification

## License

MIT.
