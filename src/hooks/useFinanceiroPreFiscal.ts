import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { guardCreateFinanceiro } from "@/lib/runtimeGuards";
import { startOfMonth, endOfMonth, subMonths, parseISO, isWithinInterval } from "date-fns";
import { toast } from "sonner";

export type StatusPagamento = "pago" | "a_receber" | "a_pagar" | "atrasado" | "cancelado";
export type ClassificacaoFinanceira = "empresa" | "pessoal";
export type TipoFinanceiro = "entrada" | "saida";
export type CategoriaFinanceiroTipo = "operacional" | "prejuizo" | "comissao" | "sinal";

export const PREJUIZO_LABELS: Record<string, string> = {
  prejuizo_retrabalho: "Retrabalho",
  prejuizo_garantia: "Garantia Acionada",
  prejuizo_peca: "Peça Quebrada / Avariada",
  prejuizo_sinistro: "Sinistro",
};

export interface FinanceiroPreFiscal {
  id: string;
  oficina_id: string;
  tipo: TipoFinanceiro;
  origem: string;
  ordem_servico_id: string | null;
  valor: number;
  data: string;
  descricao: string | null;
  categoria: CategoriaFinanceiroTipo | string;
  categoria_id: string | null;
  centro_custo_id: string | null;
  fornecedor_id: string | null;
  forma_pagamento_id: string | null;
  status: StatusPagamento;
  classificacao: ClassificacaoFinanceira;
  data_competencia: string | null;
  data_pagamento: string | null;
  recorrente: boolean;
  recorrencia_tipo: "mensal" | "semanal" | "anual" | null;
  observacoes_contador: string | null;
  comprovante_url: string | null;
  numero_documento: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  categoria_obj?: { nome: string; cor: string; icone: string } | null;
  centro_custo?: { nome: string } | null;
  fornecedor?: { nome: string } | null;
  forma_pagamento?: { nome: string; tipo: string } | null;
}

export interface FinanceiroInput {
  tipo: TipoFinanceiro;
  origem: string;
  valor: number;
  data: string;
  descricao?: string;
  categoria?: CategoriaFinanceiroTipo | string;
  categoria_id?: string;
  centro_custo_id?: string;
  fornecedor_id?: string;
  forma_pagamento_id?: string;
  status?: StatusPagamento;
  classificacao?: ClassificacaoFinanceira;
  data_competencia?: string;
  data_pagamento?: string;
  recorrente?: boolean;
  recorrencia_tipo?: "mensal" | "semanal" | "anual";
  observacoes_contador?: string;
  numero_documento?: string;
  ordem_servico_id?: string;
}

interface DateFilter {
  start: string;
  end: string;
}

