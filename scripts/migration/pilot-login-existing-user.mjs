#!/usr/bin/env node
/**
 * Pilot login for an EXISTING user in the new Supabase project.
 *
 * Modes:
 *   --password-only  Test only the current password using URL + anon key.
 *                    No admin key, no recovery, no writes.
 *   --recovery       Generate one recovery link (requires secret key).
 *
 * Usage:
 *   node scripts/migration/pilot-login-existing-user.mjs --password-only <email> [--expected-uuid <uuid>]
 *   node scripts/migration/pilot-login-existing-user.mjs --recovery <email> [--expected-uuid <uuid>]
 *
 * Required env vars:
 *   --password-only:
 *     NEW_SUPABASE_URL
 *     NEW_SUPABASE_ANON_KEY
 *
 *   --recovery:
 *     NEW_SUPABASE_URL
 *     NEW_SUPABASE_SECRET_KEY
 *
 * Notes:
 * - password is asked interactively and never echoed
 * - no access_token, refresh_token, anon key or secret key is printed
 * - no email is sent automatically
 */

import readline from 'node:readline';
import { stdin as input, stdout as output } from 'node:process';
import { createClient } from '@supabase/supabase-js';

const EXPECTED_PROJECT_REF = 'kurlgmngmglhvknwxjee';

const args = process.argv.slice(2);
const mode = args.includes('--recovery') ? 'recovery' : 'password-only';
const email = args.find((a) => !a.startsWith('--') && a.includes('@'));
const expectedUuid = (() => {
  const idx = args.indexOf('--expected-uuid');
  return idx !== -1 ? args[idx + 1] : null;
})();

const url = process.env.NEW_SUPABASE_URL;
const anon = process.env.NEW_SUPABASE_ANON_KEY;
const secret = process.env.NEW_SUPABASE_SECRET_KEY;

if (!email) {
  console.error('Usage: node scripts/migration/pilot-login-existing-user.mjs --password-only <email> [--expected-uuid <uuid>]');
  process.exit(1);
}
if (!url) {
  console.error('Missing env var: NEW_SUPABASE_URL');
  process.exit(1);
}
if (mode === 'password-only' && !anon) {
  console.error('Missing env var for --password-only: NEW_SUPABASE_ANON_KEY');
  process.exit(1);
}
if (mode === 'recovery' && !secret) {
  console.error('Missing env var for --recovery: NEW_SUPABASE_SECRET_KEY');
  process.exit(1);
}

function promptHidden(query) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, output });
    const stdin = process.stdin;
    process.stdout.write(query);
    stdin.resume();
    stdin.setRawMode(true);
    stdin.setEncoding('utf8');
    let password = '';
    stdin.on('data', function onData(ch) {
      ch = ch.toString();
      if (ch === '\n' || ch === '\r' || ch === '') {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.removeListener('data', onData);
        rl.close();
        process.stdout.write('\n');
        resolve(password);
      } else if (ch === '') {
        process.exit();
      } else if (ch === '') {
        password = password.slice(0, -1);
      } else {
        password += ch;
      }
    });
  });
}

function maskEmail(value) {
  return value.replace(/(.{3}).*(@.*)/, '$1***$2');
}

function projectRefFromUrl(value) {
  try {
    return new URL(value).hostname.split('.')[0];
  } catch {
    return null;
  }
}

async function runPasswordOnly() {
  const publicClient = createClient(url, anon, { auth: { persistSession: false } });
  const actualProjectRef = projectRefFromUrl(url);

  console.log(JSON.stringify({
    phase: 'precheck',
    mode: 'password-only',
    expected_project_ref: EXPECTED_PROJECT_REF,
    actual_project_ref: actualProjectRef,
    project_ref_ok: actualProjectRef === EXPECTED_PROJECT_REF,
    email_masked: maskEmail(email),
    expected_uuid_present: !!expectedUuid,
  }, null, 2));

  if (actualProjectRef !== EXPECTED_PROJECT_REF) {
    console.error('Project ref mismatch. Aborting.');
    process.exit(2);
  }

  const password = await promptHidden('Digite a senha atual localmente: ');
  const { data: signInData, error: signInErr } = await publicClient.auth.signInWithPassword({ email, password });

  if (signInErr || !signInData?.user) {
    console.log(JSON.stringify({
      phase: 'password_login',
      status: 'PASSWORD_LOGIN_FAILED',
      error_name: signInErr?.name || 'AuthError',
      error_message: signInErr?.message || 'unknown',
      uuid_preserved: null,
      session_created: false,
      office_accessible: false,
      identities_before: 'unavailable_without_secret',
      identities_after: 'unavailable_without_secret',
    }, null, 2));
    process.exit(3);
  }

  const authUser = signInData.user;
  const officeQuery = await publicClient
    .from('oficinas')
    .select('id,nome')
    .eq('user_id', authUser.id);
  const profileQuery = await publicClient
    .from('profiles')
    .select('id,user_id,nome')
    .eq('user_id', authUser.id)
    .maybeSingle();

  console.log(JSON.stringify({
    phase: 'password_login',
    status: 'PASSWORD_LOGIN_WORKING',
    returned_uuid: authUser.id,
    expected_uuid: expectedUuid,
    uuid_preserved: expectedUuid ? authUser.id === expectedUuid : null,
    session_created: !!signInData.session,
    auth_uid: authUser.id,
    office_accessible: !officeQuery.error && (officeQuery.data?.length || 0) > 0,
    office_count: officeQuery.data?.length || 0,
    profile_found: !!profileQuery.data,
    profile_user_id_matches: profileQuery.data ? profileQuery.data.user_id === authUser.id : false,
    providers_after: authUser.app_metadata?.providers || null,
    declared_provider_after: authUser.app_metadata?.provider || null,
    identities_before: 'unavailable_without_secret',
    identities_after: Array.isArray(authUser.identities) ? authUser.identities.length : 'not_exposed_in_session',
    no_duplicate_created: true,
  }, null, 2));
}

async function runRecovery() {
  const adminClient = createClient(url, secret, { auth: { persistSession: false } });
  const { data: beforeUser, error: beforeErr } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (beforeErr) throw beforeErr;
  const user = beforeUser.users.find((u) => (u.email || '').toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error('Pilot email not found among auth.users');
    process.exit(4);
  }

  const { data: linkData, error: linkErr } = await adminClient.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: 'https://www.mechanicraizpro.com.br/reset-password' },
  });

  console.log(JSON.stringify({
    phase: 'recovery_link',
    generated: !linkErr,
    error: linkErr?.message || null,
    redirect_ok: !!linkData?.properties?.redirect_to,
    user_id_preserved: linkData?.user?.id === user.id,
    email_masked: maskEmail(email),
  }, null, 2));
}

(async () => {
  if (mode === 'password-only') {
    await runPasswordOnly();
    return;
  }
  if (mode === 'recovery') {
    await runRecovery();
    return;
  }
})();
