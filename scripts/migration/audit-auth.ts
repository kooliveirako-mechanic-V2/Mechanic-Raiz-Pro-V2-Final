/**
 * Auth Parity Audit Script
 * Reads from both Supabase projects (read-only) and compares auth state.
 *
 * Usage:
 *   deno run --allow-env --allow-net scripts/migration/audit-auth.ts
 *
 * Required env vars:
 *   OLD_SUPABASE_URL=https://cuhkkoqqeguascdsvtky.supabase.co
 *   OLD_SERVICE_ROLE_KEY=<old service role key>
 *   NEW_SUPABASE_URL=https://kurlgmngmglhvknwxjee.supabase.co
 *   NEW_SERVICE_ROLE_KEY=<new service role key>
 *   DRY_RUN=true (default: true — never writes anything)
 *
 * Output:
 *   reports/migration/auth-parity.md
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const OLD_URL = Deno.env.get("OLD_SUPABASE_URL") ?? "";
const OLD_KEY = Deno.env.get("OLD_SERVICE_ROLE_KEY") ?? "";
const NEW_URL = Deno.env.get("NEW_SUPABASE_URL") ?? "";
const NEW_KEY = Deno.env.get("NEW_SERVICE_ROLE_KEY") ?? "";
const DRY_RUN = Deno.env.get("DRY_RUN") !== "false";

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error("Missing required env vars. See script header for details.");
  Deno.exit(1);
}

const oldClient = createClient(OLD_URL, OLD_KEY, { auth: { persistSession: false } });
const newClient = createClient(NEW_URL, NEW_KEY, { auth: { persistSession: false } });

interface UserRow {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  has_password: boolean;
  banned: boolean;
  deleted: boolean;
}

interface IdentityRow {
  user_id: string;
  provider: string;
  provider_id: string;
}

async function listUsers(client: ReturnType<typeof createClient>): Promise<UserRow[]> {
  const results: UserRow[] = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`listUsers page ${page}: ${error.message}`);
    if (!data.users.length) break;
    for (const u of data.users) {
      results.push({
        id: u.id,
        email: u.email ?? "",
        email_confirmed_at: u.email_confirmed_at ?? null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        has_password: !!(u as { encrypted_password?: string }).encrypted_password,
        banned: !!(u as { banned_until?: string }).banned_until,
        deleted: !!(u as { deleted_at?: string }).deleted_at,
      });
    }
    if (data.users.length < perPage) break;
    page++;
  }
  return results;
}

async function listIdentities(client: ReturnType<typeof createClient>, projectUrl: string, serviceKey: string): Promise<IdentityRow[]> {
  // Auth Admin API does not expose identities via JS SDK — query directly via REST
  const resp = await fetch(`${projectUrl}/auth/v1/admin/users?page=1&per_page=9999`, {
    headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey },
  });
  if (!resp.ok) {
    console.warn("Could not fetch identities via REST:", resp.status);
    return [];
  }
  const data = await resp.json();
  const rows: IdentityRow[] = [];
  for (const u of (data.users ?? [])) {
    for (const id of (u.identities ?? [])) {
      rows.push({ user_id: u.id, provider: id.provider, provider_id: id.id });
    }
  }
  return rows;
}

console.log("Fetching users from OLD project...");
const oldUsers = await listUsers(oldClient);
console.log(`OLD: ${oldUsers.length} users`);

console.log("Fetching users from NEW project...");
const newUsers = await listUsers(newClient);
console.log(`NEW: ${newUsers.length} users`);

const oldById = new Map(oldUsers.map(u => [u.id, u]));
const newById = new Map(newUsers.map(u => [u.id, u]));

const missingInNew = oldUsers.filter(u => !newById.has(u.id));
const extraInNew   = newUsers.filter(u => !oldById.has(u.id));
const uuidMatch    = oldUsers.filter(u => newById.has(u.id));

const noPasswordInNew = uuidMatch.filter(u => {
  const nu = newById.get(u.id)!;
  return u.has_password && !nu.has_password;
});

// Fetch identities
const oldIdentities = await listIdentities(oldClient, OLD_URL, OLD_KEY);
const newIdentities = await listIdentities(newClient, NEW_URL, NEW_KEY);
const newIdSet = new Set(newIdentities.map(i => `${i.user_id}:${i.provider}`));
const missingIdentities = oldIdentities.filter(i => !newIdSet.has(`${i.user_id}:${i.provider}`));

// Build report
const lines: string[] = [
  "# Auth Parity Report",
  `Generated: ${new Date().toISOString()}`,
  `OLD project: ${OLD_URL}`,
  `NEW project: ${NEW_URL}`,
  "",
  "## Summary",
  `| Item | OLD | NEW |`,
  `|------|-----|-----|`,
  `| Total users | ${oldUsers.length} | ${newUsers.length} |`,
  `| UUID match | — | ${uuidMatch.length} |`,
  `| Missing in NEW | — | ${missingInNew.length} |`,
  `| Extra in NEW (not in OLD) | — | ${extraInNew.length} |`,
  `| Users missing password hash in NEW | — | ${noPasswordInNew.length} |`,
  `| Identities (OAuth) in OLD | ${oldIdentities.length} | — |`,
  `| Missing identities in NEW | — | ${missingIdentities.length} |`,
  "",
];

if (missingInNew.length) {
  lines.push("## Users missing in NEW (by UUID)");
  lines.push("| UUID | Email | Has Password | Provider |");
  lines.push("|------|-------|-------------|---------|");
  for (const u of missingInNew) {
    const provider = oldIdentities.find(i => i.user_id === u.id)?.provider ?? "email";
    lines.push(`| ${u.id} | ${u.email} | ${u.has_password} | ${provider} |`);
  }
  lines.push("");
}

if (noPasswordInNew.length) {
  lines.push("## Users in NEW without password hash (had one in OLD)");
  lines.push("These users will NOT be able to log in with email/password.");
  lines.push("| UUID | Email |");
  lines.push("|------|-------|");
  for (const u of noPasswordInNew) {
    lines.push(`| ${u.id} | ${u.email} |`);
  }
  lines.push("");
}

if (missingIdentities.length) {
  lines.push("## OAuth identities missing in NEW");
  lines.push("| User ID | Provider |");
  lines.push("|---------|---------|");
  for (const i of missingIdentities) {
    lines.push(`| ${i.user_id} | ${i.provider} |`);
  }
  lines.push("");
}

lines.push("## Integrity check");
lines.push(`- Users with UUID match: ${uuidMatch.length}/${oldUsers.length}`);
lines.push(`- DRY_RUN mode: ${DRY_RUN} (no writes performed)`);

const report = lines.join("\n");
await Deno.writeTextFile("reports/migration/auth-parity.md", report);
console.log("Report written to reports/migration/auth-parity.md");
console.log(`\nSummary: ${uuidMatch.length} matched, ${missingInNew.length} missing, ${noPasswordInNew.length} missing passwords, ${missingIdentities.length} missing identities`);
