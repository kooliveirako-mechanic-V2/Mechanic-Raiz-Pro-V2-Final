#!/usr/bin/env node
// Anti-regressão: impede reintrodução do banco ANTIGO e drift de config Supabase.
// Sai com código != 0 se qualquer check falhar. Uso: node scripts/ci/check-no-regression.mjs
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const OLD_REF = "cuhkkoqqeguascdsvtky";
const NEW_REF = "kurlgmngmglhvknwxjee";
const ROOT = process.cwd();
const failures = [];
const warnings = [];

const readIf = (p) => (existsSync(join(ROOT, p)) ? readFileSync(join(ROOT, p), "utf8") : null);

// [1] config.toml project_id não pode ser o ANTIGO
const configToml = readIf("supabase/config.toml");
let configProjectId = null;
if (configToml) {
  const m = configToml.match(/project_id\s*=\s*"([^"]+)"/);
  configProjectId = m ? m[1] : null;
  if (configProjectId === OLD_REF) {
    failures.push(`[1] supabase/config.toml project_id aponta para o ANTIGO (${OLD_REF})`);
  }
} else {
  warnings.push("[1] supabase/config.toml não encontrado");
}

// [2] arquivos .env sem referência ao ANTIGO
for (const f of [".env", ".env.local", ".env.production", ".env.development"]) {
  const c = readIf(f);
  if (c && c.includes(OLD_REF)) failures.push(`[2] ${f} contém referência ao ANTIGO (${OLD_REF})`);
}

// [3] raiz do split-brain: config.toml project_id deve casar com VITE_SUPABASE_PROJECT_ID
let viteProjectId = process.env.VITE_SUPABASE_PROJECT_ID || null;
if (!viteProjectId) {
  for (const f of [".env", ".env.local", ".env.production"]) {
    const c = readIf(f);
    const m = c && c.match(/VITE_SUPABASE_PROJECT_ID\s*=\s*"?([^"\r\n]+)"?/);
    if (m) { viteProjectId = m[1].trim(); break; }
  }
}
if (configProjectId && viteProjectId && configProjectId !== viteProjectId) {
  failures.push(`[3] Divergência config.toml (${configProjectId}) != VITE_SUPABASE_PROJECT_ID (${viteProjectId})`);
}

// [4] vite.config.ts não pode mencionar o ANTIGO
const viteConfig = readIf("vite.config.ts");
if (viteConfig && viteConfig.includes(OLD_REF)) failures.push(`[4] vite.config.ts menciona o ANTIGO (${OLD_REF})`);

// [5] varredura de fonte + migrations ATIVAS (migrations_legacy é excluída de propósito)
const SCAN_DIRS = ["src", "electron", "public", "supabase/migrations"];
const SCAN_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".json", ".toml", ".sql"]);
const EXCLUDE = new Set(["node_modules", "dist", ".git", "migrations_legacy"]);
// Exceções por ARQUIVO (nunca por pasta): menções históricas ao ref ANTIGO já provadas inertes.
// Verificado 2026-07-29 no NOVO: cron.job tem UM job ativo (sentinela-detector-5min, jobid=1)
// e ele aponta para o NOVO — o job histórico do primeiro arquivo nunca foi criado aqui.
// Manter a granularidade de arquivo: migration NOVA com ref ANTIGO deve continuar falhando.
const ALLOW_OLD_REF = new Set([
  // corpo de cron histórico (linha 121), guardado por IF NOT v_exists — não recria o job
  "supabase/migrations/20260624180958_7b66853f-d970-416b-8b91-0119b19cd07d.sql",
  // apenas comentário (linha 3); o job que esta migration agenda aponta para o NOVO
  "supabase/migrations/20260726232500_fix_sentinela_cron_novo.sql",
]);
const walk = (dir) => {
  if (!existsSync(join(ROOT, dir))) return;
  for (const entry of readdirSync(join(ROOT, dir))) {
    if (EXCLUDE.has(entry)) continue;
    const rel = join(dir, entry);
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel);
    else if (SCAN_EXT.has(extname(entry)) && readFileSync(join(ROOT, rel), "utf8").includes(OLD_REF)) {
      const relPosix = rel.replace(/\\/g, "/");
      if (ALLOW_OLD_REF.has(relPosix)) continue;
      failures.push(`[5] ${relPosix} menciona o ANTIGO (${OLD_REF})`);
    }
  }
};
SCAN_DIRS.forEach(walk);

// [6] online (só se SUPABASE_ACCESS_TOKEN presente): RLS ligada + anon sem EXECUTE nas RPCs críticas
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) {
  warnings.push("[6] SUPABASE_ACCESS_TOKEN ausente — checks online (RLS, grants anon) pulados");
} else {
  const sql = `
    SELECT 'rls' AS kind, c.relname AS name, c.relrowsecurity::text AS val
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace AND n.nspname='public'
    WHERE c.relname IN ('ordens_servico','clientes','veiculos','estoque','financeiro','orcamentos','vendas_balcao','profiles','user_roles')
    UNION ALL
    SELECT 'anon_exec', p.proname, has_function_privilege('anon', p.oid, 'EXECUTE')::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace AND n.nspname='public'
    WHERE p.proname IN ('criar_os_completa','deletar_item_os_atomic','get_oficina_funcionarios','cancelar_venda_balcao','recalcular_totais_orcamento');`;
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${NEW_REF}/database/query`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ query: sql }),
    });
    if (!res.ok) {
      failures.push(`[6] Management API retornou HTTP ${res.status}`);
    } else {
      const rows = await res.json();
      for (const r of rows) {
        if (r.kind === "rls" && r.val !== "true") failures.push(`[6] RLS desligada em ${r.name}`);
        if (r.kind === "anon_exec" && r.val === "true") failures.push(`[6] anon tem EXECUTE em ${r.name}`);
      }
    }
  } catch (e) {
    failures.push(`[6] Falha ao consultar Management API: ${e.message}`);
  }
}

for (const w of warnings) console.log(`⚠ ${w}`);
if (failures.length) {
  console.error(`\n✗ ${failures.length} check(s) de anti-regressão falharam:`);
  for (const f of failures) console.error(`  - ${f}`);
  process.exit(1);
}
console.log("\n✓ Todos os checks de anti-regressão passaram");
