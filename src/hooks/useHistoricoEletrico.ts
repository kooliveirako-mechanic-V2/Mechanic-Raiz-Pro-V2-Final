import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { usePlan } from "@/hooks/usePlan";

interface EventoEletrico {
  id: string;
  data_servico: string;
  tipo_servico: string;
  descricao: string | null;
  status: string;
  valor_servico: number | null;
  custo_servico: number | null;
  lucro: number | null;
  km_no_servico: number | null;
  tempo_diagnostico_minutos: number | null;
  hipotese_diagnostico: string | null;
  codigo_obd: string | null;
  codigos_obd_lista: string[] | null;
  modulos_testados: string[] | null;
  checklist_voltagem_bateria: string | null;
  // Campos calculados
  tipoSistema: "bateria" | "alternador" | "partida" | "modulos" | "geral";
  statusModoGuerra: "prejuizo" | "margem_baixa" | "saudavel" | "excelente";
  valorIdeal: number | null;
}

interface RecorrenciaEletrica {
  tipo: "codigo_obd" | "modulo" | "sistema";
  identificador: string;
  ocorrencias: number;
  totalGasto: number;
  primeiraOcorrencia: string;
  ultimaOcorrencia: string;
  diasEntreOcorrencias: number;
}

interface ResumoTecnico {
  totalDiagnosticos: number;
  totalGasto: number;
  recorrencias: RecorrenciaEletrica[];
  sistemaCritico: string | null;
  riscoPotencial: "alto" | "medio" | "baixo";
  textoResumo: string;
  tempoTecnicoTotal: number;
  mediaTempoTecnico: number;
  valorMedioOS: number;
}

