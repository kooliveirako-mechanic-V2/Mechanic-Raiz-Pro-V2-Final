import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

/**
 * Ciclo do COMPONENTE REAL — SecurityModal.
 *
 * Credenciais: o snapshot NÃO guarda o valor da senha — compara flags "campo
 * preenchido?" (booleano), não o texto. Asserção explícita de que nenhum valor
 * digitado aparece no ConfirmDialog de saída.
 *
 * Sem autosave, campos nascem vazios → snapshotReady default.
 */

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { updateUser: vi.fn().mockResolvedValue({ error: null }) } },
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { SecurityModal } from "@/components/configuracoes/SecurityModal";

const SENHA_SECRETA = "SenhaUltraSecreta123";

describe("ciclo real — SecurityModal", () => {
  let onOpenChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    onOpenChange = vi.fn();
  });

  it("1. LIMPO: Cancelar fecha (nao prende o usuario)", async () => {
    render(<SecurityModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("newPassword")).toBeTruthy());

    fireEvent.click(screen.getByText("Cancelar"));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("Sair sem salvar?")).not.toBeInTheDocument();
  });

  it("2. SUJO: digitar senha → Cancelar avisa e NAO fecha", async () => {
    render(<SecurityModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("newPassword")).toBeTruthy());

    fireEvent.change(document.getElementById("newPassword")!, { target: { value: SENHA_SECRETA } });
    fireEvent.click(screen.getByText("Cancelar"));

    await waitFor(() => expect(screen.getByText("Sair sem salvar?")).toBeInTheDocument());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("3. SEGURANÇA: o valor da senha NÃO aparece no ConfirmDialog", async () => {
    render(<SecurityModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("newPassword")).toBeTruthy());

    fireEvent.change(document.getElementById("newPassword")!, { target: { value: SENHA_SECRETA } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    // O texto do dialog de confirmação não pode conter a senha digitada.
    const dialog = screen.getByText("Sair sem salvar?").closest("[role='alertdialog'], [role='dialog']") || document.body;
    expect(dialog.textContent).not.toContain(SENHA_SECRETA);
    // E o input de senha nunca renderiza o valor como texto plano fora do campo.
    expect(document.body.textContent).not.toContain(SENHA_SECRETA);
  });

  it("4. 'Continuar editando' preserva a senha digitada", async () => {
    render(<SecurityModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("newPassword")).toBeTruthy());
    fireEvent.change(document.getElementById("newPassword")!, { target: { value: SENHA_SECRETA } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Continuar editando"));

    expect(onOpenChange).not.toHaveBeenCalled();
    expect((document.getElementById("newPassword") as HTMLInputElement).value).toBe(SENHA_SECRETA);
  });

  it("5. 'Descartar' fecha", async () => {
    render(<SecurityModal open onOpenChange={onOpenChange} />);
    await waitFor(() => expect(document.getElementById("newPassword")).toBeTruthy());
    fireEvent.change(document.getElementById("newPassword")!, { target: { value: SENHA_SECRETA } });
    fireEvent.click(screen.getByText("Cancelar"));
    await waitFor(() => screen.getByText("Sair sem salvar?"));

    fireEvent.click(screen.getByText("Descartar"));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
