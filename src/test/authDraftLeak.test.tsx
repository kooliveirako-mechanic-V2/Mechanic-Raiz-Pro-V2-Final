import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";

/**
 * BLOCO 0 — vazamento de rascunho na TROCA DE CONTA no mesmo dispositivo.
 *
 * Cenário real: dois sócios usando o mesmo celular da oficina. Um sai e o outro
 * entra SEM passar pelo botão "Sair" — o Supabase emite onAuthStateChange com
 * outro user id, e o signOut nunca roda. Antes de a328606, a limpeza de rascunho
 * existia SÓ no signOut, então o rascunho do primeiro (valor, fornecedor,
 * observações contábeis) era oferecido ao segundo pelo DraftPromptDialog.
 *
 * Este teste exercita o caminho onAuthStateChange, não o signOut.
 */

// Sessão fake mínima, com identidade estável (regra: mock que muda de referência
// a cada render contradiz o react-query real e produz falso-vermelho).
const { authState, mkSession } = vi.hoisted(() => {
  const mkSession = (id: string) => ({
    access_token: `tok-${id}`,
    refresh_token: `ref-${id}`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: { id, email: `${id}@teste.com`, user_metadata: {} },
  });
  return {
    authState: { listener: null as null | ((ev: string, s: unknown) => void), initial: mkSession("socio-A") },
    mkSession,
  };
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (ev: string, s: unknown) => void) => {
        authState.listener = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
      getSession: () => Promise.resolve({ data: { session: authState.initial } }),
      signOut: vi.fn().mockResolvedValue({}),
      signInWithPassword: vi.fn(),
      signUp: vi.fn(),
    },
  },
}));

vi.mock("@/lib/sentry", () => ({
  setSentryUser: vi.fn(),
  clearSentryUser: vi.fn(),
}));

import { AuthProvider } from "@/contexts/AuthContext";

const DRAFT_KEYS = [
  "mechanic_draft_financeiro-prefiscal",
  "mechanic_draft_cliente-form-new",
  "form_draft_orcamento",
];

function semearRascunhos() {
  DRAFT_KEYS.forEach((k) =>
    localStorage.setItem(
      k,
      JSON.stringify({
        data: { nome: "CLIENTE SIGILOSO A", valor: "5000", fornecedor: "Peças XYZ" },
        savedAt: Date.now(),
      })
    )
  );
}

const rascunhosRestantes = () =>
  Object.keys(localStorage).filter(
    (k) => k.startsWith("mechanic_draft_") || k.startsWith("form_draft_")
  );

describe("Bloco 0 — troca de conta no mesmo dispositivo", () => {
  beforeEach(() => {
    localStorage.clear();
    authState.listener = null;
    authState.initial = mkSession("socio-A");
    vi.clearAllMocks();
  });

  it("A -> B (sem signOut): rascunhos do socio A sao apagados", async () => {
    render(
      <AuthProvider>
        <div>app</div>
      </AuthProvider>
    );

    // startup semeia o baseline (lastUserIdRef = socio-A) via getSession
    await waitFor(() => expect(authState.listener).not.toBeNull());

    // sócio A trabalhou e deixou rascunho
    semearRascunhos();
    expect(rascunhosRestantes()).toHaveLength(3);

    // sócio B entra no mesmo dispositivo, SEM passar pelo signOut
    await waitFor(() =>
      authState.listener!("SIGNED_IN", mkSession("socio-B"))
    );

    await waitFor(() => {
      expect(rascunhosRestantes()).toEqual([]);
    });
  });

  it("mesmo usuario reautenticando (A -> A) NAO apaga o rascunho dele", async () => {
    render(
      <AuthProvider>
        <div>app</div>
      </AuthProvider>
    );
    await waitFor(() => expect(authState.listener).not.toBeNull());

    semearRascunhos();

    // refresh de token do MESMO usuário — não é troca de conta
    await waitFor(() =>
      authState.listener!("TOKEN_REFRESHED", mkSession("socio-A"))
    );

    // o rascunho é do próprio usuário; apagar aqui seria perda de dado
    expect(rascunhosRestantes()).toHaveLength(3);
  });

  it("login inicial (null -> A) NAO apaga rascunho salvo antes", async () => {
    authState.initial = null as never; // ninguém logado no startup
    render(
      <AuthProvider>
        <div>app</div>
      </AuthProvider>
    );
    await waitFor(() => expect(authState.listener).not.toBeNull());

    semearRascunhos();
    await waitFor(() => authState.listener!("SIGNED_IN", mkSession("socio-A")));

    // sem id anterior não há troca: o rascunho pode ser do próprio A
    expect(rascunhosRestantes()).toHaveLength(3);
  });
});