export function useFinanceiroPreFiscal(dateFilter?: DateFilter | null) {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: registros = [], isLoading, error } = useQuery({
    queryKey: ["financeiro-prefiscal", oficinaAtual?.id] as const,
    queryFn: async () => {
      if (!oficinaAtual) return [];
      
      const { data, error } = await supabase
        .from("financeiro")
        .select(`
          *,
          categoria_obj:categorias_financeiras(nome, cor, icone),
          centro_custo:centros_custo(nome),
          fornecedor:fornecedores(nome),
          forma_pagamento:formas_pagamento(nome, tipo)
        `)
        .eq("oficina_id", oficinaAtual.id)
        .order("data", { ascending: false });

      if (error) throw error;
      return data as unknown as FinanceiroPreFiscal[];
    },
    enabled: !!oficinaAtual,
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (input: FinanceiroInput) => {
      if (!oficinaAtual) throw new Error("Oficina não selecionada");

      // Guard pré-mutação
      guardCreateFinanceiro({
        oficina_id: oficinaAtual.id,
        tipo: input.tipo,
        origem: input.origem,
        valor: input.valor,
      });

      const { data, error } = await supabase
        .from("financeiro")
        .insert({
          ...input,
          oficina_id: oficinaAtual.id,
          data_competencia: input.data_competencia || input.data,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeiro-prefiscal", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Lançamento criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar lançamento", { description: error.message });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Omit<FinanceiroPreFiscal, "categoria" | "centro_custo" | "fornecedor" | "forma_pagamento">> & { id: string }) => {
      const { data, error } = await supabase
        .from("financeiro")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeiro-prefiscal", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Lançamento atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar", { description: error.message });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("financeiro")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["financeiro-prefiscal", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["financeiro-resumo", oficinaAtual?.id] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Lançamento excluído!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir", { description: error.message });
    },
  });

  // Filter by date range
  const filteredRegistros = dateFilter
    ? registros.filter((r) => {
        const recordDate = parseISO(r.data);
        return isWithinInterval(recordDate, {
          start: parseISO(dateFilter.start),
          end: parseISO(dateFilter.end),
        });
      })
    : registros;

  // Período base para os totais: respeita o filtro de data quando ativo,
  // caso contrário usa o mês corrente (comportamento padrão).
  const now = new Date();
  const inicioPeriodo = dateFilter ? parseISO(dateFilter.start) : startOfMonth(now);
  const fimPeriodo = dateFilter ? parseISO(dateFilter.end) : endOfMonth(now);

  const registrosMesAtual = registros.filter((r) => {
    const data = parseISO(r.data);
    return data >= inicioPeriodo && data <= fimPeriodo;
  });

  // Totals
  const totalEntradas = registrosMesAtual
    .filter((r) => r.tipo === "entrada")
    .reduce((sum, r) => sum + Number(r.valor), 0);

  const totalSaidas = registrosMesAtual
    .filter((r) => r.tipo === "saida")
    .reduce((sum, r) => sum + Number(r.valor), 0);

  const lucroTotal = totalEntradas - totalSaidas;

  // Categoria-aware breakdown (Funcionalidade 2: Prejuízo)
  const isPrejuizo = (r: FinanceiroPreFiscal) => r.categoria === "prejuizo";
  const isComissao = (r: FinanceiroPreFiscal) => r.categoria === "comissao";

  const totalPrejuizos = registrosMesAtual
    .filter((r) => r.tipo === "saida" && isPrejuizo(r))
    .reduce((sum, r) => sum + Number(r.valor), 0);

  const totalComissoesPagas = registrosMesAtual
    .filter((r) => r.tipo === "saida" && isComissao(r))
    .reduce((sum, r) => sum + Number(r.valor), 0);

  const totalDespesasOperacionais = registrosMesAtual
    .filter((r) => r.tipo === "saida" && !isPrejuizo(r) && !isComissao(r))
    .reduce((sum, r) => sum + Number(r.valor), 0);

  const lucroOperacional = totalEntradas - totalDespesasOperacionais - totalComissoesPagas;
  const lucroLiquidoReal = lucroOperacional - totalPrejuizos;

  const registrosPrejuizo = filteredRegistros.filter((r) => isPrejuizo(r) && r.tipo === "saida");

  // Separação empresa/pessoal
  const totaisEmpresa = registrosMesAtual
    .filter((r) => r.classificacao === "empresa")
    .reduce(
      (acc, r) => {
        if (r.tipo === "entrada") acc.entradas += Number(r.valor);
        else acc.saidas += Number(r.valor);
        return acc;
      },
      { entradas: 0, saidas: 0 }
    );

  const totaisPessoal = registrosMesAtual
    .filter((r) => r.classificacao === "pessoal")
    .reduce(
      (acc, r) => {
        if (r.tipo === "entrada") acc.entradas += Number(r.valor);
        else acc.saidas += Number(r.valor);
        return acc;
      },
      { entradas: 0, saidas: 0 }
    );

  // A receber / A pagar
  const totalAReceber = registros
    .filter((r) => r.status === "a_receber")
    .reduce((sum, r) => sum + Number(r.valor), 0);

  const totalAPagar = registros
    .filter((r) => r.status === "a_pagar")
    .reduce((sum, r) => sum + Number(r.valor), 0);

  // Comparison with previous month
  const mesAnterior = subMonths(now, 1);
  const inicioMesAnterior = startOfMonth(mesAnterior);
  const fimMesAnterior = endOfMonth(mesAnterior);

  const entradasMesAnterior = registros
    .filter((r) => {
      const data = new Date(r.data);
      return data >= inicioMesAnterior && data <= fimMesAnterior && r.tipo === "entrada";
    })
    .reduce((sum, r) => sum + Number(r.valor), 0);

  const percentualMudanca = entradasMesAnterior > 0
    ? Math.round(((totalEntradas - entradasMesAnterior) / entradasMesAnterior) * 100)
    : totalEntradas > 0 ? 100 : 0;

  // Group by categoria
  const porCategoria = registrosMesAtual.reduce((acc, r) => {
    const cat = r.categoria_obj?.nome || r.origem || "Outros";
    if (!acc[cat]) acc[cat] = { entrada: 0, saida: 0 };
    if (r.tipo === "entrada") acc[cat].entrada += Number(r.valor);
    else acc[cat].saida += Number(r.valor);
    return acc;
  }, {} as Record<string, { entrada: number; saida: number }>);

  // Group by forma de pagamento
  const porFormaPagamento = registrosMesAtual.reduce((acc, r) => {
    const forma = r.forma_pagamento?.nome || "Não informado";
    if (!acc[forma]) acc[forma] = 0;
    acc[forma] += Number(r.valor);
    return acc;
  }, {} as Record<string, number>);

  return {
    registros: filteredRegistros,
    allRegistros: registros,
    totalEntradas,
    totalSaidas,
    lucroTotal,
    totalAReceber,
    totalAPagar,
    totaisEmpresa,
    totaisPessoal,
    percentualMudanca,
    porCategoria,
    porFormaPagamento,
    // Funcionalidade 2 — Prejuízo
    totalPrejuizos,
    totalComissoesPagas,
    totalDespesasOperacionais,
    lucroOperacional,
    lucroLiquidoReal,
    registrosPrejuizo,
    isLoading,
    error,
    createRegistro: createMutation.mutate,
    updateRegistro: updateMutation.mutate,
    deleteRegistro: deleteMutation.mutate,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}
