import { describe, expect, it } from "vitest";
import { shouldIgnoreParentClose } from "@/lib/childModalLock";

/**
 * Item D — decisão do guardedOpenChange do OrcamentoFormModal.
 *
 * Extraída para função pura porque o eco pai↔filho de Dialog em portal NÃO é
 * reproduzível em jsdom (probe empírico: onOpenChange do pai é chamado 0x
 * quando o ItemSelector fecha por Escape) e, num teste de montagem, a guarda de
 * sujo do pai mascara a de lock. Aqui a decisão booleana é provada por mutação.
 *
 * Regra: ignora apenas FECHAMENTO (next=false) enquanto um filho está ativo;
 * abrir nunca é bloqueado.
 */

describe("Item D — shouldIgnoreParentClose (eco do ItemSelector no Orcamento)", () => {
  it("fechar com filho ativo → IGNORA (não fecha o pai)", () => {
    expect(shouldIgnoreParentClose(false, true)).toBe(true);
  });

  it("fechar sem filho ativo → NÃO ignora (pai fecha normal)", () => {
    expect(shouldIgnoreParentClose(false, false)).toBe(false);
  });

  it("ABRIR nunca é ignorado, mesmo com filho ativo", () => {
    expect(shouldIgnoreParentClose(true, true)).toBe(false);
  });

  it("abrir sem filho ativo → não ignora", () => {
    expect(shouldIgnoreParentClose(true, false)).toBe(false);
  });
});
