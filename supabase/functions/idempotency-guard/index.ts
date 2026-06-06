import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

/**
 * IDEMPOTENCY GUARD - Proteção Server-Side contra requisições duplicadas
 * 
 * Esta edge function atua como middleware de idempotência para ações críticas:
 * - Finalizar OS
 * - Gerar lançamento financeiro
 * - Ajustar estoque
 * - Excluir registros sensíveis
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, idempotency-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface IdempotencyRequest {
  action: "finalizar_os" | "criar_financeiro" | "ajustar_estoque" | "excluir_registro";
  payload: Record<string, unknown>;
  oficina_id: string;
}

// Cache em memória para keys recentes (TTL: 60 segundos)
const recentKeys = new Map<string, { result: unknown; timestamp: number }>();
const MEMORY_CACHE_TTL = 60 * 1000;

function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of recentKeys.entries()) {
    if (now - value.timestamp > MEMORY_CACHE_TTL) {
      recentKeys.delete(key);
    }
  }
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const idempotencyKey = req.headers.get("idempotency-key");
    // Header para identificar ações de sistema (bypassa rate limit)
    const isSystemAction = req.headers.get("x-system-action") === "true";
    
    if (!idempotencyKey) {
      return new Response(
        JSON.stringify({ error: "Idempotency-Key header é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Log de contexto para auditoria
    console.log(`[Idempotency] Request: ${idempotencyKey.substring(0, 20)}... | System: ${isSystemAction}`);

    cleanExpiredCache();

    // Cache em memória
    if (recentKeys.has(idempotencyKey)) {
      console.log(`[Idempotency] Cache hit: ${idempotencyKey}`);
      const cached = recentKeys.get(idempotencyKey)!;
      return new Response(
        JSON.stringify({ success: true, cached: true, result: cached.result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Idempotency-Cache": "hit" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // deno-lint-ignore no-explicit-any
    const supabase: any = createClient(supabaseUrl, supabaseServiceKey);

    const body: IdempotencyRequest = await req.json();
    const { action, payload, oficina_id } = body;

    if (!action || !payload || !oficina_id) {
      return new Response(
        JSON.stringify({ error: "action, payload e oficina_id são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[Idempotency] Processando: ${action} | Key: ${idempotencyKey}`);

    // Verificar no banco
    const { data: existing } = await supabase
      .from("idempotency_keys")
      .select("*")
      .eq("key", idempotencyKey)
      .eq("oficina_id", oficina_id)
      .single();

    if (existing) {
      console.log(`[Idempotency] Duplicata no DB: ${idempotencyKey}`);
      recentKeys.set(idempotencyKey, { result: existing.result, timestamp: Date.now() });
      return new Response(
        JSON.stringify({ success: true, cached: true, result: existing.result }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Idempotency-Cache": "hit-db" } }
      );
    }

    // Processar ação
    let result: Record<string, unknown>;
    
    switch (action) {
      case "finalizar_os":
        result = await processFinalizarOS(supabase, payload, oficina_id);
        break;
      case "criar_financeiro":
        result = await processCriarFinanceiro(supabase, payload, oficina_id);
        break;
      case "ajustar_estoque":
        result = await processAjustarEstoque(supabase, payload, oficina_id);
        break;
      case "excluir_registro":
        result = await processExcluirRegistro(supabase, payload, oficina_id);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Ação desconhecida: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    // Armazenar chave (expira em 24h)
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    await supabase.from("idempotency_keys").insert({
      key: idempotencyKey,
      oficina_id,
      action,
      result,
      expires_at: expiresAt,
    });

    recentKeys.set(idempotencyKey, { result, timestamp: Date.now() });

    console.log(`[Idempotency] Processado: ${action} | Key: ${idempotencyKey}`);

    return new Response(
      JSON.stringify({ success: true, cached: false, result }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json", "X-Idempotency-Cache": "miss" } }
    );

  } catch (error: unknown) {
    console.error("[Idempotency] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

// deno-lint-ignore no-explicit-any
async function processFinalizarOS(supabase: any, payload: Record<string, unknown>, oficina_id: string): Promise<Record<string, unknown>> {
  const { os_id, valor_servico, custo_servico, observacoes_conclusao } = payload;
  
  const { data: os, error: osError } = await supabase
    .from("ordens_servico")
    .select("status, oficina_id")
    .eq("id", os_id)
    .eq("oficina_id", oficina_id)
    .single();

  if (osError || !os) {
    throw new Error("OS não encontrada ou sem permissão");
  }

  if (os.status === "concluida" || os.status === "paga") {
    return { already_finalized: true, os_id, status: os.status };
  }

  const lucro = Number(valor_servico || 0) - Number(custo_servico || 0);

  const { error: updateError } = await supabase
    .from("ordens_servico")
    .update({
      status: "concluida",
      valor_servico,
      custo_servico,
      lucro,
      data_conclusao: new Date().toISOString().split("T")[0],
      observacoes_conclusao,
    })
    .eq("id", os_id);

  if (updateError) {
    throw new Error(`Erro ao finalizar OS: ${updateError.message}`);
  }

  const { error: financeiroError } = await supabase
    .from("financeiro")
    .insert({
      oficina_id,
      ordem_servico_id: os_id,
      tipo: "entrada",
      origem: "ordem_servico",
      valor: valor_servico,
      data: new Date().toISOString().split("T")[0],
      descricao: `OS finalizada`,
    });

  if (financeiroError) {
    await supabase
      .from("ordens_servico")
      .update({ status: "em_andamento", data_conclusao: null })
      .eq("id", os_id);
    throw new Error(`Erro ao criar financeiro: ${financeiroError.message}`);
  }

  return { success: true, os_id, status: "concluida", lucro, financeiro_criado: true };
}

// deno-lint-ignore no-explicit-any
async function processCriarFinanceiro(supabase: any, payload: Record<string, unknown>, oficina_id: string): Promise<Record<string, unknown>> {
  const { tipo, origem, valor, descricao, data, categoria_id, forma_pagamento_id } = payload;

  const { data: created, error } = await supabase
    .from("financeiro")
    .insert({
      oficina_id,
      tipo,
      origem: origem || "manual",
      valor,
      descricao,
      data: data || new Date().toISOString().split("T")[0],
      categoria_id,
      forma_pagamento_id,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Erro ao criar lançamento: ${error.message}`);
  }

  return { success: true, financeiro_id: created.id };
}

// deno-lint-ignore no-explicit-any
async function processAjustarEstoque(supabase: any, payload: Record<string, unknown>, oficina_id: string): Promise<Record<string, unknown>> {
  const { estoque_id, quantidade, tipo, motivo } = payload;

  const { data: estoque, error: estoqueError } = await supabase
    .from("estoque")
    .select("quantidade")
    .eq("id", estoque_id)
    .eq("oficina_id", oficina_id)
    .single();

  if (estoqueError || !estoque) {
    throw new Error("Item de estoque não encontrado");
  }

  const quantidadeAnterior = estoque.quantidade;
  const novaQuantidade = tipo === "entrada" 
    ? quantidadeAnterior + Number(quantidade)
    : quantidadeAnterior - Number(quantidade);

  const { error: updateError } = await supabase
    .from("estoque")
    .update({ quantidade: novaQuantidade })
    .eq("id", estoque_id);

  if (updateError) {
    throw new Error(`Erro ao ajustar estoque: ${updateError.message}`);
  }

  await supabase.from("estoque_movimentacoes").insert({
    estoque_id,
    oficina_id,
    tipo,
    quantidade: Number(quantidade),
    quantidade_anterior: quantidadeAnterior,
    quantidade_nova: novaQuantidade,
    motivo: motivo || "Ajuste via idempotência",
    referencia_tipo: "idempotency",
  });

  return { success: true, estoque_id, quantidade_anterior: quantidadeAnterior, quantidade_nova: novaQuantidade };
}

// deno-lint-ignore no-explicit-any
async function processExcluirRegistro(supabase: any, payload: Record<string, unknown>, oficina_id: string): Promise<Record<string, unknown>> {
  const { tabela, registro_id } = payload;
  
  const tabelasPermitidas = ["clientes", "veiculos", "orcamentos"];
  
  if (!tabelasPermitidas.includes(tabela as string)) {
    throw new Error(`Exclusão não permitida para tabela: ${tabela}`);
  }

  const { data: registro, error: checkError } = await supabase
    .from(tabela as string)
    .select("id")
    .eq("id", registro_id)
    .eq("oficina_id", oficina_id)
    .single();

  if (checkError || !registro) {
    return { success: true, already_deleted: true };
  }

  const { error: deleteError } = await supabase
    .from(tabela as string)
    .delete()
    .eq("id", registro_id);

  if (deleteError) {
    throw new Error(`Erro ao excluir: ${deleteError.message}`);
  }

  return { success: true, deleted: true, registro_id };
}

serve(handler);
