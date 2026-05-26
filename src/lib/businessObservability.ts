/**
 * OBSERVABILIDADE DE NEGÓCIO - Métricas e Insights
 * 
 * Sistema de tracking focado em comportamento de usuário e saúde do negócio,
 * NÃO em detalhes técnicos de infraestrutura.
 * 
 * Captura:
 * - Tempo de execução de fluxos críticos
 * - Abandono de OS e formulários
 * - Correções frequentes
 * - Padrões de erro humano
 * 
 * BLINDAGEM: Observabilidade sem vigilância
 */

interface FlowMetric {
  flowId: string;
  flowName: string;
  startTime: number;
  endTime?: number;
  steps: FlowStep[];
  completed: boolean;
  abandonedAt?: string;
  oficina_id: string;
}

interface FlowStep {
  step: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

interface CorrectionEvent {
  field: string;
  originalValue: unknown;
  correctedValue: unknown;
  timestamp: string;
  context: string;
}

interface ErrorPattern {
  type: string;
  count: number;
  lastOccurrence: string;
  context: string;
}

// Storage keys
const FLOW_METRICS_KEY = "mechanic_flow_metrics";
const CORRECTIONS_KEY = "mechanic_corrections";
const ERROR_PATTERNS_KEY = "mechanic_error_patterns";
const SESSION_KEY = "mechanic_session";

// Limites de armazenamento
const MAX_FLOW_METRICS = 100;
const MAX_CORRECTIONS = 200;
const MAX_ERROR_PATTERNS = 50;

/**
 * Gera um ID único para fluxos
 */
function generateFlowId(): string {
  return `flow_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Carrega dados do localStorage com fallback seguro
 */
function loadStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch {
    return defaultValue;
  }
}

/**
 * Salva dados no localStorage
 */
function saveStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`[Observability] Erro ao salvar ${key}:`, error);
  }
}

// ============================================
// FLUXOS CRÍTICOS
// ============================================

const activeFlows = new Map<string, FlowMetric>();

/**
 * Inicia tracking de um fluxo crítico
 */
export function startFlow(flowName: string, oficina_id: string): string {
  const flowId = generateFlowId();
  
  const metric: FlowMetric = {
    flowId,
    flowName,
    startTime: Date.now(),
    steps: [],
    completed: false,
    oficina_id,
  };

  activeFlows.set(flowId, metric);
  
  console.log(`[Flow] Iniciado: ${flowName} (${flowId})`);
  
  return flowId;
}

/**
 * Registra um passo dentro de um fluxo
 */
export function trackFlowStep(flowId: string, step: string, data?: Record<string, unknown>): void {
  const metric = activeFlows.get(flowId);
  if (!metric) return;

  metric.steps.push({
    step,
    timestamp: Date.now(),
    data,
  });

  console.log(`[Flow] Step: ${step} (${flowId})`);
}

/**
 * Finaliza um fluxo com sucesso
 */
export function completeFlow(flowId: string): void {
  const metric = activeFlows.get(flowId);
  if (!metric) return;

  metric.endTime = Date.now();
  metric.completed = true;

  const duration = metric.endTime - metric.startTime;
  
  console.log(`[Flow] Completado: ${metric.flowName} em ${duration}ms`);

  // Salvar métrica
  const metrics = loadStorage<FlowMetric[]>(FLOW_METRICS_KEY, []);
  metrics.push(metric);
  
  // Limitar tamanho
  if (metrics.length > MAX_FLOW_METRICS) {
    metrics.splice(0, metrics.length - MAX_FLOW_METRICS);
  }
  
  saveStorage(FLOW_METRICS_KEY, metrics);
  activeFlows.delete(flowId);
}

/**
 * Registra abandono de um fluxo
 */
export function abandonFlow(flowId: string, reason?: string): void {
  const metric = activeFlows.get(flowId);
  if (!metric) return;

  metric.endTime = Date.now();
  metric.completed = false;
  metric.abandonedAt = metric.steps.length > 0 
    ? metric.steps[metric.steps.length - 1].step 
    : "inicio";

  const duration = metric.endTime - metric.startTime;
  
  console.log(`[Flow] Abandonado: ${metric.flowName} em "${metric.abandonedAt}" após ${duration}ms. Razão: ${reason || "não especificada"}`);

  // Salvar métrica de abandono
  const metrics = loadStorage<FlowMetric[]>(FLOW_METRICS_KEY, []);
  metrics.push(metric);
  
  if (metrics.length > MAX_FLOW_METRICS) {
    metrics.splice(0, metrics.length - MAX_FLOW_METRICS);
  }
  
  saveStorage(FLOW_METRICS_KEY, metrics);
  activeFlows.delete(flowId);
}

// ============================================
// CORREÇÕES DE DADOS
// ============================================

/**
 * Registra uma correção feita pelo usuário
 */
export function trackCorrection(
  field: string,
  originalValue: unknown,
  correctedValue: unknown,
  context: string
): void {
  const correction: CorrectionEvent = {
    field,
    originalValue,
    correctedValue,
    timestamp: new Date().toISOString(),
    context,
  };

  console.log(`[Correction] ${field}: ${JSON.stringify(originalValue)} → ${JSON.stringify(correctedValue)}`);

  const corrections = loadStorage<CorrectionEvent[]>(CORRECTIONS_KEY, []);
  corrections.push(correction);
  
  if (corrections.length > MAX_CORRECTIONS) {
    corrections.splice(0, corrections.length - MAX_CORRECTIONS);
  }
  
  saveStorage(CORRECTIONS_KEY, corrections);
}

/**
 * Analisa padrões de correção para identificar pontos de fricção
 */
export function analyzeCorrectionPatterns(): Record<string, number> {
  const corrections = loadStorage<CorrectionEvent[]>(CORRECTIONS_KEY, []);
  
  const patterns: Record<string, number> = {};
  
  for (const correction of corrections) {
    const key = `${correction.context}:${correction.field}`;
    patterns[key] = (patterns[key] || 0) + 1;
  }
  
  // Ordenar por frequência
  const sorted = Object.entries(patterns)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10);
  
  return Object.fromEntries(sorted);
}

// ============================================
// PADRÕES DE ERRO HUMANO
// ============================================

/**
 * Registra um erro humano (não técnico)
 */
export function trackHumanError(type: string, context: string): void {
  const patterns = loadStorage<ErrorPattern[]>(ERROR_PATTERNS_KEY, []);
  
  const existing = patterns.find((p) => p.type === type && p.context === context);
  
  if (existing) {
    existing.count += 1;
    existing.lastOccurrence = new Date().toISOString();
  } else {
    patterns.push({
      type,
      count: 1,
      lastOccurrence: new Date().toISOString(),
      context,
    });
  }
  
  if (patterns.length > MAX_ERROR_PATTERNS) {
    // Remover os menos frequentes
    patterns.sort((a, b) => b.count - a.count);
    patterns.splice(MAX_ERROR_PATTERNS);
  }
  
  saveStorage(ERROR_PATTERNS_KEY, patterns);
  
  console.log(`[HumanError] ${type} em ${context}`);
}

/**
 * Retorna os padrões de erro mais comuns
 */
export function getTopErrorPatterns(limit = 5): ErrorPattern[] {
  const patterns = loadStorage<ErrorPattern[]>(ERROR_PATTERNS_KEY, []);
  return patterns.sort((a, b) => b.count - a.count).slice(0, limit);
}

// ============================================
// MÉTRICAS DE SESSÃO
// ============================================

interface SessionMetrics {
  sessionId: string;
  startTime: string;
  pageViews: string[];
  actionsCompleted: number;
  errorsEncountered: number;
  oficina_id?: string;
}

let currentSession: SessionMetrics | null = null;

/**
 * Inicia uma nova sessão de métricas
 */
export function startSession(oficina_id?: string): void {
  currentSession = {
    sessionId: `session_${Date.now()}`,
    startTime: new Date().toISOString(),
    pageViews: [],
    actionsCompleted: 0,
    errorsEncountered: 0,
    oficina_id,
  };
  
  saveStorage(SESSION_KEY, currentSession);
}

/**
 * Registra visualização de página
 */
export function trackPageView(page: string): void {
  if (!currentSession) {
    currentSession = loadStorage<SessionMetrics | null>(SESSION_KEY, null);
  }
  
  if (currentSession) {
    currentSession.pageViews.push(page);
    saveStorage(SESSION_KEY, currentSession);
  }
}

/**
 * Incrementa contador de ações completadas
 */
export function trackActionCompleted(): void {
  if (!currentSession) {
    currentSession = loadStorage<SessionMetrics | null>(SESSION_KEY, null);
  }
  
  if (currentSession) {
    currentSession.actionsCompleted += 1;
    saveStorage(SESSION_KEY, currentSession);
  }
}

/**
 * Incrementa contador de erros encontrados
 */
export function trackErrorEncountered(): void {
  if (!currentSession) {
    currentSession = loadStorage<SessionMetrics | null>(SESSION_KEY, null);
  }
  
  if (currentSession) {
    currentSession.errorsEncountered += 1;
    saveStorage(SESSION_KEY, currentSession);
  }
}

// ============================================
// RELATÓRIO CONSOLIDADO
// ============================================

interface ObservabilityReport {
  flows: {
    total: number;
    completed: number;
    abandoned: number;
    avgDurationMs: number;
    topAbandonment: { step: string; count: number }[];
  };
  corrections: {
    total: number;
    topFields: { field: string; count: number }[];
  };
  errors: {
    total: number;
    topPatterns: ErrorPattern[];
  };
  session: SessionMetrics | null;
}

/**
 * Gera relatório consolidado de observabilidade
 */
export function generateReport(): ObservabilityReport {
  const flowMetrics = loadStorage<FlowMetric[]>(FLOW_METRICS_KEY, []);
  const corrections = loadStorage<CorrectionEvent[]>(CORRECTIONS_KEY, []);
  const errorPatterns = loadStorage<ErrorPattern[]>(ERROR_PATTERNS_KEY, []);
  const session = loadStorage<SessionMetrics | null>(SESSION_KEY, null);

  // Análise de fluxos
  const completedFlows = flowMetrics.filter((f) => f.completed);
  const abandonedFlows = flowMetrics.filter((f) => !f.completed);
  
  const avgDuration = completedFlows.length > 0
    ? completedFlows.reduce((sum, f) => sum + (f.endTime! - f.startTime), 0) / completedFlows.length
    : 0;

  // Top pontos de abandono
  const abandonmentMap: Record<string, number> = {};
  for (const flow of abandonedFlows) {
    if (flow.abandonedAt) {
      abandonmentMap[flow.abandonedAt] = (abandonmentMap[flow.abandonedAt] || 0) + 1;
    }
  }
  const topAbandonment = Object.entries(abandonmentMap)
    .map(([step, count]) => ({ step, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Top campos corrigidos
  const correctionPatterns = analyzeCorrectionPatterns();
  const topFields = Object.entries(correctionPatterns)
    .map(([field, count]) => ({ field, count }))
    .slice(0, 5);

  return {
    flows: {
      total: flowMetrics.length,
      completed: completedFlows.length,
      abandoned: abandonedFlows.length,
      avgDurationMs: Math.round(avgDuration),
      topAbandonment,
    },
    corrections: {
      total: corrections.length,
      topFields,
    },
    errors: {
      total: errorPatterns.reduce((sum, p) => sum + p.count, 0),
      topPatterns: getTopErrorPatterns(5),
    },
    session,
  };
}

/**
 * Limpa todos os dados de observabilidade
 */
export function clearObservabilityData(): void {
  localStorage.removeItem(FLOW_METRICS_KEY);
  localStorage.removeItem(CORRECTIONS_KEY);
  localStorage.removeItem(ERROR_PATTERNS_KEY);
  localStorage.removeItem(SESSION_KEY);
  activeFlows.clear();
  currentSession = null;
  
  console.log("[Observability] Dados limpos");
}