export function useHistoricoEletrico(veiculoId: string | undefined) {
  const { oficinaAtual } = useOficina();
  const { currentPlan } = usePlan();
  const isInfinity = currentPlan === "oficina_pro";
  
  // Buscar todas as OS do veículo com dados elétricos
  const { data: ordensServico = [], isLoading } = useQuery({
    queryKey: ["historico-eletrico", veiculoId],
    queryFn: async () => {
      if (!veiculoId) return [];
      
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*")
        .eq("veiculo_id", veiculoId)
        .order("data_servico", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!veiculoId,
  });

  // Processar eventos elétricos
  const eventosEletricos = useMemo((): EventoEletrico[] => {
    return ordensServico.map((os) => {
      // Determinar tipo de sistema baseado no tipo_servico
      const tipoServicoLower = os.tipo_servico?.toLowerCase() || "";
      let tipoSistema: EventoEletrico["tipoSistema"] = "geral";
      
      if (tipoServicoLower.includes("bateria")) tipoSistema = "bateria";
      else if (tipoServicoLower.includes("alternador") || tipoServicoLower.includes("carga")) tipoSistema = "alternador";
      else if (tipoServicoLower.includes("partida") || tipoServicoLower.includes("arranque")) tipoSistema = "partida";
      else if (tipoServicoLower.includes("modulo") || tipoServicoLower.includes("ecu") || tipoServicoLower.includes("injeção")) tipoSistema = "modulos";

      // Calcular status Modo Guerra
      const valor = os.valor_servico || 0;
      const custo = os.custo_servico || 0;
      const lucro = valor - custo;
      const margem = valor > 0 ? (lucro / valor) * 100 : 0;

      let statusModoGuerra: EventoEletrico["statusModoGuerra"] = "saudavel";
      if (margem <= 0) statusModoGuerra = "prejuizo";
      else if (margem < 15) statusModoGuerra = "margem_baixa";
      else if (margem > 50) statusModoGuerra = "excelente";

      // Valor ideal baseado em tempo técnico (R$ 3/min mínimo)
      const tempoMinutos = (os as any).tempo_diagnostico_minutos || 0;
      const valorIdeal = tempoMinutos > 0 ? Math.max(tempoMinutos * 3, 200) : null;

      return {
        id: os.id,
        data_servico: os.data_servico,
        tipo_servico: os.tipo_servico,
        descricao: os.descricao,
        status: os.status,
        valor_servico: os.valor_servico,
        custo_servico: os.custo_servico,
        lucro: os.lucro,
        km_no_servico: os.km_no_servico,
        tempo_diagnostico_minutos: (os as any).tempo_diagnostico_minutos || null,
        hipotese_diagnostico: (os as any).hipotese_diagnostico || null,
        codigo_obd: (os as any).codigo_obd || null,
        codigos_obd_lista: (os as any).codigos_obd_lista || null,
        modulos_testados: (os as any).modulos_testados || null,
        checklist_voltagem_bateria: (os as any).checklist_voltagem_bateria || null,
        tipoSistema,
        statusModoGuerra,
        valorIdeal,
      };
    });
  }, [ordensServico]);

  // Detectar recorrências
  const recorrencias = useMemo((): RecorrenciaEletrica[] => {
    const codigosMap = new Map<string, { eventos: EventoEletrico[]; total: number }>();
    const modulosMap = new Map<string, { eventos: EventoEletrico[]; total: number }>();
    const sistemasMap = new Map<string, { eventos: EventoEletrico[]; total: number }>();

    eventosEletricos.forEach((evento) => {
      // Mapear códigos OBD
      const codigos = evento.codigos_obd_lista || (evento.codigo_obd ? [evento.codigo_obd] : []);
      codigos.forEach((codigo) => {
        const existing = codigosMap.get(codigo) || { eventos: [], total: 0 };
        existing.eventos.push(evento);
        existing.total += evento.valor_servico || 0;
        codigosMap.set(codigo, existing);
      });

      // Mapear módulos testados
      (evento.modulos_testados || []).forEach((modulo) => {
        const existing = modulosMap.get(modulo) || { eventos: [], total: 0 };
        existing.eventos.push(evento);
        existing.total += evento.valor_servico || 0;
        modulosMap.set(modulo, existing);
      });

      // Mapear sistemas
      if (evento.tipoSistema !== "geral") {
        const existing = sistemasMap.get(evento.tipoSistema) || { eventos: [], total: 0 };
        existing.eventos.push(evento);
        existing.total += evento.valor_servico || 0;
        sistemasMap.set(evento.tipoSistema, existing);
      }
    });

    const result: RecorrenciaEletrica[] = [];

    // Processar códigos OBD recorrentes
    codigosMap.forEach((data, codigo) => {
      if (data.eventos.length >= 2) {
        const datas = data.eventos.map((e) => new Date(e.data_servico).getTime());
        const diasEntre = Math.round((Math.max(...datas) - Math.min(...datas)) / (1000 * 60 * 60 * 24));
        
        result.push({
          tipo: "codigo_obd",
          identificador: codigo,
          ocorrencias: data.eventos.length,
          totalGasto: data.total,
          primeiraOcorrencia: data.eventos[data.eventos.length - 1].data_servico,
          ultimaOcorrencia: data.eventos[0].data_servico,
          diasEntreOcorrencias: diasEntre,
        });
      }
    });

    // Processar módulos recorrentes
    modulosMap.forEach((data, modulo) => {
      if (data.eventos.length >= 2) {
        const datas = data.eventos.map((e) => new Date(e.data_servico).getTime());
        const diasEntre = Math.round((Math.max(...datas) - Math.min(...datas)) / (1000 * 60 * 60 * 24));
        
        result.push({
          tipo: "modulo",
          identificador: modulo,
          ocorrencias: data.eventos.length,
          totalGasto: data.total,
          primeiraOcorrencia: data.eventos[data.eventos.length - 1].data_servico,
          ultimaOcorrencia: data.eventos[0].data_servico,
          diasEntreOcorrencias: diasEntre,
        });
      }
    });

    // Processar sistemas recorrentes
    sistemasMap.forEach((data, sistema) => {
      if (data.eventos.length >= 3) {
        const datas = data.eventos.map((e) => new Date(e.data_servico).getTime());
        const diasEntre = Math.round((Math.max(...datas) - Math.min(...datas)) / (1000 * 60 * 60 * 24));
        
        result.push({
          tipo: "sistema",
          identificador: sistema,
          ocorrencias: data.eventos.length,
          totalGasto: data.total,
          primeiraOcorrencia: data.eventos[data.eventos.length - 1].data_servico,
          ultimaOcorrencia: data.eventos[0].data_servico,
          diasEntreOcorrencias: diasEntre,
        });
      }
    });

    return result.sort((a, b) => b.ocorrencias - a.ocorrencias);
  }, [eventosEletricos]);

  // Gerar resumo técnico automático
  const resumoTecnico = useMemo((): ResumoTecnico => {
    const finalizados = eventosEletricos.filter((e) => e.status === "finalizado");
    const totalDiagnosticos = finalizados.length;
    const totalGasto = finalizados.reduce((acc, e) => acc + (e.valor_servico || 0), 0);
    const tempoTecnicoTotal = finalizados.reduce((acc, e) => acc + (e.tempo_diagnostico_minutos || 0), 0);
    
    // Sistema mais problemático
    const sistemaCritico = recorrencias.length > 0 
      ? recorrencias[0].identificador 
      : null;

    // Calcular risco
    let riscoPotencial: "alto" | "medio" | "baixo" = "baixo";
    if (recorrencias.some((r) => r.diasEntreOcorrencias < 30)) {
      riscoPotencial = "alto";
    } else if (recorrencias.length > 0) {
      riscoPotencial = "medio";
    }

    // Gerar texto de resumo
    let textoResumo = "";
    if (totalDiagnosticos === 0) {
      textoResumo = "Veículo sem histórico elétrico registrado.";
    } else if (recorrencias.length === 0) {
      textoResumo = `Veículo com ${totalDiagnosticos} diagnóstico(s) elétrico(s). Sem recorrências detectadas.`;
    } else {
      const principal = recorrencias[0];
      const sistemaLabel = 
        principal.tipo === "codigo_obd" ? `código ${principal.identificador}` :
        principal.tipo === "modulo" ? `módulo ${principal.identificador}` :
        `sistema de ${principal.identificador}`;
      
      textoResumo = `Veículo com histórico recorrente de falha no ${sistemaLabel}. `;
      textoResumo += `Testado ${principal.ocorrencias}x nos últimos ${principal.diasEntreOcorrencias} dias. `;
      
      if (principal.diasEntreOcorrencias < 30) {
        textoResumo += `Risco ALTO de retorno se não corrigir causa raiz.`;
      } else if (principal.diasEntreOcorrencias < 90) {
        textoResumo += `Atenção para identificar causa raiz do problema.`;
      }
    }

    return {
      totalDiagnosticos,
      totalGasto,
      recorrencias,
      sistemaCritico,
      riscoPotencial,
      textoResumo,
      tempoTecnicoTotal,
      mediaTempoTecnico: totalDiagnosticos > 0 ? tempoTecnicoTotal / totalDiagnosticos : 0,
      valorMedioOS: totalDiagnosticos > 0 ? totalGasto / totalDiagnosticos : 0,
    };
  }, [eventosEletricos, recorrencias]);

  // Limitar eventos para planos inferiores
  const eventosVisiveis = useMemo(() => {
    if (isInfinity) return eventosEletricos;
    return eventosEletricos.slice(0, 2); // Apenas 2 últimos eventos
  }, [eventosEletricos, isInfinity]);

  const recorrenciasVisiveis = useMemo(() => {
    if (isInfinity) return recorrencias;
    return []; // Bloqueado para planos inferiores
  }, [recorrencias, isInfinity]);

  const resumoVisivel = useMemo(() => {
    if (isInfinity) return resumoTecnico;
    // Versão limitada
    return {
      ...resumoTecnico,
      recorrencias: [],
      sistemaCritico: null,
      textoResumo: resumoTecnico.totalDiagnosticos > 0 
        ? `${resumoTecnico.totalDiagnosticos} diagnóstico(s) registrado(s). Desbloqueie o Oficina Completa para ver análise completa.`
        : resumoTecnico.textoResumo,
    };
  }, [resumoTecnico, isInfinity]);

  return {
    eventosEletricos: eventosVisiveis,
    eventosCompletos: eventosEletricos,
    recorrencias: recorrenciasVisiveis,
    recorrenciasCompletas: recorrencias,
    resumoTecnico: resumoVisivel,
    resumoCompleto: resumoTecnico,
    isLoading,
    isInfinity,
    totalEventosBloqueados: eventosEletricos.length - eventosVisiveis.length,
  };
}
