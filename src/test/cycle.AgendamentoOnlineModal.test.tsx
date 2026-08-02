import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/**
 * Ciclo do COMPONENTE REAL — AgendamentoOnlineModal.
 *
 * Foco: objeto aninhado `horarios` (7 dias × objeto). O comparador tem de
 * recursar — alterar um horário DENTRO de um dia marca sujo. Instância nova
 * com mesmo conteúdo NÃO pode marcar (senão todo abrir/fechar pede confirmação).
 *
 * Sem autosave, hidrata por useEffect → snapshotReady:hydrated é requisito.
 * Mock estável via vi.hoisted (regra da fase).
 */

const H = vi.hoisted(() => {
  const CONFIG = {
    agendamento_online_ativo: true,
    agendamento_online_slug: "minha-oficina",
    agendamento_online_horarios: {
      seg: { aberto: true, abre: "08:00", fecha: "18:00", pausa_inicio: "12:00", pausa_fim: "13:00" },
      ter: { aberto: true, abre: "08:00", fecha: "18:00" },
      qua: { aberto: true, abre: "08:00", fecha: "18:00" },
      qui: { aberto: true, abre: "08:00", fecha: "18:00" },
      sex: { aberto: true, abre: "08:00", fecha: "18:00" },
      sab: { aberto: true, abre: "08:00", fecha: "12:00" },
      dom: { aberto: false },
    },
    agendamento_online_capacidade_simultanea: 1,
    agendamento_online_duracao_slot_minutos: 30,
    agendamento_online_dias_antecedencia_max: 30,
    agendamento_online_mostrar_precos: true,
    agendamento_online_servicos_permitidos: [],
    agendamento_online_mensagem_confirmacao: "Recebido!",
    agendamento_online_mensagem_aprovacao: "Aprovado!",
  };
  return {
    CONFIG,
    update: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  };
});

vi.mock("@/hooks/useAgendamentoOnline", () => ({
  useAgendamentoOnlineConfig: () => ({ config: H.CONFIG, isLoading: false, update: H.update }),
}));
vi.mock("@/hooks/useCatalogoServicos", () => ({
  useCatalogoServicos: () => ({ servicos: [] }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AgendamentoOnlineModal } from "@/components/configuracoes/AgendamentoOnlineModal";

async function hidratado() {
  return waitFor(() => expect(screen.getByDisplayValue("minha-oficina")).toBeInTheDocument());
}

describe("ciclo real — AgendamentoOnlineModal", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear(); // G1: modal agora usa useAutoSave — isola rascunhos entre casos
    onOpenChange = vi.fn();
  });

  it("1. LIMPO após hidratação: Cancelar fecha sem falso-sujo", async () => {
    render(<AgendamentoOnlineModal open onOpenChange={onOpenChange} />);
    await hidratado();

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("2. SUJO (slug): Cancelar avisa e não fecha", async () => {
    render(<AgendamentoOnlineModal open onOpenChange={onOpenChange} />);
    await hidratado();
    fireEvent.change(screen.getByDisplayValue("minha-oficina"), { target: { value: "outra-oficina" } });

    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("3. SUJO (horario aninhado): alterar hora de abertura da segunda marca sujo", async () => {
    // Prova de recursão: o campo mudado está DENTRO de horarios.seg.abre.
    // Comparação rasa não pegaria isso.
    render(<AgendamentoOnlineModal open onOpenChange={onOpenChange} />);
    await hidratado();

    const abreSeg = screen.getAllByDisplayValue("08:00")[0] as HTMLInputElement;
    fireEvent.change(abreSeg, { target: { value: "09:00" } });

    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("4. 'Continuar editando' preserva a alteração de horário", async () => {
    render(<AgendamentoOnlineModal open onOpenChange={onOpenChange} />);
    await hidratado();
    const abreSeg = screen.getAllByDisplayValue("08:00")[0] as HTMLInputElement;
    fireEvent.change(abreSeg, { target: { value: "09:00" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Continuar editando"));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getAllByDisplayValue("09:00").length).toBeGreaterThan(0);
  });

  it("5. 'Sair' fecha (autosave → rascunho guardado, copy não é 'Descartar')", async () => {
    // G1: com autosave, o dado é recuperável → confirmText é "Sair".
    render(<AgendamentoOnlineModal open onOpenChange={onOpenChange} />);
    await hidratado();
    fireEvent.change(screen.getByDisplayValue("minha-oficina"), { target: { value: "outra-oficina" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    expect(screen.getByText(/rascunho fica guardado/i)).toBeInTheDocument();
    expect(screen.queryByText("Descartar")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("Sair"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("6. toggle desligar/religar dia volta ao original → NÃO marca sujo", async () => {
    // Objeto aninhado idêntico após ida-e-volta não pode marcar sujo.
    render(<AgendamentoOnlineModal open onOpenChange={onOpenChange} />);
    await hidratado();

    // desliga domingo (já era false → liga e desliga a segunda via switch)
    const switches = screen.getAllByRole("switch");
    // switches: [0]=ativar agendamento, [1]=mostrar precos? na verdade a ordem
    // depende do layout; usamos o switch do dia "Segunda" localizando pelo texto.
    const linhaSegunda = screen.getByText("Segunda").closest("div")!.parentElement!;
    const switchSegunda = within(linhaSegunda).getByRole("switch");
    fireEvent.click(switchSegunda); // desliga
    fireEvent.click(switchSegunda); // religa → volta ao estado original

    fireEvent.click(screen.getByText("Cancelar"));

    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
