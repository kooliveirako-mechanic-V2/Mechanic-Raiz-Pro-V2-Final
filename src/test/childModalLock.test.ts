import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  isChildModalActive,
  markChildModalClosed,
  markChildModalOpen,
} from "@/lib/childModalLock";

/**
 * Unit do MECANISMO childModalLock — a trava que impede o modal-pai de fechar
 * por eco de pointerdown/escape do Radix quando um modal-filho acaba de fechar.
 *
 * É a prova, em nível de mecanismo, de "abrir filho → pai não fecha; fechar
 * filho → pai ainda não fecha por 500ms; depois disso, libera". Até esta fase
 * o módulo não tinha nenhum teste — a Fase 3 (VeiculoFormModal) passou a
 * depender dele, então a lacuna precisa ser fechada.
 *
 * O estado do módulo é global (openCount, lastClosedAt). Cada caso avança o
 * relógio além da janela de eco no afterEach para não vazar para o próximo.
 */

describe("childModalLock — mecanismo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // Drena qualquer filho ainda aberto e ultrapassa a janela de eco para zerar
    // o estado global antes do próximo caso.
    for (let i = 0; i < 10; i++) markChildModalClosed();
    vi.advanceTimersByTime(1000);
    vi.useRealTimers();
  });

  it("sem filho aberto e fora da janela: inativo (pai pode fechar)", () => {
    expect(isChildModalActive()).toBe(false);
  });

  it("filho aberto: ativo (pai bloqueado)", () => {
    markChildModalOpen();
    expect(isChildModalActive()).toBe(true);
  });

  it("logo após fechar o filho: ainda ativo dentro do eco de 500ms", () => {
    markChildModalOpen();
    markChildModalClosed();

    // 499ms depois: ainda dentro da janela → pai continua bloqueado
    vi.advanceTimersByTime(499);
    expect(isChildModalActive()).toBe(true);
  });

  it("passada a janela de eco: libera (pai pode fechar)", () => {
    markChildModalOpen();
    markChildModalClosed();

    vi.advanceTimersByTime(501);
    expect(isChildModalActive()).toBe(false);
  });

  it("dois filhos: só libera quando ambos fecham (contador não fica negativo)", () => {
    markChildModalOpen();
    markChildModalOpen();
    expect(isChildModalActive()).toBe(true);

    markChildModalClosed();
    // ainda há 1 filho aberto → ativo independentemente do eco
    vi.advanceTimersByTime(1000);
    expect(isChildModalActive()).toBe(true);

    markChildModalClosed();
    vi.advanceTimersByTime(501);
    expect(isChildModalActive()).toBe(false);
  });

  it("close a mais não deixa o contador negativo (robustez)", () => {
    // Um markChildModalClosed órfão (ex.: cleanup duplo) não pode quebrar a
    // próxima abertura fazendo openCount virar -1.
    markChildModalClosed();
    vi.advanceTimersByTime(1000);

    markChildModalOpen();
    expect(isChildModalActive()).toBe(true);
  });
});
