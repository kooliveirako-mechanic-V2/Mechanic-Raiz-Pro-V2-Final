import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";
import { humanizeError } from "@/lib/errorHandling";

export type TipoVeiculoCatalogo = "todos" | "carro" | "moto" | "eletrica" | "caminhao";

export interface CatalogoServico {
  id: string;
  oficina_id: string;
  nome: string;
  descricao: string | null;
  valor_mao_obra: number;
  categoria: string | null;
  tipo_veiculo: TipoVeiculoCatalogo;
  tempo_estimado_minutos: number | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface CatalogoServicoInput {
  nome: string;
  descricao?: string | null;
  valor_mao_obra: number;
  categoria?: string | null;
  tipo_veiculo?: TipoVeiculoCatalogo;
  tempo_estimado_minutos?: number | null;
  ativo?: boolean;
}

export function useCatalogoServicos() {
  const { oficinaAtual } = useOficina();
  const queryClient = useQueryClient();

  const { data: servicos = [], isLoading, error } = useQuery({
    queryKey: ["catalogo_servicos", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      const { data, error } = await supabase
        .from("catalogo_servicos" as any)
        .select("*")
        .eq("oficina_id", oficinaAtual.id)
        .order("nome", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as CatalogoServico[];
    },
    enabled: !!oficinaAtual,
  });

  const createServico = useMutation({
    mutationFn: async (input: CatalogoServicoInput) => {
      if (!oficinaAtual) throw new Error("Sem oficina");
      const { data, error } = await supabase
        .from("catalogo_servicos" as any)
        .insert({
          oficina_id: oficinaAtual.id,
          nome: input.nome,
          descricao: input.descricao || null,
          valor_mao_obra: input.valor_mao_obra ?? 0,
          categoria: input.categoria || "geral",
          tipo_veiculo: input.tipo_veiculo || "todos",
          tempo_estimado_minutos: input.tempo_estimado_minutos ?? null,
          ativo: input.ativo ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogo_servicos", oficinaAtual?.id] });
      toast.success("Serviço cadastrado!");
    },
    onError: (err) => {
      const e = humanizeError(err);
      toast.error(e.message, { description: e.description });
    },
  });

  const updateServico = useMutation({
    mutationFn: async ({ id, ...input }: Partial<CatalogoServicoInput> & { id: string }) => {
      const { data, error } = await supabase
        .from("catalogo_servicos" as any)
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogo_servicos", oficinaAtual?.id] });
      toast.success("Serviço atualizado!");
    },
    onError: (err) => {
      const e = humanizeError(err);
      toast.error(e.message, { description: e.description });
    },
  });

  const deleteServico = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("catalogo_servicos" as any).delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogo_servicos", oficinaAtual?.id] });
      toast.success("Serviço removido!");
    },
    onError: (err) => {
      const e = humanizeError(err);
      toast.error(e.message, { description: e.description });
    },
  });

  const toggleAtivo = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("catalogo_servicos" as any)
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogo_servicos", oficinaAtual?.id] });
    },
  });

  const importarSugestoes = useMutation({
    mutationFn: async (sugestoes: CatalogoServicoInput[]) => {
      if (!oficinaAtual) throw new Error("Sem oficina");
      const rows = sugestoes.map((s) => ({
        oficina_id: oficinaAtual.id,
        nome: s.nome,
        valor_mao_obra: s.valor_mao_obra,
        categoria: s.categoria || "geral",
        tipo_veiculo: s.tipo_veiculo || "todos",
        descricao: s.descricao || null,
        tempo_estimado_minutos: s.tempo_estimado_minutos ?? null,
        ativo: true,
      }));
      const { error } = await supabase.from("catalogo_servicos" as any).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["catalogo_servicos", oficinaAtual?.id] });
      toast.success("Catálogo inicial importado!");
    },
    onError: (err) => {
      const e = humanizeError(err);
      toast.error(e.message, { description: e.description });
    },
  });

  return {
    servicos,
    isLoading,
    error,
    createServico,
    updateServico,
    deleteServico,
    toggleAtivo,
    importarSugestoes,
  };
}

// Sugestões pré-cadastradas
export const SUGESTOES_CATALOGO: CatalogoServicoInput[] = [
  // Moto
  { nome: "Troca de óleo moto até 160cc", valor_mao_obra: 50, categoria: "Lubrificação", tipo_veiculo: "moto" },
  { nome: "Troca de óleo moto acima de 160cc", valor_mao_obra: 70, categoria: "Lubrificação", tipo_veiculo: "moto" },
  { nome: "Troca de corrente e relação", valor_mao_obra: 80, categoria: "Transmissão", tipo_veiculo: "moto" },
  { nome: "Troca de embreagem até 160cc", valor_mao_obra: 80, categoria: "Transmissão", tipo_veiculo: "moto" },
  { nome: "Troca de embreagem acima de 160cc", valor_mao_obra: 120, categoria: "Transmissão", tipo_veiculo: "moto" },
  { nome: "Regulagem de carburador", valor_mao_obra: 60, categoria: "Motor", tipo_veiculo: "moto" },
  { nome: "Troca de pneu dianteiro (moto)", valor_mao_obra: 40, categoria: "Pneus", tipo_veiculo: "moto" },
  { nome: "Troca de pneu traseiro (moto)", valor_mao_obra: 50, categoria: "Pneus", tipo_veiculo: "moto" },
  // Carro
  { nome: "Troca de óleo e filtro", valor_mao_obra: 80, categoria: "Lubrificação", tipo_veiculo: "carro" },
  { nome: "Alinhamento e balanceamento", valor_mao_obra: 120, categoria: "Suspensão", tipo_veiculo: "carro" },
  { nome: "Troca de pastilhas dianteiras", valor_mao_obra: 150, categoria: "Freios", tipo_veiculo: "carro" },
  { nome: "Troca de correia dentada", valor_mao_obra: 250, categoria: "Motor", tipo_veiculo: "carro" },
  { nome: "Revisão completa", valor_mao_obra: 350, categoria: "Revisão", tipo_veiculo: "carro" },
  { nome: "Higienização do ar condicionado", valor_mao_obra: 150, categoria: "Ar Condicionado", tipo_veiculo: "carro" },
  // Auto elétrica
  { nome: "Diagnóstico eletrônico", valor_mao_obra: 120, categoria: "Diagnóstico", tipo_veiculo: "eletrica" },
  { nome: "Troca de bateria", valor_mao_obra: 80, categoria: "Elétrica", tipo_veiculo: "eletrica" },
  { nome: "Revisão do sistema de carga", valor_mao_obra: 100, categoria: "Elétrica", tipo_veiculo: "eletrica" },
  { nome: "Instalação de som", valor_mao_obra: 150, categoria: "Acessórios", tipo_veiculo: "eletrica" },
];
