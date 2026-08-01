import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Ciclo do COMPONENTE REAL — FinanceiroFormModal.
 *
 * Só criação (não há modo edição): snapshotReady default (true) basta, sem
 * flag hydrated. Autosave em localStorage — limpar entre casos senão o
 * DraftPromptDialog abre e contamina a asserção.
 *
 * Mock estável via vi.hoisted (regra da fase).
 */

const H = vi.hoisted(() => ({
  insert: vi.fn().mockResolvedValue({ error: null }),
  invalidateQueries: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: () => ({ insert: H.insert }) },
}));
vi.mock("@/contexts/OficinaContext", () => ({
  useOficina: () => ({ oficinaAtual: { id: "of-1", tipo: "ambos" } }),
}));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: H.invalidateQueries }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { FinanceiroFormModal } from "@/components/forms/FinanceiroFormModal";

function preencherValor(v: string) {
  const input = document.getElementById("valor") as HTMLInputElement;
  fireEvent.change(input, { target: { value: v } });
  return input;
}

describe("ciclo real — FinanceiroFormModal", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    onOpenChange = vi.fn();
  });

  it("1. LIMPO: Cancelar fecha (nao prende o usuario)", async () => {
    render(<FinanceiroFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("valor")).toBeTruthy());

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("2. SUJO: Cancelar avisa e NAO fecha", async () => {
    render(<FinanceiroFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("valor")).toBeTruthy());

    preencherValor("250");
    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("3. 'Continuar editando' mantem aberto e preserva o valor", async () => {
    render(<FinanceiroFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("valor")).toBeTruthy());

    preencherValor("250");
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Continuar editando"));

    expect(onOpenChange).not.toHaveBeenCalled();
    const input = document.getElementById("valor") as HTMLInputElement;
    expect(input.value).not.toBe("");
  });

  it("4. 'Sair' fecha (copy alinhada ao autosave: rascunho fica guardado)", async () => {
    // Item 11: este modal tem autosave sempre ligado (enabled: open), então o
    // rascunho é recuperável → confirmText é "Sair", não "Descartar". A copy
    // reflete o comportamento (o dado NÃO se perde).
    render(<FinanceiroFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("valor")).toBeTruthy());

    preencherValor("250");
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    // A descrição promete rascunho guardado, e o botão diz "Sair" (não "Descartar").
    expect(screen.getByText(/rascunho fica guardado/i)).toBeInTheDocument();
    expect(screen.queryByText("Descartar")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Sair"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("5. valor '0' é preenchido, não vazio — marca sujo", async () => {
    // Dinheiro: 0 é um valor legítimo (lançamento de ajuste, estorno). O
    // comparador não pode tratar "0" como campo limpo.
    render(<FinanceiroFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("valor")).toBeTruthy());

    preencherValor("0");
    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("6. reabrir após fechar limpo NÃO nasce sujo (snapshot resetado)", async () => {
    // Cascata p.3: submit invalida financeiro-resumo → pai (MobileFinanceiro)
    // remonta. Ao reabrir, o snapshot tem de ser recapturado do estado limpo,
    // senão o form nasceria sujo e prenderia o usuário na 2ª abertura.
    const { rerender } = render(<FinanceiroFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("valor")).toBeTruthy());

    // fecha limpo
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    vi.clearAllMocks();

    rerender(<FinanceiroFormModal open={false} onOpenChange={onOpenChange} />);
    rerender(<FinanceiroFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("valor")).toBeTruthy());

    fireEvent.click(screen.getByText("Cancelar"));

    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
