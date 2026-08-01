import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Ciclo do COMPONENTE REAL — CatalogoServicoFormModal.
 * Hidrata da prop `servico` (síncrona), snapshot via flag `hydrated`.
 * Mock com identidade estável (regra da fase).
 */

const { createServico, updateServico, SERVICO } = vi.hoisted(() => ({
  createServico: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  updateServico: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  SERVICO: {
    id: "srv-1",
    nome: "TROCA DE OLEO",
    tipo_veiculo: "todos",
    categoria: "revisao",
    valor_mao_obra: 80,
    tempo_estimado_minutos: 30,
    descricao: "",
  },
}));

vi.mock("@/hooks/useCatalogoServicos", () => ({
  useCatalogoServicos: () => ({ createServico, updateServico }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CatalogoServicoFormModal } from "@/components/estoque/CatalogoServicoFormModal";

describe("ciclo real — CatalogoServicoFormModal", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    onOpenChange = vi.fn();
    vi.clearAllMocks();
  });

  it("1. LIMPO: Cancelar fecha (nao prende o usuario)", async () => {
    render(<CatalogoServicoFormModal open onOpenChange={onOpenChange} servico={SERVICO as never} />);
    await waitFor(() => expect(screen.getByDisplayValue("TROCA DE OLEO")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("2. SUJO: Cancelar avisa e NAO fecha", async () => {
    render(<CatalogoServicoFormModal open onOpenChange={onOpenChange} servico={SERVICO as never} />);
    const nome = await waitFor(() => screen.getByDisplayValue("TROCA DE OLEO"));
    fireEvent.change(nome, { target: { value: "TROCA DE OLEO E FILTRO" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("3. 'Continuar editando' mantem aberto e preserva o texto", async () => {
    render(<CatalogoServicoFormModal open onOpenChange={onOpenChange} servico={SERVICO as never} />);
    const nome = await waitFor(() => screen.getByDisplayValue("TROCA DE OLEO"));
    fireEvent.change(nome, { target: { value: "TROCA DE OLEO E FILTRO" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));
    fireEvent.click(screen.getByText("Continuar editando"));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("TROCA DE OLEO E FILTRO")).toBeInTheDocument();
  });

  it("4. 'Descartar' fecha", async () => {
    render(<CatalogoServicoFormModal open onOpenChange={onOpenChange} servico={SERVICO as never} />);
    const nome = await waitFor(() => screen.getByDisplayValue("TROCA DE OLEO"));
    fireEvent.change(nome, { target: { value: "TROCA DE OLEO E FILTRO" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));
    fireEvent.click(screen.getByText("Descartar"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
