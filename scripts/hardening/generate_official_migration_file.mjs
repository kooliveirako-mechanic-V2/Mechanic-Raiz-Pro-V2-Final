import fs from 'node:fs';

const snapshotPath = 'reports/migration/final_security_snapshot_live.json';
const outputPath = 'supabase/migrations/20260724235444_security_hardening_multitenant_official.sql';

const defs = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
const rows = defs.rows || [];

const sql = [
  '-- Migration oficial de hardening multi-tenant gerada a partir da extração pg_get_functiondef() live.',
  '-- Target project: kurlgmngmglhvknwxjee.',
  '-- Reproduz exatamente o estado corrente do banco (guards + grants + search_path).',
  '-- Se executada em db reset, restaura a proteção multi-tenant completa.',
  'BEGIN;',
  '',
  ...rows.map((row) => `-- ${row.proname}\n${row.full_def};\n`),
  ...rows.map((row) => `ALTER FUNCTION public.${row.proname}(${row.identity_args}) SET search_path TO public, pg_temp;`),
  '',
  ...rows.map((row) => {
    return [
      `REVOKE EXECUTE ON FUNCTION public.${row.proname}(${row.identity_args}) FROM PUBLIC, anon;`,
      `GRANT EXECUTE ON FUNCTION public.${row.proname}(${row.identity_args}) TO authenticated, service_role;`
    ].join('\n');
  }),
  '',
  'COMMIT;',
  ''
].join('\n');

fs.writeFileSync(outputPath, sql);
console.log(`Generated official migration: ${outputPath} (${Buffer.byteLength(sql)} bytes)`);
