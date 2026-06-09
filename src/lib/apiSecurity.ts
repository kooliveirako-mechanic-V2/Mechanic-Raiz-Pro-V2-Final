/**
 * SEGURANÇA DE API - Rate Limiting, Validação e Logging
 * 
 * Funções utilitárias para proteger edge functions:
 * - Rate limiting por IP/usuário
 * - Validação de input robusta
 * - Logging de segurança
 * 
 * BLINDAGEM: API blindada contra ataques comuns
 */

// Cache de rate limiting em memória
const rateLimitCache = new Map<string, { count: number; resetAt: number }>();

interface RateLimitOptions {
  /** Número máximo de requisições */
  maxRequests: number;
  /** Janela de tempo em segundos */
  windowSeconds: number;
  /** Identificador do recurso (para logging) */
  resource?: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

/**
 * Verifica rate limit para uma chave (IP, user_id, etc.)
 */
export function checkRateLimit(
  key: string,
  options: RateLimitOptions
): RateLimitResult {
  const now = Date.now();
  const windowMs = options.windowSeconds * 1000;
  
  // Limpar entradas expiradas periodicamente
  if (Math.random() < 0.1) { // 10% das chamadas
    cleanExpiredRateLimits();
  }
  
  const existing = rateLimitCache.get(key);
  
  if (!existing || existing.resetAt < now) {
    // Nova janela
    rateLimitCache.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });
    
    return {
      allowed: true,
      remaining: options.maxRequests - 1,
      resetAt: now + windowMs,
    };
  }
  
  if (existing.count >= options.maxRequests) {
    // Limite atingido
    const retryAfter = Math.ceil((existing.resetAt - now) / 1000);
    
    console.log(`[RateLimit] Bloqueado: ${key} | Resource: ${options.resource || 'unknown'}`);
    
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
      retryAfter,
    };
  }
  
  // Incrementar contador
  existing.count += 1;
  
  return {
    allowed: true,
    remaining: options.maxRequests - existing.count,
    resetAt: existing.resetAt,
  };
}

function cleanExpiredRateLimits(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitCache.entries()) {
    if (value.resetAt < now) {
      rateLimitCache.delete(key);
    }
  }
}

/**
 * Extrai IP do cliente da requisição
 */
export function getClientIP(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim();
  }
  
  const realIP = req.headers.get("x-real-ip");
  if (realIP) {
    return realIP;
  }
  
  return "unknown";
}

/**
 * Retorna resposta HTTP de rate limit excedido
 */
export function rateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: "Muitas requisições",
      message: "Por favor, aguarde antes de tentar novamente",
      retryAfter,
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": retryAfter.toString(),
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

// ============================================
// VALIDAÇÃO DE INPUT
// ============================================

interface ValidationRule {
  field: string;
  type: "string" | "number" | "email" | "uuid" | "date" | "boolean" | "array";
  required?: boolean;
  maxLength?: number;
  minLength?: number;
  min?: number;
  max?: number;
  pattern?: RegExp;
}

interface ValidationResult {
  valid: boolean;
  errors: { field: string; message: string }[];
}

/**
 * Valida input contra um schema de regras
 */
