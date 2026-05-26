/**
 * Tipos para RPCs customizadas do Supabase.
 * 
 * O gerador de tipos do Supabase não inclui RPCs customizadas,
 * então tipamos os resultados aqui para evitar `as any` nos hooks.
 */

// ─── criar_os_completa ─────────────────────────────────────────────
export interface CriarOSCompletaResult {
  success: boolean;
  os_id: string;
  numero: number;
  valor_total: number;
  status: string;
  total_itens_inseridos: number;
}

// ─── atomic_delete_os ──────────────────────────────────────────────
export interface AtomicDeleteResult {
  success: boolean;
  message?: string;
  error?: string;
  nome?: string;
}

// ─── atomic_delete_cliente ─────────────────────────────────────────
export type AtomicDeleteClienteResult = AtomicDeleteResult;

// ─── atomic_delete_estoque ─────────────────────────────────────────
export type AtomicDeleteEstoqueResult = AtomicDeleteResult;

// ─── upsert_financeiro_os ──────────────────────────────────────────
export interface UpsertFinanceiroOSResult {
  success: boolean;
  action?: "created" | "exists" | "skipped";
  error?: string;
}

// ─── converter_orcamento_em_os ─────────────────────────────────────
export interface ConverterOrcamentoEmOSResult {
  success: boolean;
  os_id: string;
  valor_total: number;
  custo_total: number;
  itens_copiados: number;
}

// ─── criar_venda_balcao ────────────────────────────────────────────
export interface CriarVendaBalcaoResult {
  success: boolean;
  venda_id: string;
  numero: number;
  valor_total: number;
  itens: number;
}

/**
 * Helper para tipar resultado de RPC sem usar `as any` no resultado.
 * Uso: `const result = castRpcResult<CriarOSCompletaResult>(data);`
 */
export function castRpcResult<T>(data: unknown): T {
  return data as T;
}
