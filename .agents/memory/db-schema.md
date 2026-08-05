---
name: DB Schema Approach
description: How the database schema is managed in this project — raw SQL, no Drizzle ORM.
---

## Rule

This project uses raw `pg` Pool queries, NOT Drizzle ORM, even though `lib/db` exists in the workspace template. All schema is defined via raw SQL executed at startup in `artifacts/api-server/src/index.ts` `migrate()`.

**Why:** The original app was built with raw pg for simplicity and directness. The `lib/db` and `lib/api-spec` packages from the monorepo template are present but unused for the core app logic.

**How to apply:** To add a new table: add a `CREATE TABLE IF NOT EXISTS` statement inside the `migrate()` function in `artifacts/api-server/src/index.ts`. To add a column: use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Do not use drizzle-orm imports or Drizzle schema files for this app.

## Tables

workspaces, chefs, work_sessions, productions, problems, objectives, reminders, calls, password_resets, push_tokens, invites

All tables carry `join_code` as a multi-tenant scoping key.
