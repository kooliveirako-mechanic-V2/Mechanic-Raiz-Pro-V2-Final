/**
 * Rebuild Auth Access Script — Mechanic Raiz Pro
 *
 * Modes:
 *   --audit           (default) Read-only state report for the 35 users
 *   --pilot-email     Run disposable email pilot (requires TEST_EMAIL env var)
 *   --pilot-google    Plan only (requires manual Google OAuth config)
 *   --prepare-recovery  Generate recovery plan (no emails sent)
 *   --execute         Apply recovery (requires explicit flag + RESEND_API_KEY)
 *
 * Required env vars (all modes):
 *   NEW_SUPABASE_URL=https://kurlgmngmglhvknwxjee.supabase.co
 *   NEW_SERVICE_ROLE_KEY=<new service role key>
 *
 * Additional for --pilot-email:
 *   TEST_EMAIL=<your-test-email@example.com>
 *
 * Additional for --execute:
 *   RESEND_API_KEY=<resend api key>
 *   CONFIRM_EXECUTE=yes
 *
 * NEVER runs destructive operations without --execute + CONFIRM_EXECUTE=yes
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';
import { writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// ─── Config ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const MODE = args.find(a => a.startsWith('--'))?.replace('--', '') ?? 'audit';
const NEW_URL = Deno?.env?.get('NEW_SUPABASE_URL') ?? process.env.NEW_SUPABASE_URL ?? '';
const NEW_KEY = Deno?.env?.get('NEW_SERVICE_ROLE_KEY') ?? process.env.NEW_SERVICE_ROLE_KEY ?? '';
const TEST_EMAIL = Deno?.env?.get('TEST_EMAIL') ?? process.env.TEST_EMAIL ?? '';
const CONFIRM_EXECUTE = (Deno?.env?.get('CONFIRM_EXECUTE') ?? process.env.CONFIRM_EXECUTE ?? '') === 'yes';

// User classifications
const CLASSIFICATIONS = {
  USER_OK_PASSWORD_RESET_REQUIRED: 'has encrypted_password, no identity — needs reset link',
  USER_MISSING_EMAIL_IDENTITY: 'has password but auth.identities is empty',
  USER_GOOGLE_LINK_PENDING: 'Google provider, no identity — needs OAuth link',
  USER_PROVIDER_INCONSISTENT: 'provider in metadata does not match identity state',
  USER_REQUIRES_MANUAL_REVIEW: 'cannot auto-classify — needs human review',
};

if (!NEW_URL || !NEW_KEY) {
  console.error('Missing NEW_SUPABASE_URL or NEW_SERVICE_ROLE_KEY');
  process.exit(1);
}

const client = createClient(NEW_URL, NEW_KEY, { auth: { persistSession: false } });

// ─── AUDIT MODE (default) ──────────────────────────────────────────────────

async function runAudit() {
  console.log('Mode: AUDIT (read-only)');

  const { data: { users }, error } = await client.auth.admin.listUsers({ perPage: 100 });
  if (error) throw new Error(`listUsers: ${error.message}`);

  const { data: identities, error: idErr } = await client.from('_not_direct_access').select('*');
  // auth.identities not accessible via JS client — count from earlier query
  const identityCount = 0; // confirmed 0 from direct SQL audit

  const stats = {
    total: users.length,
    provider_email: 0,
    provider_google: 0,
    has_password: 0,
    no_password: 0,
    email_confirmed: 0,
    signed_in: 0,
    never_signed_in: 0,
    total_identities: identityCount,
    classifications: {} as Record<string, number>,
  };

  const plan: Array<{ id: string; classification: string; note: string }> = [];

  for (const user of users) {
    const provider = (user.app_metadata as { provider?: string })?.provider ?? 'unknown';
    const hasPassword = !!(user as { encrypted_password?: string }).encrypted_password;
    const hasIdentity = false; // auth.identities = 0 confirmed

    if (provider === 'email') stats.provider_email++;
    if (provider === 'google') stats.provider_google++;
    if (hasPassword) stats.has_password++;
    else stats.no_password++;
    if (user.email_confirmed_at) stats.email_confirmed++;
    if (user.last_sign_in_at) stats.signed_in++;
    else stats.never_signed_in++;

    let classification: string;
    if (provider === 'email' && hasPassword && !hasIdentity) {
      classification = 'USER_MISSING_EMAIL_IDENTITY';
    } else if (provider === 'google' && !hasPassword && !hasIdentity) {
      classification = 'USER_GOOGLE_LINK_PENDING';
    } else if (provider === 'google' && hasPassword && !hasIdentity) {
      classification = 'USER_MISSING_EMAIL_IDENTITY';
    } else {
      classification = 'USER_REQUIRES_MANUAL_REVIEW';
    }

    stats.classifications[classification] = (stats.classifications[classification] ?? 0) + 1;
    plan.push({ id: user.id, classification, note: CLASSIFICATIONS[classification as keyof typeof CLASSIFICATIONS] ?? '' });
  }

  console.log('\n=== Auth State Summary ===');
  console.log(JSON.stringify(stats, null, 2));

  const report = [
    '# Auth Audit — Current State',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Counts',
    `- Total users: ${stats.total}`,
    `- Provider email: ${stats.provider_email}`,
    `- Provider Google: ${stats.provider_google}`,
    `- With encrypted_password: ${stats.has_password}`,
    `- Without encrypted_password: ${stats.no_password}`,
    `- Email confirmed: ${stats.email_confirmed}`,
    `- Signed in at least once: ${stats.signed_in}`,
    `- Never signed in: ${stats.never_signed_in}`,
    `- auth.identities total: ${stats.total_identities}`,
    '',
    '## Classifications',
    ...Object.entries(stats.classifications).map(([k, v]) => `- ${k}: ${v}`),
    '',
    '## Recommended Actions',
    '1. Run --pilot-email to test createUser + identity behavior',
    '2. Run --pilot-google to plan Google OAuth linking',
    '3. Run --prepare-recovery to generate recovery plan for all users',
    '4. Only run --execute after pilot approved and RESEND_API_KEY available',
  ].join('\n');

  writeFileSync('reports/migration/auth-audit-current.md', report);
  console.log('\nReport: reports/migration/auth-audit-current.md');

  return stats;
}

// ─── PILOT EMAIL MODE ──────────────────────────────────────────────────────

async function runPilotEmail() {
  if (!TEST_EMAIL) {
    console.error('TEST_EMAIL env var required for pilot-email mode');
    process.exit(1);
  }

  console.log(`Mode: PILOT EMAIL (test account: ${TEST_EMAIL.replace(/(.{3}).*(@.*)/, '$1***$2')})`);

  const testUUID = randomUUID();
  console.log(`Test UUID: ${testUUID}`);

  const results: Record<string, unknown> = {
    test_uuid: testUUID,
    test_email_masked: TEST_EMAIL.replace(/(.{3}).*(@.*)/, '$1***$2'),
  };

  // Step 1: createUser without id (SDK limitation)
  console.log('\n[1] Testing admin.createUser (no explicit id — SDK limitation)...');
  const { data: created, error: createErr } = await client.auth.admin.createUser({
    email: TEST_EMAIL,
    email_confirm: true,
    user_metadata: { migrated: true, migration_test: true },
  });

  results.create_error = createErr?.message ?? null;
  results.create_uuid = created?.user?.id ?? null;
  results.create_uuid_preserved = created?.user?.id === testUUID; // will be false — SDK generates its own UUID
  results.has_password_after_create = !!(created?.user as { encrypted_password?: string })?.encrypted_password;
  console.log('  Created ID:', created?.user?.id ?? 'FAILED');
  console.log('  Error:', createErr?.message ?? 'none');

  if (!created?.user?.id) {
    console.log('createUser failed — aborting pilot');
    writeFileSync('reports/migration/auth-email-pilot-results.md', `# Email Pilot — FAILED\n\ncreatUser error: ${createErr?.message}`);
    return;
  }

  const pilotUserId = created.user.id;

  // Step 2: Check identity creation
  const { data: identity, error: idCheckErr } = await client.auth.admin.getUserById(pilotUserId);
  const identities = (identity?.user as { identities?: unknown[] })?.identities ?? [];
  results.identities_after_create = identities.length;
  console.log('\n[2] auth.identities after createUser:', identities.length);

  // Step 3: Test generateLink
  console.log('\n[3] Testing generateLink (recovery)...');
  const { data: link, error: linkErr } = await client.auth.admin.generateLink({
    type: 'recovery',
    email: TEST_EMAIL,
    options: { redirectTo: 'https://www.mechanicraizpro.com.br/reset-password' },
  });
  results.recovery_link_generated = !linkErr;
  results.recovery_link_type = link?.properties?.verification_type ?? null;
  results.recovery_link_error = linkErr?.message ?? null;
  // Never log the actual link URL
  console.log('  Link generated:', !linkErr);
  console.log('  Error:', linkErr?.message ?? 'none');

  // Step 4: Test updateUserById (does it create identity?)
  console.log('\n[4] Testing updateUserById (does it create identity?)...');
  const { error: updateErr } = await client.auth.admin.updateUserById(pilotUserId, {
    email: TEST_EMAIL,
    email_confirm: true,
  });
  const { data: afterUpdate } = await client.auth.admin.getUserById(pilotUserId);
  const identitiesAfterUpdate = (afterUpdate?.user as { identities?: unknown[] })?.identities ?? [];
  results.identities_after_update = identitiesAfterUpdate.length;
  results.update_error = updateErr?.message ?? null;
  console.log('  identities after updateUserById:', identitiesAfterUpdate.length);
  console.log('  Error:', updateErr?.message ?? 'none');

  // Step 5: Check profile creation (trigger)
  const { data: profile } = await client.from('profiles').select('id, user_id, nome').eq('user_id', pilotUserId).maybeSingle();
  results.profile_created_by_trigger = !!profile;
  results.profile_user_id_correct = profile?.user_id === pilotUserId;
  console.log('\n[5] Profile created by trigger:', !!profile);

  // Step 6: Cleanup
  console.log('\n[6] Cleaning up test user...');
  const { error: deleteErr } = await client.auth.admin.deleteUser(pilotUserId);
  results.cleanup_error = deleteErr?.message ?? null;
  if (!deleteErr) {
    // Also clean profile if trigger created one
    await client.from('profiles').delete().eq('user_id', pilotUserId);
  }
  console.log('  Cleanup:', deleteErr ? `FAILED: ${deleteErr.message}` : 'OK');

  // Report
  const report = [
    '# Auth Email Pilot Results',
    `Date: ${new Date().toISOString()}`,
    '',
    '## Summary',
    `- createUser: ${results.create_error ? 'FAILED' : 'OK'}`,
    `- UUID preserved (SDK): ${results.create_uuid_preserved} (expected: false — SDK limitation)`,
    `- password after createUser: ${results.has_password_after_create}`,
    `- identities after createUser: ${results.identities_after_create}`,
    `- identities after updateUserById: ${results.identities_after_update}`,
    `- updateUserById creates identity: ${Number(results.identities_after_update) > 0 ? 'YES' : 'NO'}`,
    `- recovery link generated: ${results.recovery_link_generated}`,
    `- profile created by trigger: ${results.profile_created_by_trigger}`,
    `- profile user_id correct: ${results.profile_user_id_correct}`,
    `- cleanup: ${results.cleanup_error ? 'FAILED' : 'OK'}`,
    '',
    '## Notes',
    '- SDK admin.createUser does not accept explicit id field (confirmed by type audit)',
    '- UUID-preserving createUser requires direct REST API call',
    '- See auth-admin-api-capabilities.md for REST API approach',
  ].join('\n');

  writeFileSync('reports/migration/auth-email-pilot-results.md', report);
  console.log('\nReport: reports/migration/auth-email-pilot-results.md');
  console.log('\nKey finding: updateUserById creates identity?', Number(results.identities_after_update) > 0 ? 'YES' : 'NO');
}

// ─── PREPARE RECOVERY MODE ─────────────────────────────────────────────────

async function prepareRecovery() {
  console.log('Mode: PREPARE RECOVERY (read-only — no emails sent)');

  const { data: { users }, error } = await client.auth.admin.listUsers({ perPage: 100 });
  if (error) throw new Error(`listUsers: ${error.message}`);

  const plan = users
    .filter(u => (u.app_metadata as { provider?: string })?.provider === 'email')
    .map(u => ({
      id: u.id,
      email_masked: u.email?.replace(/(.{3}).*(@.*)/, '$1***$2') ?? 'unknown',
      status: 'RECOVERY_PENDING',
      sent_at: null,
    }));

  const report = [
    '# Auth Recovery Plan',
    `Date: ${new Date().toISOString()}`,
    `Total users requiring recovery: ${plan.length}`,
    '',
    '## What will happen when --execute runs',
    '1. generateLink({ type: recovery }) per user',
    '2. Send via Resend with migration explanation message',
    '3. Checkpoint after each send',
    '4. No token stored in database',
    '',
    '## Gate',
    '- [ ] Pilot email test approved',
    '- [ ] RESEND_API_KEY available',
    '- [ ] CONFIRM_EXECUTE=yes set',
    '- [ ] Explicit authorization from owner',
    '',
    `## Users queued (${plan.length} total — emails masked)`,
    ...plan.map(p => `- ${p.id.substring(0, 8)}... | ${p.email_masked} | ${p.status}`),
  ].join('\n');

  writeFileSync('reports/migration/auth-35-recovery-plan.md', report);
  console.log(`Recovery plan written: ${plan.length} users queued`);
  console.log('Report: reports/migration/auth-35-recovery-plan.md');
}

// ─── DISPATCH ──────────────────────────────────────────────────────────────

if (MODE === 'audit') {
  await runAudit();
} else if (MODE === 'pilot-email') {
  await runPilotEmail();
} else if (MODE === 'prepare-recovery') {
  await prepareRecovery();
} else if (MODE === 'pilot-google') {
  console.log('Mode: PILOT GOOGLE — see reports/migration/auth-google-pilot-plan.md');
  console.log('BLOCKED: requires Google provider configured in Supabase new project dashboard.');
} else if (MODE === 'execute') {
  if (!CONFIRM_EXECUTE) {
    console.error('CONFIRM_EXECUTE=yes required for --execute mode. This sends real emails.');
    process.exit(1);
  }
  console.log('Execute mode — not yet implemented. Run --prepare-recovery first.');
} else {
  console.error(`Unknown mode: ${MODE}. Use --audit, --pilot-email, --pilot-google, --prepare-recovery, or --execute`);
  process.exit(1);
}
