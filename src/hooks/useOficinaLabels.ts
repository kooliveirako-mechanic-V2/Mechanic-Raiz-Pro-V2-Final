import { useOficina } from "@/contexts/OficinaContext";

/**
 * Hook que retorna labels e textos adaptados ao tipo de oficina
 * Permite que a UI se adapte automaticamente sem criar novos módulos
 */
export function useOficinaLabels() {
  const { oficinaAtual } = useOficina();
  const tipoOficina = oficinaAtual?.tipo || "ambos";
  const isAutoEletrica = tipoOficina === "auto_eletrica";

  const labels = {
    // Dashboard - Modo Guerra Pro
    servicosHoje: isAutoEletrica ? "Diagnósticos Hoje" : "Serviços Hoje",
    faturamentoMes: isAutoEletrica ? "Faturamento Elétrica" : "Faturamento do Mês",
    lucroMes: isAutoEletrica ? "Resultado por Diagnóstico" : "Lucro do Mês",
    clientesMes: "Clientes do Mês",
    
    // Estoque - Componentes para Auto Elétrica
    estoqueBaixo: isAutoEletrica ? "Componentes em Falta" : "Estoque Baixo",
    estoqueCategoria: isAutoEletrica ? "Componentes Eletrônicos" : "Peças e Produtos",
    novoItem: isAutoEletrica ? "Novo Componente" : "Novo Item",
    
    // OS - Nomenclatura de Autoridade Técnica
    novaOS: isAutoEletrica ? "Novo Diagnóstico" : "Nova OS",
    tipoServico: isAutoEletrica ? "Tipo de Serviço Elétrico" : "Tipo de Serviço",
    descricaoServico: isAutoEletrica ? "Sintoma / Problema Relatado" : "Descrição do Serviço",
    ordemServico: isAutoEletrica ? "Diagnóstico" : "Ordem de Serviço",
    ordemServicoAbrev: isAutoEletrica ? "Diag." : "OS",
    listaOS: isAutoEletrica ? "Diagnósticos" : "Serviços",
    
    // Lucro / Resultado - Clareza Operacional
    lucroOS: isAutoEletrica ? "Resultado do Diagnóstico" : "Lucro da OS",
    lucroServico: isAutoEletrica ? "Resultado do Serviço" : "Lucro do Serviço",
    margemServico: isAutoEletrica ? "Rentabilidade do Diagnóstico" : "Margem do Serviço",
    rentabilidade: isAutoEletrica ? "Rentabilidade" : "Margem",
    
    // Tempo Técnico - Valor do trabalho
    tempoServico: isAutoEletrica ? "Tempo Técnico" : "Tempo de Serviço",
    tempoDiagnostico: isAutoEletrica ? "Tempo de Análise" : "Tempo de Diagnóstico",
    tempoTecnico: "Tempo Técnico",
    
    // DVI Elétrico - Processo, não achismo
    checklistEntrada: isAutoEletrica ? "DVI Elétrico" : "Checklist de Entrada",
    checklistDVI: isAutoEletrica ? "Diagnóstico Visual Interativo" : "Checklist DVI",
    fotosEntrada: isAutoEletrica ? "Fotos do Diagnóstico" : "Fotos de Entrada",
    hipoteseDiagnostico: isAutoEletrica ? "Conclusão Técnica do Diagnóstico" : "Hipótese de Diagnóstico",
    
    // Geral
    oficinaTipo: isAutoEletrica ? "Auto Elétrica" : 
                 tipoOficina === "moto" ? "Oficina de Motos" :
                 tipoOficina === "carro" ? "Oficina de Carros" : "Oficina",
    
    // Ações
    diagnostico: isAutoEletrica ? "Diagnóstico Eletrônico" : "Diagnóstico",
    
    // Status especiais - Linguagem de oficina
    statusEmDiagnostico: "Em Diagnóstico",
    statusAguardandoAnalise: "Aguardando Análise",
    statusEmExecucao: isAutoEletrica ? "Em Execução" : "Em Andamento",
    
    // Kanban/Status - Adaptados
    aguardando: isAutoEletrica ? "Aguardando Análise" : "Aguardando",
    emAndamento: isAutoEletrica ? "Em Execução" : "Em Andamento",
    emDiagnostico: "Em Diagnóstico",
    aguardandoPeca: isAutoEletrica ? "Aguard. Componente" : "Aguard. Peça",
    
    // Alertas Modo Guerra - Acionáveis
    alertaDiagnostico: isAutoEletrica 
      ? "Diagnóstico subvalorizado" 
      : "Serviço com margem baixa",
    alertaTempo: isAutoEletrica 
      ? "Tempo técnico vs valor cobrado" 
      : "Tempo vs receita",
    alertaModoGuerra: isAutoEletrica
      ? "Modo Guerra detectou diagnóstico subvalorizado"
      : "Modo Guerra identificou margem crítica",
    
    // Insights Modo Guerra
    insightPrejuizo: "Você pode estar pagando para trabalhar",
    insightSubvalorizado: "Esse serviço pode estar comprometendo sua margem",
    insightProcesso: "Diagnóstico elétrico não é achismo. Aqui ele vira processo.",
  };

  const placeholders = {
    descricaoOS: isAutoEletrica 
      ? "Ex: Som não liga, carro não dá partida, luz do painel..." 
      : "Descreva o serviço a ser realizado...",
    observacoes: isAutoEletrica
      ? "Códigos de erro, testes realizados, observações técnicas..."
      : "Observações adicionais...",
  };

  const tips = {
    diagnostico: isAutoEletrica
      ? "Use o campo de código OBD para registrar falhas encontradas"
      : null,
    fotos: isAutoEletrica
      ? "Registre fotos do scanner, diagrama elétrico e componentes"
      : "Registre fotos da entrada do veículo",
  };

  return {
    labels,
    placeholders,
    tips,
    isAutoEletrica,
    tipoOficina,
  };
}
