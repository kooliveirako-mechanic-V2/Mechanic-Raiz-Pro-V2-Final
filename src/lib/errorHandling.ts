/**
 * Utilitários de tratamento de erro humanizado.
 * Transforma erros técnicos em mensagens amigáveis para o usuário.
 * 
 * BLINDAGEM: Estados visuais claros e humanos
 */

interface ErrorInfo {
  /** Mensagem amigável para o usuário */
  message: string;
  /** Descrição adicional opcional */
  description?: string;
  /** Se o erro é recuperável (pode tentar novamente) */
  recoverable: boolean;
  /** Ação sugerida */
  action?: string;
  /** Se os dados foram salvos localmente */
  dataSaved?: boolean;
}

type ErrorRecord = Record<string, unknown>;

export interface RuntimeErrorDiagnostics {
  message: string;
  name?: string;
  code?: string;
  details?: string;
  hint?: string;
  stack?: string;
  status?: number;
  url?: string;
  responseBody?: unknown;
}

function isErrorRecord(value: unknown): value is ErrorRecord {
  return typeof value === "object" && value !== null;
}

function getStringField(record: ErrorRecord, key: string): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function getNumberField(record: ErrorRecord, key: string): number | undefined {
  const value = record[key];
  return typeof value === "number" ? value : undefined;
}

export function extractErrorDiagnostics(error: unknown): RuntimeErrorDiagnostics {
  if (!isErrorRecord(error)) {
    return {
      message: error instanceof Error ? error.message : String(error),
      name: error instanceof Error ? error.name : undefined,
      stack: error instanceof Error ? error.stack : undefined,
    };
  }

  const response = isErrorRecord(error.response) ? error.response : undefined;

  return {
    message: getStringField(error, "message") || String(error),
    name: getStringField(error, "name"),
    code: getStringField(error, "code"),
    details: getStringField(error, "details"),
    hint: getStringField(error, "hint"),
    stack: getStringField(error, "stack"),
    status: getNumberField(error, "status") ?? getNumberField(error, "statusCode") ?? getNumberField(response || {}, "status"),
    url: getStringField(error, "url") ?? getStringField(response || {}, "url"),
    responseBody:
      error.body ??
      error.responseBody ??
      response?.body ??
      response?.data ??
      response,
  };
}

export function logDetailedError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
): RuntimeErrorDiagnostics {
  const diagnostics = extractErrorDiagnostics(error);

  console.error(context, {
    ...diagnostics,
    extra,
    raw: error,
  });

  return diagnostics;
}

// Mapa de erros conhecidos para mensagens humanizadas
const errorMap: Record<string, ErrorInfo> = {
  // Erros de rede
  "Failed to fetch": {
    message: "Sem conexão com a internet",
    description: "Verifique sua conexão e tente novamente",
    recoverable: true,
    action: "Tentar novamente",
    dataSaved: true,
  },
  "NetworkError": {
    message: "Problema de conexão",
    description: "Não foi possível conectar ao servidor",
    recoverable: true,
    action: "Tentar novamente",
    dataSaved: true,
  },
  "Load failed": {
    message: "Falha ao carregar",
    description: "Verifique sua conexão e atualize a página",
    recoverable: true,
    action: "Atualizar página",
  },
  
  // Erros de autenticação
  "JWT expired": {
    message: "Sessão expirada",
    description: "Faça login novamente para continuar",
    recoverable: false,
    action: "Fazer login",
  },
  "Invalid login credentials": {
    message: "Email ou senha incorretos",
    description: "Verifique seus dados e tente novamente",
    recoverable: true,
  },
  
  // Erros de banco de dados
  "duplicate key value": {
    message: "Registro já existe",
    description: "Um item com esses dados já foi cadastrado",
    recoverable: false,
  },
  "409": {
    message: "Conflito ao salvar",
    description: "O registro conflita com dados existentes. Tente novamente.",
    recoverable: false,
  },
  "violates foreign key constraint": {
    message: "Não é possível excluir",
    description: "Este item está sendo usado em outros registros",
    recoverable: false,
  },
  "violates not-null constraint": {
    message: "Dados incompletos",
    description: "Preencha todos os campos obrigatórios",
    recoverable: true,
  },
  
  // Erros de upload
  "Payload too large": {
    message: "Arquivo muito grande",
    description: "O tamanho máximo é 5MB por arquivo",
    recoverable: true,
    action: "Escolher arquivo menor",
  },
  
  // Erros de permissão
  "permission denied": {
    message: "Sem permissão",
    description: "Você não tem acesso a esta funcionalidade",
    recoverable: false,
  },
  "row-level security": {
    message: "Acesso negado",
    description: "Você não pode acessar estes dados",
    recoverable: false,
  },
  
  // Rate limiting
  "rate_limit_exceeded": {
    message: "Muitas operações ao mesmo tempo",
    description: "Aguarde alguns segundos e tente novamente",
    recoverable: true,
    action: "Aguardar",
  },
};

/**
 * Transforma um erro técnico em informação humanizada
 */
