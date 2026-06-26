/**
 * SENTINELA — Fonte única de RPCs críticas.
 *
 * Mantenha SOMENTE este arquivo. `sentinela.ts` e `rpcWithRetry.ts`
 * importam daqui — não duplicar listas em outros lugares.
 *
 * Categoria ajuda a classificar risco no painel/relatórios.
 */

export type CriticalRpcCategory =
  | "os"
  | "financeiro"
  | "estoque"
  | "vendas"
  | "delete"
  | "pagamento"
  | "orcamento"
  | "publico";

export interface CriticalRpcMeta {
  name: string;
  category: CriticalRpcCategory;
  /** Pode ser chamada em contexto anônimo (sem auth.uid()). */
  publicContext?: boolean;
}

export const CRITICAL_RPCS_META: readonly CriticalRpcMeta[] = [
  { name: "criar_os_completa", category: "os" },
  { name: "finalizar_os_atomica", category: "os" },
  { name: "reabrir_os_atomica", category: "os" },
  { name: "atomic_delete_os", category: "delete" },
  { name: "atomic_delete_cliente", category: "delete" },
  { name: "atomic_delete_veiculo", category: "delete" },
  { name: "atomic_delete_estoque", category: "delete" },
  { name: "atomic_delete_orcamento", category: "delete" },
  { name: "criar_venda_balcao", category: "vendas" },
  { name: "gerar_parcelas_atomic", category: "pagamento" },
  { name: "registrar_sinal_os", category: "pagamento" },
  { name: "upsert_financeiro_os", category: "financeiro" },
  { name: "deletar_item_os_atomic", category: "os" },
  { name: "recalcular_totais_orcamento", category: "orcamento" },
  // Fase 2.1 — RPCs públicas / portal / convite
  { name: "solicitar_agendamento_publico", category: "publico", publicContext: true },
  { name: "portal_update_orcamento_status", category: "publico", publicContext: true },
  { name: "aprovar_solicitacao_agendamento", category: "publico" },
  { name: "recusar_solicitacao_agendamento", category: "publico" },
  { name: "sugerir_novo_horario_agendamento", category: "publico" },
  { name: "cancelar_solicitacao_agendamento", category: "publico" },
  { name: "accept_team_invite", category: "publico" },
] as const;

export function isPublicContextRpc(name: string): boolean {
  return !!CRITICAL_RPCS_META.find((r) => r.name === name)?.publicContext;
}

export const CRITICAL_RPCS: readonly string[] = CRITICAL_RPCS_META.map((r) => r.name);

const CRITICAL_SET = new Set<string>(CRITICAL_RPCS);

export function isCriticalRpc(name: string): boolean {
  return CRITICAL_SET.has(name);
}

export function getCriticalRpcCategory(name: string): CriticalRpcCategory | null {
  return CRITICAL_RPCS_META.find((r) => r.name === name)?.category ?? null;
}
