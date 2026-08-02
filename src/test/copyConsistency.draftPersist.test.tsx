import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * PROVA de persistência do rascunho (Item 11 — regra da copy de saída).
 *
 * A regra é: se o dado fica recuperável ao sair → confirmText="Sair"; se se
 * perde → "Descartar". Este teste PROVA, em runtime, que nos modais com
 * useAutoSave o rascunho sobrevive ao fechamento e é reoferecido na reabertura
 * (DraftPromptDialog). Ou seja: nesses modais, "Descartar" seria copy mentirosa.
 *
 * Usa o FinanceiroPreFiscalModal (um dos 2 que HOJE usam "Sair", corretamente)
 * com useAutoSave REAL (localStorage), só os hooks de dados mockados.
 */

const H = vi.hoisted(() => ({
  createRegistro: vi.fn(),
  noop: vi.fn(),
}));

vi.mock("@/hooks/useFinanceiroPreFiscal", () => ({
  useFinanceiroPreFiscal: () => ({ createRegistro: H.createRegistro, isCreating: false }),
  PREJUIZO_LABELS: {} as Record<string, string>,
}));
vi.mock("@/hooks/useCategoriasFinanceiras", () => ({
  useCategoriasFinanceiras: () => ({ categoriasEntrada: [], categoriasSaida: [], createCategoria: H.noop }),
}));
vi.mock("@/hooks/useCentrosCusto", () => ({
  useCentrosCusto: () => ({ centrosCusto: [], createCentroCusto: H.noop }),
}));
vi.mock("@/hooks/useFornecedores", () => ({
  useFornecedores: () => ({ fornecedores: [], createFornecedor: H.noop }),
}));
vi.mock("@/hooks/useFormasPagamento", () => ({
  useFormasPagamento: () => ({ formasPagamento: [], createFormaPagamento: H.noop }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { FinanceiroPreFiscalModal } from "@/components/forms/FinanceiroPreFiscalModal";

describe("Item 11 — prova de persistência do rascunho (regra da copy)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("modal com autosave: sair sujo → rascunho persiste → reabrir OFERECE retomar", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<FinanceiroPreFiscalModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("valor")).toBeTruthy());

    // Preenche o valor obrigatório — autosave grava no localStorage.
    fireEvent.change(document.getElementById("valor")!, { target: { value: "1500" } });

    // Aguarda o autosave persistir (intervalo 1500ms; usamos o efeito real).
    await waitFor(
      () => {
        const chaves = Object.keys(localStorage).filter((k) => k.includes("financeiro-prefiscal"));
        expect(chaves.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    // Fecha o modal (equivalente a confirmar a saída).
    rerender(<FinanceiroPreFiscalModal open={false} onOpenChange={onOpenChange} />);

    // Reabre: como há rascunho, o DraftPromptDialog oferece retomar.
    rerender(<FinanceiroPreFiscalModal open onOpenChange={onOpenChange} />);

    await waitFor(() => {
      // O texto do DraftPromptDialog inclui "Retomar" / "rascunho".
      const temRetomar =
        screen.queryByText(/retomar/i) || screen.queryByText(/rascunho/i);
      expect(temRetomar).toBeTruthy();
    });
  });
});
