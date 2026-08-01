import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Ciclo do COMPONENTE REAL — OficinaFormModal.
 * Hidrata de useOficina() (contexto), então o snapshot depende da flag `hydrated`
 * setada no useEffect. Mock com identidade estável (regra da fase): objeto que
 * muda de referência a cada render re-dispara o useEffect e produz falso-vermelho.
 */

const { OFICINA, refetch } = vi.hoisted(() => ({
  OFICINA: {
    id: "of-1",
    nome: "OFICINA TESTE",
    telefone: "11999998888",
    endereco: "Rua A, 100",
    tipo: "ambos",
  },
  refetch: vi.fn(),
}));

vi.mock("@/contexts/OficinaContext", () => ({
  useOficina: () => ({ oficinaAtual: OFICINA, refetch }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ update: () => ({ eq: () => Promise.resolve({ error: null }) }) }),
  },
}));

import { OficinaFormModal } from "@/components/forms/OficinaFormModal";

describe("ciclo real — OficinaFormModal", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    onOpenChange = vi.fn();
    vi.clearAllMocks();
  });

  it("1. LIMPO: Cancelar fecha (nao prende o usuario)", async () => {
    render(<OficinaFormModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByDisplayValue("OFICINA TESTE")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Cancelar"));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("2. SUJO: Cancelar avisa e NAO fecha", async () => {
    render(<OficinaFormModal open onOpenChange={onOpenChange} />);
    const nome = await waitFor(() => screen.getByDisplayValue("OFICINA TESTE"));
    fireEvent.change(nome, { target: { value: "OFICINA EDITADA" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("3. 'Continuar editando' mantem aberto e preserva o texto", async () => {
    render(<OficinaFormModal open onOpenChange={onOpenChange} />);
    const nome = await waitFor(() => screen.getByDisplayValue("OFICINA TESTE"));
    fireEvent.change(nome, { target: { value: "OFICINA EDITADA" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));
    fireEvent.click(screen.getByText("Continuar editando"));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("OFICINA EDITADA")).toBeInTheDocument();
  });

  it("4. 'Descartar' fecha", async () => {
    render(<OficinaFormModal open onOpenChange={onOpenChange} />);
    const nome = await waitFor(() => screen.getByDisplayValue("OFICINA TESTE"));
    fireEvent.change(nome, { target: { value: "OFICINA EDITADA" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));
    fireEvent.click(screen.getByText("Descartar"));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