export function humanizeError(error: unknown): ErrorInfo {
  // Extração robusta — nunca retorna "[object Object]"
  let errorMessage = "";
  if (error instanceof Error) {
    errorMessage = error.message;
  } else if (typeof error === "string") {
    errorMessage = error;
  } else if (isErrorRecord(error)) {
    // Supabase / PostgREST: { message, details, hint, code }
    errorMessage =
      getStringField(error, "message") ||
      getStringField(error, "details") ||
      getStringField(error, "hint") ||
      getStringField(error, "error_description") ||
      getStringField(error, "code") ||
      "";
    if (!errorMessage) {
      try {
        errorMessage = JSON.stringify(error);
      } catch {
        errorMessage = "";
      }
    }
  } else if (error != null) {
    errorMessage = String(error);
  }

  // Buscar correspondência no mapa de erros
  for (const [pattern, info] of Object.entries(errorMap)) {
    if (errorMessage.toLowerCase().includes(pattern.toLowerCase())) {
      return info;
    }
  }

  // Erro genérico - ainda assim amigável.
  // DIAGNÓSTICO (BUG-MOISES): quando nem message/details/hint/code vieram, o erro
  // chegou "mudo" (fetch falhado, 401 sem corpo, CORS). Registra os campos técnicos
  // no console para classificar a causa em vez de esconder tudo atrás do fallback.
  const hasUsableMessage =
    Boolean(errorMessage) && errorMessage !== "[object Object]" && errorMessage.length < 300;

  if (!hasUsableMessage) {
    const d = logDetailedError("[humanizeError] erro sem mensagem utilizável", error);
    const technical = [
      d.name && `name=${d.name}`,
      d.status !== undefined && `status=${d.status}`,
      d.code && `code=${d.code}`,
      d.details && `details=${d.details}`,
      d.hint && `hint=${d.hint}`,
      d.url && `url=${d.url}`,
    ]
      .filter(Boolean)
      .join(" | ");

    return {
      message: "Algo deu errado",
      description: technical
        ? `Detalhe técnico: ${technical}`
        : "Tente novamente em alguns segundos. Se persistir, recarregue a página.",
      recoverable: true,
      action: "Tentar novamente",
    };
  }

  return {
    message: "Algo deu errado",
    description: errorMessage,
    recoverable: true,
    action: "Tentar novamente",
  };
}

/**
 * Verifica se o erro é transitório (vale tentar novamente)
 * NÃO retenta: constraint violations, FK inválida, 4xx lógico
 * Retenta: timeout, network, 5xx, deadlock
 */
export function isRetryableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  
  // Erros lógicos / constraint — NUNCA retentar
  if (/409|400|401|403|404|422|23505|23503|23514|duplicate|unique|foreign key|not-null|permission denied|row-level security/i.test(msg)) {
    return false;
  }
  
  // Erros transitórios — vale retentar
  if (/timeout|network|failed to fetch|deadlock|lock timeout|5\d{2}|load failed|ECONNRESET|ENOTFOUND/i.test(msg)) {
    return true;
  }
  
  return false;
}

/**
 * Wrapper para executar ação com retry automático
 * BLINDADO: só retenta erros transitórios de verdade
 */
export async function withRetry<T>(
  action: () => Promise<T>,
  options: {
    maxRetries?: number;
    delay?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const { maxRetries = 3, delay = 1000, onRetry } = options;
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await action();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      // BLINDAGEM: Só retentar erros transitórios
      if (!isRetryableError(error) || attempt === maxRetries) {
        throw lastError;
      }
      
      if (onRetry) {
        onRetry(attempt, lastError);
      }
      
      // Backoff exponencial
      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
    }
  }
  
  throw lastError!;
}

/**
 * Verifica se há conexão com a internet
 */
export function isOnline(): boolean {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

/**
 * Espera até haver conexão com a internet
 */
export function waitForOnline(): Promise<void> {
  return new Promise((resolve) => {
    if (isOnline()) {
      resolve();
      return;
    }
    
    const handler = () => {
      window.removeEventListener("online", handler);
      resolve();
    };
    
    window.addEventListener("online", handler);
  });
}

function saveEventToLocalStorage(logEntry: Record<string, unknown>): void {
  try {
    const logs = JSON.parse(localStorage.getItem("mechanic_event_logs") || "[]");
    logs.push(logEntry);

    if (logs.length > 100) {
      logs.splice(0, logs.length - 100);
    }

    localStorage.setItem("mechanic_event_logs", JSON.stringify(logs));
  } catch (error) {
    console.error("[BusinessLog] Erro ao salvar log:", error);
  }
}

/**
 * Log de evento de negócio (não técnico). Grava em audit_logs (fire-and-forget);
 * cai para localStorage se o insert falhar (ex: offline).
 */
export function logBusinessEvent(
  event: string,
  data?: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    event,
    timestamp,
    ...data,
  };

  console.log(`[BusinessEvent] ${event}`, data || "");

  void (async () => {
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { data: sess } = await supabase.auth.getSession();
      const user_id = sess?.session?.user?.id ?? null;
      let oficina_id: string | null = null;
      try {
        oficina_id = localStorage.getItem("oficina_id_ativa") ?? null;
      } catch {
        /* SSR/sandbox sem localStorage */
      }

      if (!user_id) {
        saveEventToLocalStorage(logEntry);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("audit_logs") as any).insert({
        action: event,
        table_name: "business_event",
        user_id,
        oficina_id,
        new_data: logEntry,
      });

      if (error) {
        saveEventToLocalStorage(logEntry);
      }
    } catch (err) {
      console.warn("[BusinessLog] Falha ao gravar em audit_logs, usando fallback local", err);
      saveEventToLocalStorage(logEntry);
    }
  })();
}
