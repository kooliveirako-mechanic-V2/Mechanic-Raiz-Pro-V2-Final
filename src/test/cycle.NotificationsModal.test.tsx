import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";

/**
 * Ciclo do COMPONENTE REAL — NotificationsModal.
 *
 * 4 toggles booleanos, hidratados de configuracoes por useEffect → sem autosave,
 * snapshotReady:hydrated requisito. Foco: ligar e desligar o mesmo toggle volta
 * ao original e NÃO deve marcar sujo (usuário não deve ser preso à toa).
 *
 * Mock estável via vi.hoisted (regra da fase).
 */

const H = vi.hoisted(() => ({
  configuracoes: {
    whatsapp_notificacoes: true,
    estoque_alertas: true,
    recorrencia_lembretes: true,
    resumo_diario: false,
  },
  update: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
}));

vi.mock("@/hooks/useOficinaConfiguracoes", () => ({
  useOficinaConfiguracoes: () => ({ configuracoes: H.configuracoes, updateConfiguracoes: H.update }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

import { NotificationsModal } from "@/components/configuracoes/NotificationsModal";

function toggleDe(titulo: string): HTMLElement {
  const linha = screen.getByText(titulo).closest("div")!.parentElement!.parentElement!;
  return within(linha).getByRole("switch");
}

describe("ciclo real — NotificationsModal", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onOpenChange = vi.fn();
  });

  it("1. LIMPO após hidratação: Cancelar fecha sem falso-sujo", async () => {
    render(<NotificationsModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByText("Resumo Diário")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("2. SUJO: alterar um toggle → Cancelar avisa e NAO fecha", async () => {
    render(<NotificationsModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByText("Resumo Diário")).toBeInTheDocument());

    fireEvent.click(toggleDe("Resumo Diário")); // false → true
    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("3. toggle ligar/desligar volta ao original → NÃO marca sujo", async () => {
    render(<NotificationsModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByText("Resumo Diário")).toBeInTheDocument());

    const sw = toggleDe("Resumo Diário");
    fireEvent.click(sw); // false → true
    fireEvent.click(sw); // true → false (volta ao original)

    fireEvent.click(screen.getByText("Cancelar"));

    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("4. 'Continuar editando' preserva o toggle alterado", async () => {
    render(<NotificationsModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByText("Resumo Diário")).toBeInTheDocument());
    const sw = toggleDe("Resumo Diário");
    fireEvent.click(sw);
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Continuar editando"));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(toggleDe("Resumo Diário")).toBeChecked();
  });

  it("5. 'Descartar' fecha", async () => {
    render(<NotificationsModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByText("Resumo Diário")).toBeInTheDocument());
    fireEvent.click(toggleDe("Resumo Diário"));
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Descartar"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