export function validateInput(
  data: Record<string, unknown>,
  rules: ValidationRule[]
): ValidationResult {
  const errors: { field: string; message: string }[] = [];
  
  for (const rule of rules) {
    const value = data[rule.field];
    
    // Verificar obrigatoriedade
    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push({ field: rule.field, message: `${rule.field} é obrigatório` });
      continue;
    }
    
    // Pular validação se não obrigatório e vazio
    if (!rule.required && (value === undefined || value === null || value === "")) {
      continue;
    }
    
    // Validar tipo
    switch (rule.type) {
      case "string":
        if (typeof value !== "string") {
          errors.push({ field: rule.field, message: `${rule.field} deve ser texto` });
        } else {
          if (rule.maxLength && value.length > rule.maxLength) {
            errors.push({ field: rule.field, message: `${rule.field} excede ${rule.maxLength} caracteres` });
          }
          if (rule.minLength && value.length < rule.minLength) {
            errors.push({ field: rule.field, message: `${rule.field} deve ter no mínimo ${rule.minLength} caracteres` });
          }
          if (rule.pattern && !rule.pattern.test(value)) {
            errors.push({ field: rule.field, message: `${rule.field} tem formato inválido` });
          }
        }
        break;
        
      case "number":
        const num = Number(value);
        if (isNaN(num)) {
          errors.push({ field: rule.field, message: `${rule.field} deve ser número` });
        } else {
          if (rule.min !== undefined && num < rule.min) {
            errors.push({ field: rule.field, message: `${rule.field} deve ser no mínimo ${rule.min}` });
          }
          if (rule.max !== undefined && num > rule.max) {
            errors.push({ field: rule.field, message: `${rule.field} deve ser no máximo ${rule.max}` });
          }
        }
        break;
        
      case "email":
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (typeof value !== "string" || !emailRegex.test(value)) {
          errors.push({ field: rule.field, message: `${rule.field} deve ser email válido` });
        }
        break;
        
      case "uuid":
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (typeof value !== "string" || !uuidRegex.test(value)) {
          errors.push({ field: rule.field, message: `${rule.field} deve ser UUID válido` });
        }
        break;
        
      case "date":
        const date = new Date(value as string);
        if (isNaN(date.getTime())) {
          errors.push({ field: rule.field, message: `${rule.field} deve ser data válida` });
        }
        break;
        
      case "boolean":
        if (typeof value !== "boolean") {
          errors.push({ field: rule.field, message: `${rule.field} deve ser booleano` });
        }
        break;
        
      case "array":
        if (!Array.isArray(value)) {
          errors.push({ field: rule.field, message: `${rule.field} deve ser lista` });
        }
        break;
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitiza string para prevenir XSS básico
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

// ============================================
// LOGGING DE SEGURANÇA
// ============================================

type SecurityEventType = 
  | "auth_success"
  | "auth_failure"
  | "rate_limit_exceeded"
  | "validation_failed"
  | "unauthorized_access"
  | "suspicious_activity";

interface SecurityEvent {
  type: SecurityEventType;
  ip: string;
  userAgent?: string;
  userId?: string;
  resource?: string;
  details?: Record<string, unknown>;
  timestamp: string;
}

/**
 * Loga evento de segurança
 */
export function logSecurityEvent(
  type: SecurityEventType,
  req: Request,
  details?: Record<string, unknown>
): void {
  const event: SecurityEvent = {
    type,
    ip: getClientIP(req),
    userAgent: req.headers.get("user-agent") || undefined,
    resource: new URL(req.url).pathname,
    details,
    timestamp: new Date().toISOString(),
  };
  
  // Log estruturado para fácil parsing
  console.log(`[SECURITY] ${JSON.stringify(event)}`);
}

/**
 * Detecta padrões suspeitos na requisição
 */
export function detectSuspiciousPatterns(req: Request): boolean {
  const userAgent = req.headers.get("user-agent") || "";
  const url = req.url;
  
  // Lista de padrões suspeitos
  const suspiciousPatterns = [
    /sqlmap/i,
    /nikto/i,
    /nessus/i,
    /burp/i,
    /\.\.\//,  // Path traversal
    /<script/i,  // XSS attempt
    /union\s+select/i,  // SQL injection
    /exec\s*\(/i,  // Command injection
  ];
  
  const combined = `${userAgent} ${url}`;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(combined)) {
      logSecurityEvent("suspicious_activity", req, { 
        pattern: pattern.source 
      });
      return true;
    }
  }
  
  return false;
}

/**
 * Middleware de segurança para edge functions
 * Combina rate limiting, validação e logging
 */
export async function securityMiddleware(
  req: Request,
  options: {
    rateLimitKey?: string;
    maxRequests?: number;
    windowSeconds?: number;
    blockSuspicious?: boolean;
  } = {}
): Promise<Response | null> {
  const {
    rateLimitKey,
    maxRequests = 60,
    windowSeconds = 60,
    blockSuspicious = true,
  } = options;
  
  // Detectar padrões suspeitos
  if (blockSuspicious && detectSuspiciousPatterns(req)) {
    return new Response(
      JSON.stringify({ error: "Requisição bloqueada" }),
      { status: 403, headers: { "Content-Type": "application/json" } }
    );
  }
  
  // Rate limiting
  const key = rateLimitKey || getClientIP(req);
  const rateLimit = checkRateLimit(key, {
    maxRequests,
    windowSeconds,
    resource: new URL(req.url).pathname,
  });
  
  if (!rateLimit.allowed) {
    logSecurityEvent("rate_limit_exceeded", req);
    return rateLimitResponse(rateLimit.retryAfter!);
  }
  
  // Requisição permitida
  return null;
}
