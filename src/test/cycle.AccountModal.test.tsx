import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Ciclo do COMPONENTE REAL — AccountModal.
 *
 * 1 campo editável (nome), inicializado síncrono no useState a partir do user
 * do contexto — sem useEffect de hidratação, então snapshotReady default basta.
 * Baixo risco, mas o par vermelho/verde não se pula.
 */

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { updateUser: vi.fn().mockResolvedValue({ error: null }) } },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { email: "joao@oficina.com", user_metadata: { nome: "João" } } }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { AccountModal } from "@/components/configuracoes/AccountModal";

describe("ciclo real — AccountModal", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onOpenChange = vi.fn();
  });

  it("1. LIMPO: Cancelar fecha (nao prende o usuario)", async () => {
    render(<AccountModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByDisplayValue("João")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("2. SUJO: alterar nome → Cancelar avisa e NAO fecha", async () => {
    render(<AccountModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByDisplayValue("João")).toBeInTheDocument());

    fireEvent.change(screen.getByDisplayValue("João"), { target: { value: "João Silva" } });
    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("3. 'Continuar editando' preserva o nome digitado", async () => {
    render(<AccountModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByDisplayValue("João")).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("João"), { target: { value: "João Silva" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Continuar editando"));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("João Silva")).toBeInTheDocument();
  });

  it("4. voltar o nome ao original → NÃO marca sujo", async () => {
    render(<AccountModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByDisplayValue("João")).toBeInTheDocument());

    const input = screen.getByDisplayValue("João");
    fireEvent.change(input, { target: { value: "João Silva" } });
    fireEvent.change(input, { target: { value: "João" } });

    fireEvent.click(screen.getByText("Cancelar"));

    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("5. 'Descartar' fecha", async () => {
    render(<AccountModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByDisplayValue("João")).toBeInTheDocument());
    fireEvent.change(screen.getByDisplayValue("João"), { target: { value: "João Silva" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Descartar"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
