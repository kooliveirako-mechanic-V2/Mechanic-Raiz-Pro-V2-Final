import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

/**
 * Teste de ciclo do COMPONENTE REAL — DadosFiscaisModal.
 *
 * Por que não basta o modalCycle.test.tsx: aquele usa uma réplica mínima. Se o
 * `handleOpenChange` deste arquivo estiver ligado ao estado errado, ou o
 * `enabled` computar falso, a réplica passa verde e o arquivo real está
 * desprotegido. Só render do componente real pega isso.
 *
 * A asserção crítica é a #1: Cancelar com form LIMPO tem que FECHAR. Modal que
 * prende o usuário é regressão pior que o vazamento que o guard corrige.
 */

// IDENTIDADE ESTÁVEL é obrigatória aqui. O useEffect de hidratação do modal tem
// deps [configuracoes, open]; se o mock devolver um objeto novo a cada render, o
// efeito re-dispara e sobrescreve o que o "usuário" digitou — o teste mediria o
// mock, não o modal. (Foi exatamente o que aconteceu na 1a versão deste arquivo:
// 3 de 4 casos falharam por artefato do mock.) react-query devolve referência
// estável entre renders, então isto reproduz o app, não o contrário.
const { CONFIG, mutateAsync } = vi.hoisted(() => ({
  CONFIG: {
    razao_social: "OFICINA TESTE LTDA",
    cnpj: "12.345.678/0001-90",
    inscricao_municipal: "",
    municipio: "São Paulo",
    regime_tributario: "mei",
    cfop_servicos: "5933",
    cfop_vendas: "5102",
  },
  mutateAsync: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/hooks/useOficinaConfiguracoes", () => ({
  useOficinaConfiguracoes: () => ({
    configuracoes: CONFIG,
    updateConfiguracoes: { mutateAsync },
    isLoading: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { DadosFiscaisModal } from "@/components/configuracoes/DadosFiscaisModal";

describe("ciclo real — DadosFiscaisModal", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onOpenChange = vi.fn();
    vi.clearAllMocks();
  });

  it("1. LIMPO: Cancelar fecha de fato (nao prende o usuario)", async () => {
    render(<DadosFiscaisModal open onOpenChange={onOpenChange} />);
    // hidratação roda em useEffect; espera o campo vir preenchido do servidor
    await waitFor(() =>
      expect(screen.getByDisplayValue("OFICINA TESTE LTDA")).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("2. SUJO: Cancelar pede confirmacao e NAO fecha", async () => {
    render(<DadosFiscaisModal open onOpenChange={onOpenChange} />);
    const razao = await waitFor(() => screen.getByDisplayValue("OFICINA TESTE LTDA"));

    fireEvent.change(razao, { target: { value: "OFICINA EDITADA LTDA" } });
    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() =>
      expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument()
    );
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("3. 'Continuar editando' mantem aberto e preserva o que foi digitado", async () => {
    render(<DadosFiscaisModal open onOpenChange={onOpenChange} />);
    const razao = await waitFor(() => screen.getByDisplayValue("OFICINA TESTE LTDA"));

    fireEvent.change(razao, { target: { value: "OFICINA EDITADA LTDA" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Continuar editando"));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByDisplayValue("OFICINA EDITADA LTDA")).toBeInTheDocument();
  });

  it("4. 'Descartar' fecha", async () => {
    render(<DadosFiscaisModal open onOpenChange={onOpenChange} />);
    const razao = await waitFor(() => screen.getByDisplayValue("OFICINA TESTE LTDA"));

    fireEvent.change(razao, { target: { value: "OFICINA EDITADA LTDA" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Descartar"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
