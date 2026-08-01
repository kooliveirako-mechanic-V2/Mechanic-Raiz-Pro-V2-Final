import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const H = vi.hoisted(() => ({
  markChildModalOpen: vi.fn(),
  markChildModalClosed: vi.fn(),
  createVeiculo: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  updateVeiculo: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  deleteVeiculo: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  VEICULO: {
    id: "vei-1",
    cliente_id: "cli-1",
    oficina_id: "of-1",
    tipo: "carro",
    marca: "FIAT",
    modelo: "UNO",
    ano: 2015,
    placa: "ABC1234",
    km_atual: 80000,
    chassi: null,
    cor: "PRATA",
    observacoes: "Veículo de teste",
    foto_url: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  },
}));

vi.mock("@/hooks/useVeiculos", () => ({
  useVeiculos: () => ({
    createVeiculo: H.createVeiculo,
    updateVeiculo: H.updateVeiculo,
    deleteVeiculo: H.deleteVeiculo,
  }),
}));
vi.mock("@/contexts/OficinaContext", () => ({
  useOficina: () => ({ oficinaAtual: { id: "of-1", tipo: "ambos" } }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/forms/ClienteSelectWithCreate", () => ({
  ClienteSelectWithCreate: () => <div data-testid="cliente-select" />,
}));
vi.mock("@/components/forms/VehicleBrandModelSelect", () => ({
  VehicleBrandModelSelect: () => <div data-testid="brand-model-select" />,
}));
vi.mock("@/components/veiculos/HistoricoEletricoTimeline", () => ({
  HistoricoEletricoTimeline: () => null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/childModalLock", () => ({
  markChildModalOpen: H.markChildModalOpen,
  markChildModalClosed: H.markChildModalClosed,
  isChildModalActive: () => false,
}));

import { VeiculoFormModal } from "@/components/forms/VeiculoFormModal";

function renderEditing(onOpenChange: ReturnType<typeof vi.fn>) {
  return render(
    <VeiculoFormModal
      open
      onOpenChange={onOpenChange}
      veiculo={H.VEICULO as never}
    />,
  );
}

async function placaHidratada() {
  return waitFor(() => expect(screen.getByDisplayValue("ABC1234")).toBeInTheDocument());
}

function editarPlaca() {
  const placa = screen.getByDisplayValue("ABC1234");
  fireEvent.change(placa, { target: { value: "XYZ9999" } });
}

describe("ciclo real em edição — VeiculoFormModal", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    onOpenChange = vi.fn();
  });

  it("1. LIMPO após hidratação: Cancelar fecha sem falso-sujo", async () => {
    renderEditing(onOpenChange);
    await placaHidratada();

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("2. SUJO em edição: Cancelar avisa e não fecha", async () => {
    renderEditing(onOpenChange);
    await placaHidratada();
    editarPlaca();

    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("3. Continuar editando preserva a alteração", async () => {
    renderEditing(onOpenChange);
    await placaHidratada();
    editarPlaca();
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Continuar editando"));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("XYZ9999")).toBeInTheDocument();
  });

  it("4. Descartar fecha o modal", async () => {
    renderEditing(onOpenChange);
    await placaHidratada();
    editarPlaca();
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Descartar"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("5. childModalLock: registra ao abrir como filho e libera ao fechar", async () => {
    // registerAsChild só é ligado pelo ClienteFormModal (aninhamento). Sem ele,
    // as montagens de topo NÃO tocam a trava global.
    const { rerender } = render(
      <VeiculoFormModal open={false} onOpenChange={onOpenChange} veiculo={H.VEICULO as never} registerAsChild />,
    );
    expect(H.markChildModalOpen).not.toHaveBeenCalled();

    rerender(
      <VeiculoFormModal open onOpenChange={onOpenChange} veiculo={H.VEICULO as never} registerAsChild />,
    );
    await placaHidratada();
    expect(H.markChildModalOpen).toHaveBeenCalledTimes(1);
    expect(H.markChildModalClosed).not.toHaveBeenCalled();

    rerender(
      <VeiculoFormModal open={false} onOpenChange={onOpenChange} veiculo={H.VEICULO as never} registerAsChild />,
    );
    await waitFor(() => expect(H.markChildModalClosed).toHaveBeenCalledTimes(1));
  });

  it("6. childModalLock: montagem de topo (sem registerAsChild) não toca a trava", async () => {
    renderEditing(onOpenChange); // sem registerAsChild
    await placaHidratada();
    expect(H.markChildModalOpen).not.toHaveBeenCalled();
    expect(H.markChildModalClosed).not.toHaveBeenCalled();
  });
});
