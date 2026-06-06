# Routes

This folder uses TanStack Router file-based routing. Routes:

- `index.tsx` — splash/redirect (auth → dashboard, anon → /auth)
- `auth.tsx` — login + first-admin bootstrap
- `_authenticated/route.tsx` — auth gate layout (ssr off)
- `_authenticated/dashboard.tsx` — main dashboard
- `_authenticated/projects/` — projects list, detail, new
- `_authenticated/tasks/$taskId.tsx` — task detail
- `_authenticated/employees.tsx` — admin: employee CRUD
- `_authenticated/templates.tsx` — admin: workflow template CRUD
- `_authenticated/my-tasks.tsx` — employee tasks view
- `_authenticated/settings.tsx` — personal settings
- `api/public/setup/` — first-admin bootstrap endpoints
- `api/public/notifications/dispatch.ts` — cron-triggered notification dispatcher
