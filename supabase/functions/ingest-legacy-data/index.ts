// Edge Function: ingest-legacy-data
// Recebe dados do projeto antigo e faz upsert idempotente nas tabelas do projeto novo.
// Autenticação via header x-migration-token (compartilhado com o projeto antigo).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, x-migration-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SHARED_TOKEN = Deno.env.get("MIGRATION_SHARED_TOKEN");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ALLOWED_TABLES = new Set([
  "profiles", "oficinas", "oficina_configuracoes", "user_roles", "subscriptions",
  "clientes", "veiculos", "ordens_servico", "itens_os", "orcamentos", "itens_orcamento",
  "financeiro", "estoque", "estoque_movimentacoes", "parcelas_pagamento",
  "categorias_financeiras", "centros_custo", "formas_pagamento", "fornecedores",
  "comissoes_funcionarios", "recorrencias", "notificacoes", "user_migration_map",
]);

// Tabelas que recebem defaults criados por triggers ao inserir oficinas.
// Limpamos por oficina_id antes do upsert para preservar UUIDs originais.
const TABLES_WITH_AUTO_DEFAULTS = new Set([
  "oficina_configuracoes", "subscriptions",
  "categorias_financeiras", "centros_custo", "formas_pagamento",
]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!SHARED_TOKEN) {
    console.error("MIGRATION_SHARED_TOKEN não configurado");
    return new Response(JSON.stringify({ error: "Servidor não configurado" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const token = req.headers.get("x-migration-token");
  if (!token || token !== SHARED_TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { table, rows, dryRun = false, conflictColumn = "id" } = body;

    if (!table || typeof table !== "string") {
      return new Response(JSON.stringify({ error: "Campo 'table' obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!ALLOWED_TABLES.has(table)) {
      return new Response(JSON.stringify({ error: `Tabela '${table}' não permitida` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: "Campo 'rows' (array) obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (dryRun) {
      console.log(`[DRY RUN] table=${table} rows=${rows.length}`);
      return new Response(JSON.stringify({
        success: true, dryRun: true, table,
        wouldInsert: rows.length,
        sampleKeys: rows[0] ? Object.keys(rows[0]) : [],
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (rows.length > 1000) {
      return new Response(JSON.stringify({ error: "Máximo 1000 linhas por requisição" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (rows.length === 0) {
      return new Response(JSON.stringify({ success: true, table, received: 0, affected: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let processedRows = rows;

    // FIX 1: ordens_servico — responsavel_id aponta pra auth.users que podem não existir ainda.
    // Setamos NULL quando o usuário não existe no projeto novo (ele será religado ao logar).
    if (table === "ordens_servico") {
      const responsavelIds = Array.from(
        new Set(rows.map((r: any) => r.responsavel_id).filter(Boolean)),
      );
      if (responsavelIds.length > 0) {
        const { data: existingUsers } = await supabase
          .from("profiles")
          .select("user_id")
          .in("user_id", responsavelIds);
        const existingSet = new Set((existingUsers ?? []).map((u: any) => u.user_id));
        let nulled = 0;
        processedRows = rows.map((r: any) => {
          if (r.responsavel_id && !existingSet.has(r.responsavel_id)) {
            nulled++;
            return { ...r, responsavel_id: null };
          }
          return r;
        });
        if (nulled > 0) {
          console.log(`[FK FIX] ordens_servico: ${nulled} responsavel_id zerados (usuário ainda não migrou)`);
        }
      }
    }

    // FIX 2: limpar defaults gerados por triggers (preserva UUIDs do antigo)
    if (TABLES_WITH_AUTO_DEFAULTS.has(table)) {
      const oficinaIds = Array.from(
        new Set(processedRows.map((r: any) => r.oficina_id).filter(Boolean)),
      );
      if (oficinaIds.length > 0) {
        const { error: delError, count } = await supabase
          .from(table)
          .delete({ count: "exact" })
          .in("oficina_id", oficinaIds);
        if (delError) {
          console.warn(`[CLEANUP WARN] ${table}: ${delError.message}`);
        } else {
          console.log(`[CLEANUP OK] ${table}: removeu ${count ?? 0} defaults de ${oficinaIds.length} oficinas`);
        }
      }
    }

    // FIX 3: usa RPC com session_replication_role=replica para bypass de
    // triggers de rate_limit (clientes/estoque/orcamentos) durante a migração.
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "ingest_upsert_bypass_triggers",
      { p_table: table, p_rows: processedRows, p_conflict_column: conflictColumn },
    );

    if (rpcError) {
      console.error(`[INGEST ERROR] ${table}:`, rpcError);
      return new Response(JSON.stringify({
        success: false, table,
        error: rpcError.message,
        details: rpcError.details ?? null,
        hint: rpcError.hint ?? null,
      }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    console.log(`[INGEST OK] table=${table} affected=${(rpcResult as any)?.affected ?? 0}`);
    return new Response(JSON.stringify({
      success: true, table,
      received: processedRows.length,
      affected: (rpcResult as any)?.affected ?? processedRows.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (e: any) {
    console.error("Erro inesperado:", e);
    return new Response(JSON.stringify({ success: false, error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
