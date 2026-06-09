/**
 * Constantes globais — valores críticos que NUNCA devem ser hardcoded em componentes.
 * Centraliza regras de UX mobile, thresholds e padrões de segurança.
 */

export const MOBILE = {
  /** Tamanho mínimo de touch target (px) — padrão Apple/Google */
  MIN_TOUCH_TARGET: 44,
  /** Font-size mínimo para inputs (px) — evita zoom automático no iOS */
  MIN_FONT_SIZE: 16,
  /** Altura mínima de inputs (px) — h-12 em Tailwind */
  MIN_INPUT_HEIGHT: 48,
  /** Altura máxima de sheets/drawers */
  MAX_SHEET_HEIGHT: '92vh',
  /** Threshold para fechar sheet por swipe (px) */
  SWIPE_CLOSE_THRESHOLD: 80,
  /** Padding horizontal padrão (px) */
  HORIZONTAL_PADDING: 16,
} as const;

export const DEBOUNCE = {
  /** Debounce para busca (ms) */
  SEARCH: 300,
  /** Debounce para auto-save (ms) */
  AUTO_SAVE: 1000,
  /** Debounce para clique em botão (ms) */
  BUTTON_CLICK: 500,
} as const;

export const LIMITS = {
  /** Limite padrão de rows por query Supabase */
  SUPABASE_DEFAULT: 1000,
  /** Máximo de serviços recentes no dashboard */
  RECENT_SERVICES: 5,
  /** Máximo de top clientes */
  TOP_CLIENTS: 5,
} as const;
