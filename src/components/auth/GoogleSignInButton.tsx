import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

const LOVABLE_OAUTH_BROKER_URL = "https://mechanicraizpro.lovable.app/~oauth/initiate";

function isLovableHostedOrigin() {
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".lovable.app");
}

function createOAuthState() {
  if (window.crypto?.getRandomValues) {
    return Array.from(window.crypto.getRandomValues(new Uint8Array(16)))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  }

  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`;
}

export function GoogleSignInButton() {
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const redirectUri = `${window.location.origin}/auth`;

      if (!isLovableHostedOrigin()) {
        const params = new URLSearchParams({
          provider: "google",
          redirect_uri: redirectUri,
          state: createOAuthState(),
        });

        window.location.assign(`${LOVABLE_OAUTH_BROKER_URL}?${params.toString()}`);
        return;
      }

      // OAuth gerenciado do Lovable Cloud — usa o broker oauth.lovable.app
      // cadastrado nas Redirect URIs do Google Cloud Console.
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: redirectUri,
      });

      if (result.error) {
        console.error("[GoogleSignIn] Erro OAuth Lovable:", result.error);
        toast.error("Erro ao entrar com Google", {
          description: result.error.message || "Tente novamente.",
        });
        return;
      }
      // Se result.redirected, o navegador já foi redirecionado para o Google.
      // Caso contrário, a sessão já foi setada pelo módulo lovable.
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[GoogleSignIn] Erro inesperado:", err);
      toast.error("Erro ao entrar com Google", {
        description: message || "Verifique sua conexão e tente novamente.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400 font-medium">ou</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="w-full h-12 bg-white hover:bg-slate-50 border-slate-300 text-slate-700 font-semibold shadow-sm hover:shadow transition-all"
      >
        {loading ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
        )}
        Entrar com Google
      </Button>
    </div>
  );
}
