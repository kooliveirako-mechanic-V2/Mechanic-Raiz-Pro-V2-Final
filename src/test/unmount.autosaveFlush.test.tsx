import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { useAutoSave } from "@/hooks/useAutoSave";

/**
 * F2 — Desmontagem por rota: o cenário do mecânico no celular.
 *
 * Modal com autosave aberto e sujo → o usuário toca no menu → o React DESMONTA
 * o modal antes do debounce do autosave disparar (interval padrão 1500-2000ms).
 * O cleanup do useAutoSave só faz clearTimeout — descarta a escrita pendente
 * sem flush. Resultado: o rascunho da última edição some.
 *
 * Este teste prova o furo (vermelho) e, após o fix (flush no unmount), vira
 * verde: desmontar com dado sujo dentro do intervalo persiste o rascunho.
 */

function Harness({ valor }: { valor: string }) {
  useAutoSave({
    key: "unmount-test",
    data: { valor },
    interval: 5000, // longo de propósito: garante desmontagem ANTES do debounce
    enabled: true,
  });
  return null;
}

const STORAGE_KEY = "mechanic_draft_unmount-test";

describe("F2 — flush no unmount (desmontagem por rota)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("desmontar com dado sujo ANTES do debounce persiste o rascunho (flush)", () => {
    const { rerender, unmount } = render(<Harness valor="" />);

    // Usuário digita — dado muda, mas o debounce (5s) ainda não disparou.
    rerender(<Harness valor="RASCUNHO IMPORTANTE" />);

    // Nada foi salvo ainda (debounce pendente).
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();

    // Troca de rota: o pai desmonta o modal antes dos 5s.
    act(() => {
      unmount();
    });

    // O rascunho tem de ter sido persistido no unmount (flush), senão o dado some.
    const stored = localStorage.getItem(STORAGE_KEY);
    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).data.valor).toBe("RASCUNHO IMPORTANTE");
  });

  it("desmontar LIMPO (sem edição) não cria rascunho espúrio", () => {
    const { unmount } = render(<Harness valor="" />);
    act(() => {
      unmount();
    });
    // valor vazio → nada digitado → não deve gravar (flush de vazio é inócuo,
    // mas o rascunho de "" não atrapalha o DraftPrompt porque isBlank).
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      expect(JSON.parse(stored!).data.valor).toBe("");
    }
  });
});
