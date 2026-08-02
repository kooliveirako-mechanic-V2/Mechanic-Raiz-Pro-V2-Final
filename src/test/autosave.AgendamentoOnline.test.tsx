import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * G1 — prova de persistência do autosave no AgendamentoOnlineModal.
 *
 * Fechar no meio → reabrir → campos voltam (via DraftPromptDialog → Retomar).
 * Cobre o horarios aninhado (objeto+arrays), que é onde o comparador/serialização
 * de rascunho poderia falhar. useAutoSave REAL (localStorage); só os hooks de
 * dados mockados.
 */

const H = vi.hoisted(() => {
  const CONFIG = {
    oficina_id: "of-1",
    agendamento_online_ativo: true,
    agendamento_online_slug: "minha-oficina",
    agendamento_online_horarios: {
      seg: { aberto: true, abre: "08:00", fecha: "18:00" },
      ter: { aberto: true, abre: "08:00", fecha: "18:00" },
      qua: { aberto: true, abre: "08:00", fecha: "18:00" },
      qui: { aberto: true, abre: "08:00", fecha: "18:00" },
      sex: { aberto: true, abre: "08:00", fecha: "18:00" },
      sab: { aberto: false },
      dom: { aberto: false },
    },
    agendamento_online_capacidade_simultanea: 1,
    agendamento_online_duracao_slot_minutos: 30,
    agendamento_online_dias_antecedencia_max: 30,
    agendamento_online_mostrar_precos: true,
    agendamento_online_servicos_permitidos: [],
    agendamento_online_mensagem_confirmacao: "ok",
    agendamento_online_mensagem_aprovacao: "aprovado",
  };
  return { CONFIG, update: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false } };
});

vi.mock("@/hooks/useAgendamentoOnline", () => ({
  useAgendamentoOnlineConfig: () => ({ config: H.CONFIG, isLoading: false, update: H.update }),
}));
vi.mock("@/hooks/useCatalogoServicos", () => ({ useCatalogoServicos: () => ({ servicos: [] }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { AgendamentoOnlineModal } from "@/components/configuracoes/AgendamentoOnlineModal";

describe("G1 — persistência do autosave (AgendamentoOnline)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("altera slug + horário aninhado → fecha → reabre → DraftPrompt oferece retomar", async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(<AgendamentoOnlineModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByDisplayValue("minha-oficina")).toBeInTheDocument());

    // altera slug (campo plano) e um horário DENTRO de horarios.seg (aninhado)
    fireEvent.change(screen.getByDisplayValue("minha-oficina"), { target: { value: "nova-oficina" } });
    const abreSeg = screen.getAllByDisplayValue("08:00")[0] as HTMLInputElement;
    fireEvent.change(abreSeg, { target: { value: "07:30" } });

    // aguarda o autosave persistir (debounce 1500ms real)
    await waitFor(
      () => {
        const chaves = Object.keys(localStorage).filter((k) => k.includes("agendamento-online"));
        expect(chaves.length).toBeGreaterThan(0);
      },
      { timeout: 3000 },
    );

    // fecha o modal
    rerender(<AgendamentoOnlineModal open={false} onOpenChange={onOpenChange} />);
    // reabre → há rascunho → DraftPromptDialog aparece
    rerender(<AgendamentoOnlineModal open onOpenChange={onOpenChange} />);

    await waitFor(() => {
      const oferece = screen.queryByText(/retomar/i) || screen.queryByText(/rascunho/i);
      expect(oferece).toBeTruthy();
    });
  });

  it("o rascunho salvo contém o horario aninhado alterado (serialização recursiva)", async () => {
    const onOpenChange = vi.fn();
    render(<AgendamentoOnlineModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByDisplayValue("minha-oficina")).toBeInTheDocument());

    const abreSeg = screen.getAllByDisplayValue("08:00")[0] as HTMLInputElement;
    fireEvent.change(abreSeg, { target: { value: "07:30" } });

    await waitFor(
      () => {
        const chave = Object.keys(localStorage).find((k) => k.includes("agendamento-online"));
        expect(chave).toBeTruthy();
        const draft = JSON.parse(localStorage.getItem(chave!)!);
        expect(draft.data.horarios.seg.abre).toBe("07:30");
      },
      { timeout: 3000 },
    );
  });
});
