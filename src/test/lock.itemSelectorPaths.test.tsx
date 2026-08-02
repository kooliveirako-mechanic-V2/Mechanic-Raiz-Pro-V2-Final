import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { isChildModalActive } from "@/lib/childModalLock";

/**
 * D2 — modo de falha grave: se algum caminho de fechamento do ItemSelector NÃO
 * chamar markChildModalClosed, o openCount fica preso em >0 e o pai (Orcamento)
 * nunca mais fecha. Este teste fecha/desmonta o ItemSelector por cada caminho e
 * assere isChildModalActive() === false ao final (após a janela de eco de 500ms).
 *
 * O ItemSelector marca via useEffect sincronizado com `open` + cleanup no
 * unmount — logo todo caminho (submit, Cancelar, ESC, clique-fora, unmount)
 * converge para open→false. Provamos os representativos: fechar via prop e
 * desmontar direto.
 */

vi.mock("@/hooks/useEstoque", () => ({ useEstoque: () => ({ itens: [], isLoading: false }) }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ canViewLucro: true }) }));
vi.mock("@/hooks/useOficinaLabels", () => ({ useOficinaLabels: () => ({ isAutoEletrica: false }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { ItemSelector } from "@/components/orcamentos/ItemSelector";

describe("D2 — ItemSelector não deixa openCount preso", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.advanceTimersByTime(1000); // ultrapassa a janela de eco entre casos
    vi.useRealTimers();
  });

  it("abrir e fechar via prop (open→false) libera a trava", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ItemSelector open onOpenChange={onOpenChange} onAddItem={vi.fn()} />,
    );
    expect(isChildModalActive()).toBe(true); // marcado ao abrir

    rerender(<ItemSelector open={false} onOpenChange={onOpenChange} onAddItem={vi.fn()} />);
    // ainda dentro do eco de 500ms
    expect(isChildModalActive()).toBe(true);
    vi.advanceTimersByTime(501);
    expect(isChildModalActive()).toBe(false); // liberou
  });

  it("desmontar com o modal aberto (unmount) libera a trava", () => {
    const { unmount } = render(
      <ItemSelector open onOpenChange={vi.fn()} onAddItem={vi.fn()} />,
    );
    expect(isChildModalActive()).toBe(true);

    unmount();
    vi.advanceTimersByTime(501);
    expect(isChildModalActive()).toBe(false);
  });

  it("abrir/fechar repetido não acumula openCount (sem vazamento)", () => {
    const onOpenChange = vi.fn();
    for (let i = 0; i < 3; i++) {
      const { rerender, unmount } = render(
        <ItemSelector open onOpenChange={onOpenChange} onAddItem={vi.fn()} />,
      );
      rerender(<ItemSelector open={false} onOpenChange={onOpenChange} onAddItem={vi.fn()} />);
      unmount();
    }
    vi.advanceTimersByTime(501);
    // se algum ciclo tivesse esquecido markChildModalClosed, openCount ficaria >0
    expect(isChildModalActive()).toBe(false);
  });
});
