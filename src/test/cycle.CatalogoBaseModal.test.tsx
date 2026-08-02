import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Ciclo do COMPONENTE REAL — CatalogoBaseModal.
 *
 * O estado "sujo" aqui é um Set<number> de itens selecionados. Prova do suporte
 * a Set no comparador (38ab25a): selecionar item marca sujo; selecionar e
 * desmarcar volta a limpo (Set com mesmos elementos, independente de ordem).
 *
 * searchTerm é volátil (buscar não é editar) → ignoreKeys. Sem hidratação por
 * fetch → snapshotReady default. Mock estável via vi.hoisted.
 */

const H = vi.hoisted(() => ({
  createItem: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
}));

vi.mock("@/hooks/useEstoque", () => ({
  useEstoque: () => ({ createItem: H.createItem, itens: [] }),
}));
vi.mock("@/hooks/useOficinaLabels", () => ({
  useOficinaLabels: () => ({ isAutoEletrica: false }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { CatalogoBaseModal } from "@/components/estoque/CatalogoBaseModal";

describe("ciclo real — CatalogoBaseModal", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onOpenChange = vi.fn();
  });

  it("1. LIMPO (nada selecionado): Cancelar fecha", async () => {
    render(<CatalogoBaseModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByText("Filtro de Ar Motor")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("2. SUJO (Set com item): Cancelar avisa e não fecha", async () => {
    render(<CatalogoBaseModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByText("Filtro de Ar Motor")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Filtro de Ar Motor"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("3. Set: selecionar e desmarcar volta a LIMPO (não marca sujo)", async () => {
    // Prova de conteúdo do Set: after add+remove o Set volta a vazio → igual ao
    // snapshot. Não pode pedir confirmação.
    render(<CatalogoBaseModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByText("Filtro de Ar Motor")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Filtro de Ar Motor")); // add
    fireEvent.click(screen.getByText("Filtro de Ar Motor")); // remove

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("4. buscar (searchTerm) NÃO marca sujo — volátil", async () => {
    render(<CatalogoBaseModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByText("Filtro de Ar Motor")).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("Buscar no catálogo..."), { target: { value: "óleo" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("5. 'Descartar' fecha", async () => {
    render(<CatalogoBaseModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByText("Filtro de Ar Motor")).toBeInTheDocument());

    fireEvent.click(screen.getByText("Filtro de Ar Motor"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Descartar"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
