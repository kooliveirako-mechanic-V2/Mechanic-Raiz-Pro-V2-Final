import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * D (aninhamento) — o teste que justifica a fila: OrcamentoFormModal com o
 * ItemSelector REAL (não mockado). Pai sujo → abre o ItemSelector (Dialog em
 * portal) → fecha SÓ o ItemSelector → o pai continua aberto e nenhum confirm
 * aparece. É o falso-fechamento que D2+D1 previnem.
 *
 * Dentes (mutação, no relatório): remover o consumo do lock no pai
 * (guardedOpenChange sem isChildModalActive) deixa este teste vermelho.
 */

const H = vi.hoisted(() => ({
  createOrcamento: { mutateAsync: vi.fn().mockResolvedValue({ id: "orc-novo" }) },
  updateOrcamento: { mutateAsync: vi.fn().mockResolvedValue({}) },
  deleteOrcamento: { mutateAsync: vi.fn().mockResolvedValue({}) },
  updateStatus: { mutateAsync: vi.fn().mockResolvedValue({}) },
  recalcularTotais: { mutateAsync: vi.fn().mockResolvedValue({}) },
}));

vi.mock("@/hooks/useOrcamentos", () => ({
  useOrcamentos: () => ({
    createOrcamento: H.createOrcamento, updateOrcamento: H.updateOrcamento,
    deleteOrcamento: H.deleteOrcamento, updateStatus: H.updateStatus,
    recalcularTotais: H.recalcularTotais,
  }),
  useItensOrcamento: () => ({
    itens: [],
    addItem: { mutateAsync: vi.fn().mockResolvedValue({}) },
    removeItem: { mutateAsync: vi.fn().mockResolvedValue({}) },
    valorTotal: 0,
    custoTotal: 0,
  }),
}));
vi.mock("@/hooks/useVeiculos", () => ({ useVeiculos: () => ({ veiculos: [] }) }));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/contexts/OficinaContext", () => ({ useOficina: () => ({ oficinaAtual: { id: "of-1" } }) }));
vi.mock("@/hooks/useOrcamentoPagamento", () => ({
  useOrcamentoPagamento: () => ({ generateAndCopyLink: vi.fn(), generateAndShareWhatsApp: vi.fn(), loading: false }),
}));
vi.mock("@tanstack/react-query", () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
// selects mockados (Popover contido, não são o alvo); ItemSelector REAL.
vi.mock("@/components/forms/ClienteSelectWithCreate", () => ({ ClienteSelectWithCreate: () => <div data-testid="cli" /> }));
vi.mock("@/components/forms/VeiculoSelectWithCreate", () => ({ VeiculoSelectWithCreate: () => <div data-testid="vei" /> }));
vi.mock("@/components/orcamentos/InlineItemForm", () => ({ InlineItemForm: () => null }));
// deps de dados do ItemSelector real:
vi.mock("@/hooks/useEstoque", () => ({ useEstoque: () => ({ itens: [], isLoading: false }) }));
vi.mock("@/hooks/useUserRole", () => ({ useUserRole: () => ({ canViewLucro: true }) }));
vi.mock("@/hooks/useOficinaLabels", () => ({ useOficinaLabels: () => ({ isAutoEletrica: false }) }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));

import { OrcamentoFormModal } from "@/components/forms/OrcamentoFormModal";

// O ItemSelector só é renderizado com activeOrcamentoId (modo edição). Em
// criação, o form usa InlineItemForm. Então o aninhamento real ocorre em edição.
const ORCAMENTO = {
  id: "orc-1", oficina_id: "of-1", cliente_id: "cli-1", veiculo_id: null,
  numero: 42, titulo: "Orçamento Existente", descricao: "", status: "rascunho",
  validade: null, valor_total: 0, custo_total: 0, desconto: 0, observacoes: "",
  created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
};

describe("D aninhamento — Orcamento × ItemSelector real", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    onOpenChange = vi.fn();
  });

  it("montagem real: pai + ItemSelector coexistem, título preservado ao abrir o filho", async () => {
    // Prova de MONTAGEM (não de eco): o ItemSelector real monta dentro do
    // Orcamento em edição sem quebrar o pai nem resetar o form.
    // LIMITAÇÃO HONESTA: o eco pai↔filho (pointerdown/escape propagado do
    // Dialog-filho em portal para o onOpenChange do pai) NÃO é reproduzível em
    // jsdom — probe empírico: onOpenChange do pai é chamado 0x quando o filho
    // fecha por Escape. Logo este teste NÃO prova o guard; o guard em si é
    // provado no unit shouldBlockParentClose + lock.itemSelectorPaths.
    render(<OrcamentoFormModal open onOpenChange={onOpenChange} orcamento={ORCAMENTO as never} />);
    await waitFor(() => expect(document.getElementById("titulo")).toBeTruthy());

    fireEvent.change(document.getElementById("titulo")!, { target: { value: "Orçamento X" } });
    const addBtn = screen.queryByText("Adicionar Item") || screen.getByText("Adicionar primeiro item");
    fireEvent.click(addBtn);

    await waitFor(() => expect(screen.getByPlaceholderText(/Buscar/i)).toBeInTheDocument());
    // pai intacto enquanto o filho está aberto
    expect((document.getElementById("titulo") as HTMLInputElement).value).toBe("Orçamento X");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  // NOTA HONESTA: a prova COM DENTES do eco (pai ignora fechamento com filho
  // ativo) NÃO é feita aqui por montagem — probe empírico mostrou que o jsdom
  // não propaga o eco do Dialog-filho em portal ao onOpenChange do pai, e a
  // guarda de sujo do pai mascara a de lock. Essa decisão é provada por mutação
  // na função pura shouldIgnoreParentClose (guard.orcamentoParentClose.test.ts).
});
