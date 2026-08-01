import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup, act } from "@testing-library/react";

/**
 * F7 — Prova de que o VeiculoFormModal em EDIÇÃO não escreve rascunho no
 * localStorage. O relatório adversarial (6.24) apontou: provei a copy
 * ("Descartar" em edição), não provei a ausência de escrita.
 *
 * O autosave tem enabled: open && !isEditing. Em edição, digitar e esperar o
 * intervalo NÃO pode criar a chave mechanic_draft_veiculo-form-*-new.
 *
 * Par V/V: com enabled: open (o "erro"), a chave aparece → teste falha. Com o
 * código real (enabled: open && !isEditing), a chave nunca aparece → passa.
 */

const H = vi.hoisted(() => ({
  createVeiculo: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  updateVeiculo: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  deleteVeiculo: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  VEICULO: {
    id: "vei-1", cliente_id: "cli-1", oficina_id: "of-1", tipo: "carro",
    marca: "FIAT", modelo: "UNO", ano: 2015, placa: "ABC1234", km_atual: 80000,
    chassi: null, cor: "PRATA", observacoes: "", foto_url: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  },
}));

vi.mock("@/hooks/useVeiculos", () => ({
  useVeiculos: () => ({ createVeiculo: H.createVeiculo, updateVeiculo: H.updateVeiculo, deleteVeiculo: H.deleteVeiculo }),
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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock("@/lib/childModalLock", () => ({
  markChildModalOpen: vi.fn(), markChildModalClosed: vi.fn(), isChildModalActive: () => false,
}));

import { VeiculoFormModal } from "@/components/forms/VeiculoFormModal";

// A chave termina em -new; o meio é o id da oficina.
const DRAFT_KEY = "mechanic_draft_veiculo-form-of-1-new";

describe("F7 — edição não escreve rascunho no localStorage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    localStorage.clear();
  });

  it("editar campo em modo EDIÇÃO e passar o intervalo → NÃO cria a chave -new", async () => {
    render(<VeiculoFormModal open onOpenChange={vi.fn()} veiculo={H.VEICULO as never} />);

    // hidrata (placa preenchida)
    await act(async () => { await Promise.resolve(); });
    const placa = document.getElementById("placa") as HTMLInputElement;
    expect(placa.value).toBe("ABC1234");

    // edita
    fireEvent.change(placa, { target: { value: "EDIT999" } });

    // passa muito além de qualquer intervalo de autosave
    act(() => { vi.advanceTimersByTime(5000); });

    // Em edição o autosave está desligado → chave não existe.
    expect(localStorage.getItem(DRAFT_KEY)).toBeNull();
  });
});
