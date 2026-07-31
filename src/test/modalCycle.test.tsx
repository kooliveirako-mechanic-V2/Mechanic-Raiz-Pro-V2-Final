import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useModalClose } from "@/hooks/useModalClose";

/**
 * TESTE DE CICLO (jsdom) — prova COMPORTAMENTO, não estrutura.
 *
 * Playwright não existe neste ambiente (provado por comando: playwright,
 * @playwright/test e python playwright todos ausentes), então o gate é jsdom com
 * @testing-library/react — aprovado como equivalente.
 *
 * O caso central é o furo encontrado pela métrica `exits_unguarded`: um botão
 * "Cancelar" com onClick={() => onOpenChange(false)} fecha o modal SEM passar
 * pelo guard. A métrica antiga (`passthrough`) media só o Dialog/Drawer e dava
 * verde nesses arquivos. Ver commits 38ab25a / 4326986.
 */

// Réplica mínima do padrão real dos formulários: Dialog + campo + botão Cancelar.
// `cancelBypass` alterna entre o código COM o furo e o código corrigido, para o
// mesmo teste poder provar falha-antes / passa-depois sem git stash.
function FormularioDeTeste({
  onOpenChange,
  cancelBypass,
}: {
  onOpenChange: (o: boolean) => void;
  cancelBypass: boolean;
}) {
  const [nome, setNome] = useState("");
  const { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose } = useModalClose({
    open: true,
    data: { nome },
    onOpenChange,
  });

  return (
    <>
      <Dialog open onOpenChange={handleOpenChange}>
        <DialogContent>
          <Input
            aria-label="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
          />
          <Button
            // cancelBypass=true reproduz o FURO (fecha direto);
            // false é o código corrigido (passa pelo guard).
            onClick={() => (cancelBypass ? onOpenChange(false) : handleOpenChange(false))}
          >
            Cancelar
          </Button>
        </DialogContent>
      </Dialog>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Sair sem salvar?"
        description="Dados não salvos serão descartados."
        confirmText="Descartar"
        cancelText="Continuar editando"
        onConfirm={confirmClose}
      />
    </>
  );
}

describe("ciclo do modal — botão Cancelar com campo preenchido", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onOpenChange = vi.fn();
  });

  it("FURO (código sem a correção): Cancelar fecha SEM confirmar", async () => {
    render(<FormularioDeTeste onOpenChange={onOpenChange} cancelBypass />);
    fireEvent.change(screen.getByLabelText("nome"), { target: { value: "Silva" } });
    fireEvent.click(screen.getByText("Cancelar"));

    // Documenta o defeito: fecha direto, sem diálogo de confirmação.
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("CORRIGIDO: Cancelar com campo preenchido → confirmação aparece e NÃO fecha", async () => {
    render(<FormularioDeTeste onOpenChange={onOpenChange} cancelBypass={false} />);
    fireEvent.change(screen.getByLabelText("nome"), { target: { value: "Silva" } });
    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => {
      expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument();
    });
    expect(onOpenChange).not.toHaveBeenCalled();
    // o que foi digitado continua lá
    expect(screen.getByLabelText("nome")).toHaveValue("Silva");
  });

  it("CORRIGIDO: 'Continuar editando' mantém o modal aberto com o texto", async () => {
    render(<FormularioDeTeste onOpenChange={onOpenChange} cancelBypass={false} />);
    fireEvent.change(screen.getByLabelText("nome"), { target: { value: "Silva" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Continuar editando"));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("nome")).toHaveValue("Silva");
  });

  it("CORRIGIDO: 'Descartar' fecha de fato", async () => {
    render(<FormularioDeTeste onOpenChange={onOpenChange} cancelBypass={false} />);
    fireEvent.change(screen.getByLabelText("nome"), { target: { value: "Silva" } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Descartar"));

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("CORRIGIDO: abrir e fechar SEM digitar → fecha direto, sem confirmação", () => {
    render(<FormularioDeTeste onOpenChange={onOpenChange} cancelBypass={false} />);
    fireEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });
});
