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
