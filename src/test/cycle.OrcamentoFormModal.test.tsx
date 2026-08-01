import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Item D — ciclo do OrcamentoFormModal (antes SEM useModalClose).
 *
 * Prova o guard de saída: sujo → pede confirmação e não fecha; limpo → fecha
 * direto. Modo criação (autosave ligado) → copy "Sair". Mock estável via
 * vi.hoisted; ItemSelector e subcomponentes de item mockados como sondas leves.
 */

const H = vi.hoisted(() => ({
  createOrcamento: { mutateAsync: vi.fn().mockResolvedValue({ id: "orc-novo" }) },
  updateOrcamento: { mutateAsync: vi.fn().mockResolvedValue({}) },
  deleteOrcamento: { mutateAsync: vi.fn().mockResolvedValue({}) },
  updateStatus: { mutateAsync: vi.fn().mockResolvedValue({}) },
  recalcularTotais: { mutateAsync: vi.fn().mockResolvedValue({}) },
}));

vi.mock("@/hooks/useOrcamentos", () => ({
  useOrcamentos: () => ({
    createOrcamento: H.createOrcamento,
    updateOrcamento: H.updateOrcamento,
    deleteOrcamento: H.deleteOrcamento,
    updateStatus: H.updateStatus,
    recalcularTotais: H.recalcularTotais,
  }),
  useItensOrcamento: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/hooks/useVeiculos", () => ({ useVeiculos: () => ({ veiculos: [] }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/contexts/OficinaContext", () => ({ useOficina: () => ({ oficinaAtual: { id: "of-1" } }) }));
vi.mock("@/hooks/useOrcamentoPagamento", () => ({
  useOrcamentoPagamento: () => ({ generateAndCopyLink: vi.fn(), generateAndShareWhatsApp: vi.fn(), loading: false }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/components/orcamentos/ItemSelector", () => ({ ItemSelector: () => null }));
vi.mock("@/components/orcamentos/InlineItemForm", () => ({ InlineItemForm: () => null }));
vi.mock("@/components/forms/ClienteSelectWithCreate", () => ({ ClienteSelectWithCreate: () => <div data-testid="cli" /> }));
vi.mock("@/components/forms/VeiculoSelectWithCreate", () => ({ VeiculoSelectWithCreate: () => <div data-testid="vei" /> }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { OrcamentoFormModal } from "@/components/forms/OrcamentoFormModal";

describe("Item D — ciclo OrcamentoFormModal", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    onOpenChange = vi.fn();
  });

  it("1. LIMPO: Cancelar fecha (não prende o usuário)", async () => {
    render(<OrcamentoFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("titulo")).toBeTruthy());

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("2. SUJO: preencher título → Cancelar avisa e NÃO fecha", async () => {
    render(<OrcamentoFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("titulo")).toBeTruthy());

    fireEvent.change(document.getElementById("titulo")!, { target: { value: "Orçamento X" } });
    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("3. criação sujo: copy é 'Sair' (autosave → rascunho guardado)", async () => {
    render(<OrcamentoFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("titulo")).toBeTruthy());
    fireEvent.change(document.getElementById("titulo")!, { target: { value: "Orçamento X" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    expect(screen.getByText("Sair")).toBeInTheDocument();
    expect(screen.getByText(/rascunho fica guardado/i)).toBeInTheDocument();
  });

  it("4. 'Continuar editando' preserva o título", async () => {
    render(<OrcamentoFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("titulo")).toBeTruthy());
    fireEvent.change(document.getElementById("titulo")!, { target: { value: "Orçamento X" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Continuar editando"));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect((document.getElementById("titulo") as HTMLInputElement).value).toBe("Orçamento X");
  });

  it("5. 'Sair' descarta e fecha", async () => {
    render(<OrcamentoFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("titulo")).toBeTruthy());
    fireEvent.change(document.getElementById("titulo")!, { target: { value: "Orçamento X" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Sair"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
