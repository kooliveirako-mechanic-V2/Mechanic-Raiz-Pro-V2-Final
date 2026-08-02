import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Ciclo do COMPONENTE REAL — EstoqueFormModal (21 estados, 16 de dados).
 *
 * Sem useAutoSave: a guarda de sujo é a ÚNICA rede, inclusive em edição, que
 * hidrata via useEffect → snapshotReady:hydrated é requisito, não refinamento.
 *
 * Foco financeiro: custo_unitario / preco_venda têm de marcar sujo; "0" é valor
 * preenchido (custo zerado legítimo), não campo vazio.
 *
 * Mock estável via vi.hoisted (regra da fase).
 */

const H = vi.hoisted(() => ({
  createItem: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  updateItem: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  deleteItem: { mutateAsync: vi.fn().mockResolvedValue({}), isPending: false },
  ITEM: {
    id: "est-1",
    nome: "OLEO 5W30",
    categoria: "Óleo",
    tipo_veiculo: "ambos",
    quantidade: 10,
    custo_unitario: 25,
    preco_venda: 40,
    alerta_minimo: 5,
    localizacao: "Prateleira A3",
    codigo: "SKU-1",
    ncm: "",
    tipo_item: "peca",
    fornecedor_nome: "",
    fornecedor_telefone: "",
    fornecedor_email: "",
  },
}));

vi.mock("@/hooks/useEstoque", () => ({
  useEstoque: () => ({ createItem: H.createItem, updateItem: H.updateItem, deleteItem: H.deleteItem }),
}));
vi.mock("@/contexts/OficinaContext", () => ({
  useOficina: () => ({ oficinaAtual: { id: "of-1", tipo: "ambos" } }),
}));
vi.mock("@/hooks/useOficinaLabels", () => ({
  useOficinaLabels: () => ({ isAutoEletrica: false, labels: {} }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/estoque/HistoricoMovimentacoes", () => ({
  HistoricoMovimentacoes: () => null,
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { EstoqueFormModal } from "@/components/forms/EstoqueFormModal";

function renderEditing(onOpenChange: ReturnType<typeof vi.fn>) {
  return render(<EstoqueFormModal open onOpenChange={onOpenChange} item={H.ITEM as never} />);
}

async function hidratado() {
  return waitFor(() => expect(screen.getByDisplayValue("OLEO 5W30")).toBeInTheDocument());
}

describe("ciclo real em edição — EstoqueFormModal", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onOpenChange = vi.fn();
  });

  it("1. LIMPO após hidratação: Cancelar fecha sem falso-sujo", async () => {
    renderEditing(onOpenChange);
    await hidratado();

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("2. SUJO (nome): Cancelar avisa e não fecha", async () => {
    renderEditing(onOpenChange);
    await hidratado();
    fireEvent.change(screen.getByDisplayValue("OLEO 5W30"), { target: { value: "OLEO 10W40" } });

    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("3. SUJO (custo): alterar custo_unitario marca sujo — regressão de dinheiro", async () => {
    renderEditing(onOpenChange);
    await hidratado();
    const custo = document.getElementById("custo") as HTMLInputElement;
    fireEvent.change(custo, { target: { value: "30" } });

    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("4. SUJO (venda): alterar preco_venda marca sujo — regressão de dinheiro", async () => {
    renderEditing(onOpenChange);
    await hidratado();
    const venda = document.getElementById("venda") as HTMLInputElement;
    fireEvent.change(venda, { target: { value: "55" } });

    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("5. custo '0' é preenchido, não vazio — marca sujo", async () => {
    renderEditing(onOpenChange);
    await hidratado();
    const custo = document.getElementById("custo") as HTMLInputElement;
    fireEvent.change(custo, { target: { value: "0" } });

    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("6. 'Continuar editando' preserva alteração", async () => {
    renderEditing(onOpenChange);
    await hidratado();
    const venda = document.getElementById("venda") as HTMLInputElement;
    fireEvent.change(venda, { target: { value: "55" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Continuar editando"));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect((document.getElementById("venda") as HTMLInputElement).value).toBe("55");
  });

  it("7. 'Descartar' fecha", async () => {
    renderEditing(onOpenChange);
    await hidratado();
    fireEvent.change(screen.getByDisplayValue("OLEO 5W30"), { target: { value: "OLEO 10W40" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Descartar"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
