import { describe, expect, it } from "vitest";
import { shouldBlockParentClose } from "@/lib/childModalLock";

/**
 * Item B — guard explícito para os filhos do OrdemServicoForm.
 *
 * A lógica de "o pai deve bloquear o fechamento?" foi extraída para
 * shouldBlockParentClose() porque montar o OrdemServicoFormModal inteiro
 * (reducer + 10 hooks + 8 subcomponentes) num teste seria caro e flaky — não
 * daria prova confiável. Aqui a decisão booleana é provada diretamente.
 *
 * Entradas: (childActive via lock/eco, anyChildOpen=Kanban/ResumoFiscal/
 * OSFinalizada aberto, msDesdeServicoRapidoFechar). Bloqueia se QUALQUER via
 * indicar filho ativo.
 */

describe("Item B — shouldBlockParentClose (guard dos filhos do OS)", () => {
  it("REGRESSÃO: nada aberto e fora do eco → NÃO bloqueia (pai fecha normal)", () => {
    expect(shouldBlockParentClose(false, false, 9999)).toBe(false);
  });

  it("filho de finalização aberto (Kanban/ResumoFiscal/OSFinalizada) → bloqueia", () => {
    expect(shouldBlockParentClose(false, true, 9999)).toBe(true);
  });

  it("lock global ativo (ServicoRapido via markChildModal) → bloqueia", () => {
    expect(shouldBlockParentClose(true, false, 9999)).toBe(true);
  });

  it("dentro do eco de 500ms após ServicoRapido fechar → bloqueia", () => {
    expect(shouldBlockParentClose(false, false, 100)).toBe(true);
  });

  it("exatamente no limite do eco (500ms) → NÃO bloqueia", () => {
    expect(shouldBlockParentClose(false, false, 500)).toBe(false);
  });

  it("todas as vias ativas → bloqueia (robustez)", () => {
    expect(shouldBlockParentClose(true, true, 0)).toBe(true);
  });
});
