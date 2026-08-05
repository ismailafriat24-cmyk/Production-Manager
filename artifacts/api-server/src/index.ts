import app from "./app";
import { logger } from "./lib/logger";
import { pool } from "./lib/db.js";

// Run safe schema migrations on startup
async function migrate() {
  // ── Core tables ──────────────────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id              TEXT    PRIMARY KEY,
      join_code       TEXT    NOT NULL UNIQUE,
      boss_name       TEXT    NOT NULL,
      boss_email      TEXT    NOT NULL DEFAULT '',
      boss_password   TEXT    NOT NULL DEFAULT '',
      clerk_user_id   TEXT    DEFAULT NULL,
      subscription_seen BOOLEAN NOT NULL DEFAULT false,
      created_at      BIGINT  NOT NULL
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS workspaces_clerk_user_id_idx ON workspaces (clerk_user_id)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chefs (
      id          TEXT    PRIMARY KEY,
      workspace_id TEXT   NOT NULL DEFAULT '',
      join_code   TEXT    NOT NULL,
      name        TEXT    NOT NULL,
      email       TEXT    NOT NULL,
      password    TEXT    NOT NULL DEFAULT '',
      chef_order  INTEGER NOT NULL DEFAULT 0,
      daily_target INTEGER DEFAULT NULL,
      created_at  BIGINT  NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS work_sessions (
      id          TEXT    PRIMARY KEY,
      workspace_id TEXT   NOT NULL DEFAULT '',
      join_code   TEXT    NOT NULL,
      user_id     TEXT    NOT NULL,
      role        TEXT    NOT NULL,
      check_in_at BIGINT  NOT NULL,
      check_out_at BIGINT DEFAULT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS productions (
      id            TEXT    PRIMARY KEY,
      workspace_id  TEXT    NOT NULL DEFAULT '',
      join_code     TEXT    NOT NULL,
      chef_id       TEXT    NOT NULL,
      chef_name     TEXT    NOT NULL DEFAULT '',
      items         JSONB   NOT NULL DEFAULT '[]',
      created_at    BIGINT  NOT NULL,
      editable_until BIGINT NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS problems (
      id            TEXT    PRIMARY KEY,
      workspace_id  TEXT    NOT NULL DEFAULT '',
      join_code     TEXT    NOT NULL,
      chef_id       TEXT    NOT NULL,
      chef_name     TEXT    NOT NULL DEFAULT '',
      type          TEXT    NOT NULL DEFAULT '',
      note          TEXT    NOT NULL DEFAULT '',
      stopped_at    BIGINT  NOT NULL DEFAULT 0,
      resumed_at    BIGINT  NOT NULL DEFAULT 0,
      created_at    BIGINT  NOT NULL,
      editable_until BIGINT NOT NULL DEFAULT 0
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS objectives (
      id          TEXT    PRIMARY KEY,
      workspace_id TEXT   NOT NULL DEFAULT '',
      join_code   TEXT    NOT NULL,
      texts       JSONB   NOT NULL DEFAULT '[]',
      date        TEXT    NOT NULL,
      created_at  BIGINT  NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS reminders (
      id          TEXT    PRIMARY KEY,
      workspace_id TEXT   NOT NULL DEFAULT '',
      join_code   TEXT    NOT NULL,
      message     TEXT    NOT NULL DEFAULT '',
      created_at  BIGINT  NOT NULL,
      seen_by     JSONB   NOT NULL DEFAULT '[]'
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS call_requests (
      id          TEXT    PRIMARY KEY,
      workspace_id TEXT   NOT NULL DEFAULT '',
      join_code   TEXT    NOT NULL,
      chef_id     TEXT    NOT NULL,
      chef_name   TEXT    NOT NULL DEFAULT '',
      created_at  BIGINT  NOT NULL,
      seen        BOOLEAN NOT NULL DEFAULT false
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS password_resets (
      id          TEXT    PRIMARY KEY,
      workspace_id TEXT   NOT NULL DEFAULT '',
      join_code   TEXT    NOT NULL,
      code        TEXT    NOT NULL,
      expires_at  BIGINT  NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_tokens (
      user_id      TEXT    NOT NULL,
      join_code    TEXT    NOT NULL,
      workspace_id TEXT    NOT NULL DEFAULT '',
      role         TEXT    NOT NULL,
      token        TEXT    NOT NULL,
      updated_at   BIGINT  NOT NULL,
      PRIMARY KEY (user_id, join_code)
    )
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS push_tokens_join_code_role_idx ON push_tokens (join_code, role)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invite_tokens (
      token       TEXT    PRIMARY KEY,
      join_code   TEXT    NOT NULL,
      created_at  BIGINT  NOT NULL,
      used        BOOLEAN NOT NULL DEFAULT false
    )
  `);

  // ── ADD COLUMN IF NOT EXISTS — fills gaps in pre-existing tables ─────────────
  await pool.query(`ALTER TABLE workspaces    ADD COLUMN IF NOT EXISTS clerk_user_id       TEXT    DEFAULT NULL`);
  await pool.query(`ALTER TABLE workspaces    ADD COLUMN IF NOT EXISTS subscription_seen   BOOLEAN NOT NULL DEFAULT false`);
  await pool.query(`ALTER TABLE workspaces    ADD COLUMN IF NOT EXISTS boss_email          TEXT    NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE workspaces    ADD COLUMN IF NOT EXISTS boss_password       TEXT    NOT NULL DEFAULT ''`);

  await pool.query(`ALTER TABLE chefs         ADD COLUMN IF NOT EXISTS workspace_id        TEXT    NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE chefs         ADD COLUMN IF NOT EXISTS chef_order          INTEGER NOT NULL DEFAULT 0`);
  await pool.query(`ALTER TABLE chefs         ADD COLUMN IF NOT EXISTS daily_target        INTEGER DEFAULT NULL`);
  await pool.query(`ALTER TABLE chefs         ADD COLUMN IF NOT EXISTS password            TEXT    NOT NULL DEFAULT ''`);

  await pool.query(`ALTER TABLE work_sessions ADD COLUMN IF NOT EXISTS workspace_id        TEXT    NOT NULL DEFAULT ''`);

  await pool.query(`ALTER TABLE productions   ADD COLUMN IF NOT EXISTS workspace_id        TEXT    NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE productions   ADD COLUMN IF NOT EXISTS chef_name           TEXT    NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE productions   ADD COLUMN IF NOT EXISTS editable_until      BIGINT  NOT NULL DEFAULT 0`);

  await pool.query(`ALTER TABLE problems      ADD COLUMN IF NOT EXISTS workspace_id        TEXT    NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE problems      ADD COLUMN IF NOT EXISTS chef_name           TEXT    NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE problems      ADD COLUMN IF NOT EXISTS editable_until      BIGINT  NOT NULL DEFAULT 0`);

  await pool.query(`ALTER TABLE objectives    ADD COLUMN IF NOT EXISTS workspace_id        TEXT    NOT NULL DEFAULT ''`);

  await pool.query(`ALTER TABLE reminders     ADD COLUMN IF NOT EXISTS workspace_id        TEXT    NOT NULL DEFAULT ''`);
  await pool.query(`ALTER TABLE reminders     ADD COLUMN IF NOT EXISTS seen_by             JSONB   NOT NULL DEFAULT '[]'`);

  await pool.query(`ALTER TABLE push_tokens   ADD COLUMN IF NOT EXISTS workspace_id        TEXT    NOT NULL DEFAULT ''`);

  logger.info("DB migrations applied");
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

migrate().then(() => {
  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
});
