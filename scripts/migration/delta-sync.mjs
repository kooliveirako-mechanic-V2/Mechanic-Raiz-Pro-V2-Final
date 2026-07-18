/**
 * Delta Sync Script — Mechanic Raiz Pro
 *
 * Compares the new Supabase project against a known delta
 * from the old project and generates a safe, idempotent SQL plan.
 *
 * Usage:
 *   node scripts/migration/delta-sync.mjs [options]
 *
 * Options:
 *   --dry-run          (default: true) Show what would be done, no writes
 *   --tables <t1,t2>   Only process these tables
 *   --since <date>     Only consider records updated after this ISO date
 *   --resume           Skip tables already in checkpoint file
 *
 * Required env vars:
 *   OLD_SUPABASE_URL=https://cuhkkoqqeguascdsvtky.supabase.co
 *   OLD_SERVICE_ROLE_KEY=<old service role key>
 *   NEW_SUPABASE_URL=https://kurlgmngmglhvknwxjee.supabase.co
 *   NEW_SERVICE_ROLE_KEY=<new service role key>
 *
 * All writes are DRY-RUN by default. Pass --dry-run=false to apply.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.2';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

// ─── Config ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--dry-run=false');
const RESUME = args.includes('--resume');
const SINCE_ARG = (() => {
  const idx = args.indexOf('--since');
  return idx !== -1 ? args[idx + 1] : null;
})();
const TABLES_ARG = (() => {
  const idx = args.indexOf('--tables');
  return idx !== -1 ? args[idx + 1].split(',') : null;
})();

const CHECKPOINT_FILE = 'reports/migration/delta-sync-checkpoint.json';
const REPORT_FILE = 'reports/migration/delta-sync-dry-run.md';

const OLD_URL = process.env.OLD_SUPABASE_URL ?? '';
const OLD_KEY = process.env.OLD_SERVICE_ROLE_KEY ?? '';
const NEW_URL = process.env.NEW_SUPABASE_URL ?? '';
const NEW_KEY = process.env.NEW_SERVICE_ROLE_KEY ?? '';

// ─── Table definitions (ordered by FK dependency) ──────────────────────────

const TABLES = [
  // Foundation
  { name: 'profiles',              pk: 'id',  updated: 'updated_at', fks: [] },
  { name: 'oficinas',              pk: 'id',  updated: 'updated_at', fks: ['profiles'] },
  { name: 'user_roles',            pk: 'id',  updated: 'created_at', fks: ['profiles', 'oficinas'] },
  // Operational
  { name: 'clientes',              pk: 'id',  updated: 'updated_at', fks: ['oficinas'] },
  { name: 'veiculos',              pk: 'id',  updated: 'criado_em',  fks: ['clientes', 'oficinas'] },
  { name: 'estoque',               pk: 'id',  updated: 'updated_at', fks: ['oficinas'] },
  // Transactions
  { name: 'ordens_servico',        pk: 'id',  updated: 'updated_at', fks: ['clientes', 'veiculos', 'oficinas'] },
  { name: 'orcamentos',            pk: 'id',  updated: 'updated_at', fks: ['ordens_servico', 'oficinas'] },
  { name: 'financeiro',            pk: 'id',  updated: 'updated_at', fks: ['oficinas'] },
  { name: 'pagamentos',            pk: 'id',  updated: 'created_at', fks: ['oficinas'] },
  { name: 'subscriptions',         pk: 'id',  updated: 'updated_at', fks: ['oficinas'] },
  { name: 'estoque_movimentacoes', pk: 'id',  updated: 'created_at', fks: ['estoque'] },
  // Metadata
  { name: 'notificacoes',          pk: 'id',  updated: 'created_at', fks: ['oficinas'] },
  { name: 'funnel_events',         pk: 'id',  updated: 'created_at', fks: [] },
  { name: 'idempotency_keys',      pk: 'id',  updated: 'created_at', fks: [] },
].filter(t => !TABLES_ARG || TABLES_ARG.includes(t.name));

// ─── Helpers ───────────────────────────────────────────────────────────────

function rowHash(row) {
  return createHash('sha256')
    .update(JSON.stringify(row, Object.keys(row).sort()))
    .digest('hex');
}

async function fetchAll(client, table, since) {
  const rows = [];
  const pageSize = 1000;
  let offset = 0;
  while (true) {
    let q = client.from(table.name).select('*').range(offset, offset + pageSize - 1);
    if (since && table.updated) q = q.gte(table.updated, since);
    const { data, error } = await q;
    if (error) throw new Error(`${table.name}: ${error.message}`);
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

// ─── Main ──────────────────────────────────────────────────────────────────

if (!OLD_URL || !OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error('Missing required env vars. See script header.');
  process.exit(1);
}

const oldClient = createClient(OLD_URL, OLD_KEY, { auth: { persistSession: false } });
const newClient = createClient(NEW_URL, NEW_KEY, { auth: { persistSession: false } });

const checkpoint = RESUME && existsSync(CHECKPOINT_FILE)
  ? JSON.parse(readFileSync(CHECKPOINT_FILE, 'utf8'))
  : {};

const report = [
  '# Delta Sync Dry-Run Report',
  `Generated: ${new Date().toISOString()}`,
  `Mode: ${DRY_RUN ? 'DRY-RUN (no writes)' : 'LIVE'}`,
  `Since filter: ${SINCE_ARG ?? 'none (full comparison)'}`,
  '',
];

let totalInserts = 0;
let totalUpdates = 0;
let totalConflicts = 0;
const sqlStatements = [];

for (const table of TABLES) {
  if (RESUME && checkpoint[table.name] === 'done') {
    console.log(`SKIP (resume): ${table.name}`);
    report.push(`## ${table.name} — SKIPPED (resume checkpoint)`);
    continue;
  }

  console.log(`Processing: ${table.name}...`);

  const [oldRows, newRows] = await Promise.all([
    fetchAll(oldClient, table, SINCE_ARG),
    fetchAll(newClient, table, null), // always full scan on new side
  ]);

  const newByPk = new Map(newRows.map(r => [r[table.pk], r]));
  const inserts = [];
  const updates = [];
  const conflicts = [];

  for (const oldRow of oldRows) {
    const pk = oldRow[table.pk];
    const newRow = newByPk.get(pk);

    if (!newRow) {
      inserts.push(oldRow);
    } else {
      const oldTs = oldRow[table.updated] ?? '';
      const newTs = newRow[table.updated] ?? '';
      if (oldTs > newTs) {
        updates.push({ old: oldRow, new: newRow });
      } else if (rowHash(oldRow) !== rowHash(newRow)) {
        conflicts.push({ pk, oldTs, newTs, note: 'hash differs but new is newer or equal' });
      }
    }
  }

  totalInserts += inserts.length;
  totalUpdates += updates.length;
  totalConflicts += conflicts.length;

  report.push(`## ${table.name}`);
  report.push(`- Old rows scanned: ${oldRows.length}`);
  report.push(`- New rows scanned: ${newRows.length}`);
  report.push(`- Inserts needed: ${inserts.length}`);
  report.push(`- Updates needed: ${updates.length}`);
  report.push(`- Conflicts (new is newer): ${conflicts.length}`);
  report.push('');

  if (conflicts.length) {
    report.push('### Conflicts (not overwriting):');
    conflicts.slice(0, 10).forEach(c => {
      report.push(`- pk=${c.pk} old_ts=${c.oldTs} new_ts=${c.newTs} — ${c.note}`);
    });
    if (conflicts.length > 10) report.push(`  ... and ${conflicts.length - 10} more`);
    report.push('');
  }

  // Generate idempotent SQL (dry-run or live)
  for (const row of inserts) {
    const cols = Object.keys(row).join(', ');
    const vals = Object.values(row).map(v =>
      v === null ? 'NULL' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v
    ).join(', ');
    sqlStatements.push(
      `INSERT INTO public.${table.name} (${cols}) VALUES (${vals}) ON CONFLICT (${table.pk}) DO NOTHING;`
    );
  }

  for (const { old: o } of updates) {
    const setClauses = Object.entries(o)
      .filter(([k]) => k !== table.pk)
      .map(([k, v]) => `${k} = ${v === null ? 'NULL' : typeof v === 'string' ? `'${v.replace(/'/g, "''")}'` : v}`)
      .join(', ');
    sqlStatements.push(
      `UPDATE public.${table.name} SET ${setClauses} WHERE ${table.pk} = '${o[table.pk]}';`
    );
  }

  checkpoint[table.name] = 'done';
  writeFileSync(CHECKPOINT_FILE, JSON.stringify(checkpoint, null, 2));
}

report.push('## Summary');
report.push(`| | Count |`);
report.push(`|---|---|`);
report.push(`| Total inserts | ${totalInserts} |`);
report.push(`| Total updates | ${totalUpdates} |`);
report.push(`| Conflicts skipped | ${totalConflicts} |`);
report.push(`| SQL statements generated | ${sqlStatements.length} |`);
report.push('');
report.push(DRY_RUN
  ? '**DRY-RUN complete. No changes applied.**'
  : `**LIVE run complete. ${totalInserts + totalUpdates} rows applied.**`
);

writeFileSync(REPORT_FILE, report.join('\n'));
console.log(`\nReport written: ${REPORT_FILE}`);
console.log(`Summary: ${totalInserts} inserts, ${totalUpdates} updates, ${totalConflicts} conflicts`);

if (!DRY_RUN && sqlStatements.length > 0) {
  console.log('\nApplying SQL statements...');
  for (const sql of sqlStatements) {
    const { error } = await newClient.rpc('exec_sql', { sql });
    if (error) console.error(`SQL error: ${error.message}\n  ${sql.substring(0, 100)}`);
  }
}
