import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Ciclo do COMPONENTE REAL — FinanceiroPreFiscalModal.
 *
 * O mais caro dos quatro: 6 hooks de dados + useAutoSave (localStorage).
 * Custo medido e reportado antes de escrever — não é proibitivo, então nenhuma
 * asserção foi reduzida.
 *
 * Todos os mocks com identidade estável via vi.hoisted (regra da fase): objeto
 * novo a cada render re-dispara efeitos e produz falso-vermelho.
 */

const H = vi.hoisted(() => ({
  createRegistro: vi.fn((_input: unknown, opts?: { onSuccess?: () => void }) => {
    opts?.onSuccess?.();
  }),
  categoriasEntrada: [{ id: "cat-1", nome: "Serviços" }],
  categoriasSaida: [{ id: "cat-2", nome: "Peças" }],
  centrosCusto: [{ id: "cc-1", nome: "Oficina" }],
  fornecedores: [{ id: "for-1", nome: "Distribuidora" }],
  formasPagamento: [{ id: "fp-1", nome: "Dinheiro", padrao: true }],
  noop: vi.fn(),
}));

vi.mock("@/hooks/useFinanceiroPreFiscal", () => ({
  useFinanceiroPreFiscal: () => ({ createRegistro: H.createRegistro, isCreating: false }),
  PREJUIZO_LABELS: {} as Record<string, string>,
}));
vi.mock("@/hooks/useCategoriasFinanceiras", () => ({
  useCategoriasFinanceiras: () => ({
    categoriasEntrada: H.categoriasEntrada,
    categoriasSaida: H.categoriasSaida,
    createCategoria: H.noop,
  }),
}));
vi.mock("@/hooks/useCentrosCusto", () => ({
  useCentrosCusto: () => ({ centrosCusto: H.centrosCusto, createCentroCusto: H.noop }),
}));
vi.mock("@/hooks/useFornecedores", () => ({
  useFornecedores: () => ({ fornecedores: H.fornecedores, createFornecedor: H.noop }),
}));
vi.mock("@/hooks/useFormasPagamento", () => ({
  useFormasPagamento: () => ({ formasPagamento: H.formasPagamento, createFormaPagamento: H.noop }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { FinanceiroPreFiscalModal } from "@/components/forms/FinanceiroPreFiscalModal";

/** Digita no campo Valor (CurrencyInput) — é o campo obrigatório do form. */
function digitarValor(v: string) {
  const input = document.getElementById("valor") as HTMLInputElement;
  fireEvent.change(input, { target: { value: v } });
  return input;
}

describe("ciclo real — FinanceiroPreFiscalModal", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // useAutoSave persiste em localStorage; rascunho antigo abriria o
    // DraftPromptDialog e contaminaria a asserção.
    localStorage.clear();
    onOpenChange = vi.fn();
    vi.clearAllMocks();
  });

  it("1. LIMPO: Cancelar fecha (nao prende o usuario)", async () => {
    render(<FinanceiroPreFiscalModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("valor")).toBeTruthy());

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("2. SUJO: Cancelar avisa e NAO fecha", async () => {
    render(<FinanceiroPreFiscalModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("valor")).toBeTruthy());

    digitarValor("1500");
    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("3. 'Continuar editando' mantem aberto e preserva o valor", async () => {
    render(<FinanceiroPreFiscalModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("valor")).toBeTruthy());

    digitarValor("1500");
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Continuar editando"));

    expect(onOpenChange).not.toHaveBeenCalled();
    const input = document.getElementById("valor") as HTMLInputElement;
    expect(input.value).not.toBe("");
  });

  it("4. 'Descartar' fecha", async () => {
    render(<FinanceiroPreFiscalModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("valor")).toBeTruthy());

    digitarValor("1500");
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    // Atenção: este modal usa confirmText="Sair" (:667), não "Descartar" como os
    // outros três. Divergência de copy entre formulários — anotada, não uniformizada
    // aqui para o commit não misturar teste com mudança de texto de UI.
    fireEvent.click(screen.getByText("Sair"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
