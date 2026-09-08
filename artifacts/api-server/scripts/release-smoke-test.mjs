const configuredDomain =
  process.env.EXPO_PUBLIC_DOMAIN || process.env.API_DOMAIN || "";
const joinCode = process.env.SMOKE_JOIN_CODE?.trim();
const email = process.env.SMOKE_EMAIL?.trim();
const password = process.env.SMOKE_PASSWORD;

if (!configuredDomain || !joinCode || !email || !password) {
  throw new Error(
    "Set EXPO_PUBLIC_DOMAIN (or API_DOMAIN), SMOKE_JOIN_CODE, SMOKE_EMAIL, and SMOKE_PASSWORD.",
  );
}

const apiOrigin = /^https?:\/\//i.test(configuredDomain)
  ? configuredDomain
  : `https://${configuredDomain}`;
const parsedOrigin = new URL(apiOrigin).origin;

if (
  parsedOrigin.includes("localhost") ||
  parsedOrigin.includes("127.0.0.1") ||
  parsedOrigin.includes(".replit.dev")
) {
  throw new Error(
    "Release smoke tests must target the published HTTPS API, not a local or Replit development host.",
  );
}

const apiBase = `${parsedOrigin}/api`;
const workspaceHeaders = {
  "Content-Type": "application/json",
  "X-Workspace-Code": joinCode,
};

async function readJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}

async function request(path, options) {
  const response = await fetch(`${apiBase}${path}`, options);
  const body = await readJson(response);
  if (!response.ok) {
    const message =
      body && typeof body.error === "string" ? body.error : `HTTP ${response.status}`;
    throw new Error(`${options.method || "GET"} ${path} failed: ${message}`);
  }
  return body;
}

const health = await request("/healthz", { method: "GET" });
if (health?.status !== "ok") {
  throw new Error("Published API health check did not return status=ok.");
}

const login = await request("/workspace/login-boss", {
  method: "POST",
  headers: workspaceHeaders,
  body: JSON.stringify({ email, password }),
});
if (login?.ok !== true) {
  throw new Error("Published API sign-in did not return ok=true.");
}

const sync = await request("/sync?today=1", {
  method: "GET",
  headers: workspaceHeaders,
});
const requiredCollections = [
  "chefs",
  "workSessions",
  "productions",
  "problems",
  "objectives",
  "reminders",
  "calls",
];
for (const collection of requiredCollections) {
  if (!Array.isArray(sync?.[collection])) {
    throw new Error(`Published API sync response is missing array: ${collection}.`);
  }
}

console.log(
  `Release smoke test passed against ${parsedOrigin}: health, sign-in, and sync.`,
);