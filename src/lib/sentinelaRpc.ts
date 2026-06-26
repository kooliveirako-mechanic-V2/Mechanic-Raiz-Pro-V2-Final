/**
 * SENTINELA — Wrappers tipados das RPCs do painel.
 *
 * Centraliza o cast das RPCs `get_sentinela_*` (que retornam jsonb e não
 * aparecem no gerador de tipos do Supabase) num único lugar. A página
 * `/sentinela` consome estas funções e fica livre de `as any`.
 */
import { supabase } from "@/integrations/supabase/client";

export type Nivel = "green" | "yellow" | "red";

export interface ScorePayload {
  score: number;
  nivel: Nivel;
  calculated_at: string;
  from_cache?: boolean;
  componentes: Array<{
    id: string;
    label: string;
    peso: number;
    valor: number;
    pontos: number;
    evidencia_sql: string;
  }>;
  meta: { rpcs_envoltas: number; rpcs_total: number };
}

export interface ModulosPayload {
  modulos: Array<{ id: string; label: string; erros_24h: number; status: Nivel }>;
}

export interface DetectoresPayload {
  detectores: Array<{ id: string; label: string; count: number; severidade: Nivel }>;
  total_inconsistencias: number;
}

export interface LogsPayload {
  logs: Array<{
    id: string;
    created_at: string;
    rpc: string;
    message: string;
    severity: string;
    oficina_id: string | null;
  }>;
}

type RpcResult<T> = { data: T | null; error: { message: string } | null };

// Único ponto onde a coerção acontece — o `unknown` aqui é uma realidade do
// PostgREST (jsonb), não um relaxamento do nosso tipo.
function rpc<T>(name: string, params?: Record<string, unknown>): Promise<RpcResult<T>> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase.rpc as any)(name, params) as Promise<RpcResult<T>>;
}

export const sentinelaRpc = {
  score: () => rpc<ScorePayload>("get_sentinela_score"),
  modulos: () => rpc<ModulosPayload>("get_sentinela_modulos"),
  detectores: () => rpc<DetectoresPayload>("get_sentinela_detectores"),
  logs: (limit = 50) => rpc<LogsPayload>("get_sentinela_logs", { _limit: limit }),
  isSuperAdmin: (userId: string) => rpc<boolean>("is_super_admin", { _user_id: userId }),
};
