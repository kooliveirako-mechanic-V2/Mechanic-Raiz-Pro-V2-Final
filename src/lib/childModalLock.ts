/**
 * Trava compartilhada para evitar que modais-pais (OS form, OS rápida etc.)
 * fechem por engano quando um modal-filho (ServicoRapidoModal, AlertDialog…)
 * acaba de fechar e o Radix propaga pointerdown/escape/focusout para o overlay
 * do pai no mesmo tick.
 *
 * Uso:
 *   - Filho chama markChildModalOpen() ao abrir e markChildModalClosed() ao fechar.
 *   - Pai chama isChildModalActive() dentro de onOpenChange / onInteractOutside /
 *     onPointerDownOutside / onEscapeKeyDown / onFocusOutside e bloqueia o fechamento
 *     enquanto a função retornar true.
 *
 * A janela de carência (CHILD_CLOSE_ECHO_MS) cobre o eco do Radix após o filho fechar.
 */

const CHILD_CLOSE_ECHO_MS = 500;

let openCount = 0;
let lastClosedAt = 0;

export function markChildModalOpen(): void {
  openCount += 1;
}

export function markChildModalClosed(): void {
  openCount = Math.max(0, openCount - 1);
  lastClosedAt = Date.now();
}

export function isChildModalActive(): boolean {
  if (openCount > 0) return true;
  return Date.now() - lastClosedAt < CHILD_CLOSE_ECHO_MS;
}

/**
 * Item D — decisão PURA de "o pai deve IGNORAR esta tentativa de fechamento?".
 *
 * Extraída porque o eco pai↔filho de Dialog em portal NÃO é reproduzível em
 * jsdom (probe empírico: onOpenChange do pai é chamado 0x quando o filho fecha
 * por Escape) e a guarda de sujo do pai mascara a de lock num teste de montagem.
 * A lógica booleana vive aqui e é provada por mutação, como shouldBlockParentClose.
 *
 * Ignora apenas FECHAMENTOS (next === false) enquanto um modal-filho está ativo.
 * Abrir (next === true) nunca é bloqueado.
 */
export function shouldIgnoreParentClose(next: boolean, childActive: boolean): boolean {
  return !next && childActive;
}

/**
 * Item B — decisão PURA de "o pai deve bloquear o próprio fechamento?".
 *
 * Extraída para ser testável sem montar o OrdemServicoFormModal inteiro (reducer
 * + 10 hooks + 8 subcomponentes). O componente liga estas 3 entradas; a lógica
 * booleana vive aqui e é provada por mutação.
 *
 * @param childActive   trava global (isChildModalActive) — filho via lock/eco
 * @param anyChildOpen  algum filho de finalização aberto (Kanban/ResumoFiscal/OSFinalizada)
 * @param sinceServicoRapidoClosedMs  ms desde que o ServicoRapido fechou (eco local)
 */
export function shouldBlockParentClose(
  childActive: boolean,
  anyChildOpen: boolean,
  sinceServicoRapidoClosedMs: number
): boolean {
  if (childActive) return true;
  if (anyChildOpen) return true;
  return sinceServicoRapidoClosedMs < CHILD_CLOSE_ECHO_MS;
}
