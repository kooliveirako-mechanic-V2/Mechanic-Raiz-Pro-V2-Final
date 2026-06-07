import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Página dedicada de "Cadastro Concluído" — destino pós-signup.
 * URL única usada pelo Meta Event Setup Tool para disparar CompleteRegistration
 * via regra "URL contém /cadastro-concluido". Não dispara nenhum evento aqui:
 * o PageView do Pixel é notificado pelo ScrollToTop em toda mudança de rota.
 *
 * Fluxo:
 *  - Se o usuário tem sessão ativa (signup direto sem confirmação de e-mail),
 *    redireciona para "/" após 3s.
 *  - Se não tem sessão (confirmação de e-mail exigida), mostra instrução
 *    para verificar o e-mail.
 */
export default function CadastroConcluido() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    document.title = "Cadastro concluído | Mechanic Raiz Pro";
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    if (countdown <= 0) {
      navigate("/", { replace: true });
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [user, loading, countdown, navigate]);

  const hasSession = !loading && !!user;

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="w-12 h-12 text-success" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Cadastro concluído!
        </h1>

        {hasSession ? (
          <>
            <p className="text-muted-foreground">
              Sua conta foi criada com sucesso. Você será redirecionado em{" "}
              <span className="font-semibold text-foreground">{countdown}s</span>...
            </p>
            <Button onClick={() => navigate("/", { replace: true })} className="w-full">
              Entrar no painel agora
            </Button>
          </>
        ) : (
          <>
            <p className="text-muted-foreground">
              Enviamos um link de confirmação para o seu e-mail.
              Clique nele para ativar sua conta e começar o teste grátis de 14 dias.
            </p>
            {loading && (
              <div className="flex justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}
            <Button variant="outline" onClick={() => navigate("/auth")} className="w-full">
              Voltar para o login
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
