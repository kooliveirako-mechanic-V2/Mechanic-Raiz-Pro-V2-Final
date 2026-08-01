import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * F4 — Stacking do Radix: prova de MECANISMO para os 3 filhos do
 * OrdemServicoFormModal (KanbanFinalizarModal=AlertDialog, ResumoFiscalModal e
 * OSFinalizadaModal=Dialog). O relatório adversarial (5.20) apontou que eu
 * ASSUMI "é pós-save" sem verificar. Aqui verifico a premissa técnica que
 * sustenta os 3: quando um filho (Alert)Dialog está aberto sobre o pai Dialog,
 * fechar o filho por ESC/overlay é interceptado pela camada de TOPO e NÃO
 * propaga para fechar o pai.
 *
 * Se este teste falhar, o stacking não protege e os 3 pares são furo real —
 * exigindo guard explícito (isChildCloseEcho) no OrdemServicoFormModal.
 */

function ParentWithDialogChild() {
  const [parentOpen, setParentOpen] = useState(true);
  const [childOpen, setChildOpen] = useState(false);
  return (
    <>
      <Dialog open={parentOpen} onOpenChange={setParentOpen}>
        <DialogContent>
          <DialogTitle>Pai OS</DialogTitle>
          <button onClick={() => setChildOpen(true)}>abrir filho</button>
          <span data-testid="parent-state">{parentOpen ? "ABERTO" : "FECHADO"}</span>
        </DialogContent>
      </Dialog>
      <Dialog open={childOpen} onOpenChange={setChildOpen}>
        <DialogContent>
          <DialogTitle>Filho ResumoFiscal</DialogTitle>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ParentWithAlertChild() {
  const [parentOpen, setParentOpen] = useState(true);
  const [childOpen, setChildOpen] = useState(false);
  return (
    <>
      <Dialog open={parentOpen} onOpenChange={setParentOpen}>
        <DialogContent>
          <DialogTitle>Pai OS</DialogTitle>
          <button onClick={() => setChildOpen(true)}>abrir kanban</button>
          <span data-testid="parent-state">{parentOpen ? "ABERTO" : "FECHADO"}</span>
        </DialogContent>
      </Dialog>
      <AlertDialog open={childOpen} onOpenChange={setChildOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Kanban Finalizar</AlertDialogTitle>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

describe("F4 — stacking do Radix protege o pai (mecanismo dos 3 filhos)", () => {
  afterEach(() => cleanup());

  it("Dialog filho (ResumoFiscal/OSFinalizada): ESC fecha o filho, NÃO o pai", async () => {
    render(<ParentWithDialogChild />);
    fireEvent.click(screen.getByText("abrir filho"));
    await waitFor(() => expect(screen.getByText("Filho ResumoFiscal")).toBeInTheDocument());

    // ESC — a camada de topo (filho) consome
    fireEvent.keyDown(document.body, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByText("Filho ResumoFiscal")).not.toBeInTheDocument(),
    );
    // O pai continua aberto.
    expect(screen.getByTestId("parent-state").textContent).toBe("ABERTO");
  });

  it("AlertDialog filho (Kanban): ESC não fecha o pai Dialog", async () => {
    render(<ParentWithAlertChild />);
    fireEvent.click(screen.getByText("abrir kanban"));
    await waitFor(() => expect(screen.getByText("Kanban Finalizar")).toBeInTheDocument());

    fireEvent.keyDown(document.body, { key: "Escape" });

    // AlertDialog não fecha por ESC por padrão (é modal-forçado), mas o ponto é:
    // o pai NÃO pode ter fechado de qualquer forma.
    expect(screen.getByTestId("parent-state").textContent).toBe("ABERTO");
  });
});
