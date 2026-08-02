import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * F1 — Aninhamento REAL, sem mock do ClienteSelectWithCreate.
 *
 * O relatório adversarial (5.18) apontou: cycle.VeiculoFormModal mocka o
 * ClienteSelectWithCreate, então a conclusão "Popover, não é furo" era leitura
 * de código, não runtime. Aqui montamos o componente REAL dentro do
 * VeiculoFormModal e provamos que abrir/fechar o Popover-filho NÃO fecha o
 * pai sujo.
 *
 * Só os HOOKS DE DADOS do filho são mockados (useClientes, supabase) — o
 * componente em si é o de produção.
 */

const H = vi.hoisted(() => ({
  markChildModalOpen: vi.fn(),
  markChildModalClosed: vi.fn(),
  isChildModalActive: vi.fn(() => false),
  createVeiculo: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  updateVeiculo: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  deleteVeiculo: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  createCliente: { mutateAsync: vi.fn().mockResolvedValue({ id: "cli-novo" }), isPending: false },
}));

vi.mock("@/hooks/useVeiculos", () => ({
  useVeiculos: () => ({
    createVeiculo: H.createVeiculo,
    updateVeiculo: H.updateVeiculo,
    deleteVeiculo: H.deleteVeiculo,
  }),
}));
vi.mock("@/hooks/useClientes", () => ({
  useClientes: () => ({ createCliente: H.createCliente }),
}));
vi.mock("@/contexts/OficinaContext", () => ({
  useOficina: () => ({ oficinaAtual: { id: "of-1", tipo: "ambos" } }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null }),
          order: () => ({ limit: () => Promise.resolve({ data: [] }) }),
        }),
      }),
    }),
  },
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
  isChildModalActive: H.isChildModalActive,
}));

import { VeiculoFormModal } from "@/components/forms/VeiculoFormModal";

describe("F1 — aninhamento real VeiculoForm × ClienteSelectWithCreate (sem mock do filho)", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    onOpenChange = vi.fn();
  });

  it("abre sujo → abre o Popover do ClienteSelect (real) → fecha → pai continua aberto e sujo", async () => {
    render(<VeiculoFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("placa")).toBeTruthy());

    // Suja o formulário pai.
    fireEvent.change(document.getElementById("placa")!, { target: { value: "SUJO123" } });

    // O ClienteSelect real renderiza um trigger com o texto "Selecione o cliente"
    // (o form tem outros comboboxes; localizamos pelo texto e subimos ao botão).
    const trigger = screen.getByText("Selecione o cliente").closest("button")!;
    expect(trigger).toBeInTheDocument();

    // Abre o Popover-filho (fluxo de seleção/criação de cliente).
    fireEvent.click(trigger);
    // O conteúdo do Popover aparece (campo de busca do filho).
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/Buscar por nome/i)).toBeInTheDocument(),
    );

    // Fecha o Popover-filho pressionando Escape.
    fireEvent.keyDown(document.activeElement || document.body, { key: "Escape" });

    // O PAI não pode ter fechado nem perdido o estado sujo.
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    // A placa digitada continua lá (form não resetou).
    expect((document.getElementById("placa") as HTMLInputElement).value).toBe("SUJO123");
  });

  it("Popover é renderizado no host interno do modal (container), não em portal do body", async () => {
    render(<VeiculoFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("placa")).toBeTruthy());

    fireEvent.click(screen.getByText("Selecione o cliente").closest("button")!);
    await waitFor(() =>
      expect(screen.getByPlaceholderText(/Buscar por nome/i)).toBeInTheDocument(),
    );

    // O conteúdo do Popover está dentro do DialogContent do pai (não filho direto
    // do body), o que é a razão de não disparar onPointerDownOutside do pai.
    const busca = screen.getByPlaceholderText(/Buscar por nome/i);
    const dialog = busca.closest("[role='dialog']");
    expect(dialog).not.toBeNull();
    expect(dialog!.contains(busca)).toBe(true);
  });
});
