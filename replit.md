# Chef Production Tracker

A production management app for factory/workshop floors. Managers (bosses) monitor live operator status, set daily objectives, view production submissions and problems, and download PDF reports. Operators (chefs) check in/out, submit production quantities, and report problems.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/chef-track run dev` — run the Expo mobile app (port 24199)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks/Zod schemas
- Required env: `DATABASE_URL` — Postgres connection string
- Required env: `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` — Replit-managed Clerk (Google SSO for managers)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Mobile: Expo / React Native (expo-router)
- API: Express 5 + raw pg pool
- DB: PostgreSQL (raw SQL, no Drizzle ORM — schema via pool.query in index.ts)
- Auth: Replit-managed Clerk (Google SSO for bosses), email+password for chefs
- Build: esbuild (API), Metro (Expo)

## Where things live

- `artifacts/chef-track/` — Expo mobile app
  - `app/boss.tsx` — Manager dashboard
  - `app/chef.tsx` — Operator dashboard
  - `contexts/AppContext.tsx` — Global state + polling (5s interval)
  - `lib/api.ts` — All API calls + type definitions
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/db.ts` — pg Pool + makeId()
- `lib/api-spec/openapi.yaml` — OpenAPI spec (health only; main API is route-based)

## Database tables (raw SQL)

workspaces, chefs, work_sessions, productions, problems, objectives, reminders, calls, password_resets, push_tokens, invites

## Architecture decisions

- Raw `pg` pool instead of Drizzle ORM — keeps runtime small and routes explicit
- 5-second polling instead of WebSockets — simpler, works on all network conditions
- Join-code workspace scoping — all tables carry `join_code` as a tenant key
- Clerk Google SSO for managers only; chefs use simple email/password
- 15-minute edit window for production submissions and problem reports

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- The `.env` in chef-track was removed — `EXPO_PUBLIC_DOMAIN` is injected by the workflow
- DB schema is created via raw SQL in `artifacts/api-server/src/index.ts` migrate() + startup queries
- The `attached_assets/artifacts-extracted/` directory contains the original source zip — safe to delete once confirmed working
