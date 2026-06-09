import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff, Loader2, Wrench, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Status = "checking" | "ready" | "invalid" | "saving" | "done";

export default function ResetPassword() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>("checking");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    const init = async () => {
      try {
        const hash = window.location.hash.startsWith("#")
          ? window.location.hash.substring(1)
          : window.location.hash;
        const hashParams = new URLSearchParams(hash);
        const queryParams = new URLSearchParams(window.location.search);

        const errorCode =
          hashParams.get("error_code") || queryParams.get("error_code");
        const errorDescription =
          hashParams.get("error_description") ||
          queryParams.get("error_description");

        if (errorCode) {
          console.error("[ResetPassword] Auth error:", errorCode, errorDescription);
          setErrorMsg(
            errorCode === "otp_expired"
              ? "Este link expirou. Solicite um novo link de recuperação."
              : "Link inválido ou já utilizado. Solicite um novo link."
          );
          setStatus("invalid");
          return;
        }

        const accessToken =
          hashParams.get("access_token") || queryParams.get("access_token");
        const refreshToken =
          hashParams.get("refresh_token") ||
          queryParams.get("refresh_token") ||
          "";
        const type = hashParams.get("type") || queryParams.get("type");
        const code = queryParams.get("code");

        // PRIORIDADE 1: Sessão já estabelecida (caso mais comum no fluxo /verify do Supabase).
        // O link de recovery do Supabase passa por /auth/v1/verify e já cria a sessão
        // via cookie antes de redirecionar para cá. Verificar isso PRIMEIRO evita
        // tentar trocar code/token que já foi consumido (causa do "Load failed").
        const { data: { session: existingSession } } = await supabase.auth.getSession();
        if (existingSession) {
          window.history.replaceState({}, document.title, "/reset-password");
          setStatus("ready");
          return;
        }

        // PRIORIDADE 2: Hash/Query token flow (recovery clássico).
        if (accessToken && (type === "recovery" || !type)) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          window.history.replaceState({}, document.title, "/reset-password");
          setStatus("ready");
          return;
        }

        // PRIORIDADE 3: PKCE code flow (apenas se ainda não há sessão).
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            // Se o code já foi consumido, espera o onAuthStateChange (PASSWORD_RECOVERY)
            // disparar antes de declarar inválido.
            const { data: { session: retry } } = await supabase.auth.getSession();
            if (retry) {
              window.history.replaceState({}, document.title, "/reset-password");
              setStatus("ready");
              return;
            }
            throw error;
          }
          window.history.replaceState({}, document.title, "/reset-password");
          setStatus("ready");
          return;
        }

        // PRIORIDADE 4: Fallback — escutar PASSWORD_RECOVERY do listener global.
        // O Supabase às vezes processa o link via background e dispara o evento depois.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
          if (event === "PASSWORD_RECOVERY" || (sess && event === "SIGNED_IN")) {
            window.history.replaceState({}, document.title, "/reset-password");
            setStatus("ready");
            subscription.unsubscribe();
          }
        });

        // Dá 2.5s para o evento chegar antes de declarar inválido.
        setTimeout(async () => {
          const { data: { session: late } } = await supabase.auth.getSession();
          if (late) {
            window.history.replaceState({}, document.title, "/reset-password");
            setStatus("ready");
          } else {
            setErrorMsg("Link de recuperação inválido ou expirado. Solicite um novo link.");
            setStatus("invalid");
          }
          subscription.unsubscribe();
        }, 2500);
      } catch (err: any) {
        console.error("[ResetPassword] init error:", err);
        // Antes de declarar inválido, checar uma última vez se a sessão existe.
        const { data: { session: fallback } } = await supabase.auth.getSession();
        if (fallback) {
          window.history.replaceState({}, document.title, "/reset-password");
          setStatus("ready");
          return;
        }
        setErrorMsg(err?.message || "Não foi possível validar o link de recuperação.");
        setStatus("invalid");
      }
    };

    init();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    setStatus("saving");
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success("Senha alterada com sucesso!", {
        description: "Faça login com sua nova senha.",
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        sessionStorage.setItem("mrp_reset_email", user.email);
      }

      // Always sign out so the user is forced to log in with the new password
      await supabase.auth.signOut();
      setStatus("done");

      setTimeout(() => navigate("/auth?reset=success", { replace: true }), 1200);
    } catch (err: any) {
      console.error("[ResetPassword] update error:", err);
      toast.error("Erro ao alterar senha", {
        description: err?.message || "Tente novamente.",
      });
      setStatus("ready");
    }
  };

  return (
    <div className="min-h-screen bg-[#0E1B2A] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="bg-gradient-to-br from-[#0077B6] via-[#005F8A] to-[#003D5C] p-6 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-white/10 backdrop-blur border border-white/20 mb-3">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white">
            Mechanic <span className="text-[#00A8E8]">Raiz Pro</span>
          </h1>
          <p className="text-white/80 text-sm mt-1">Definir nova senha</p>
        </div>

        <div className="p-6">
          {status === "checking" && (
            <div className="flex flex-col items-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#0077B6]" />
              <p className="text-sm text-slate-600">Validando link de recuperação...</p>
            </div>
          )}

          {status === "invalid" && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Lock className="w-6 h-6 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">Link inválido</h2>
              <p className="text-sm text-slate-600 mb-5">{errorMsg}</p>
              <Button
                onClick={() => navigate("/auth", { replace: true })}
                className="w-full h-11 bg-gradient-to-r from-[#0077B6] to-[#005F8A] text-white font-semibold"
              >
                Voltar para login
              </Button>
            </div>
          )}

          {status === "done" && (
            <div className="text-center py-6">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-slate-900 mb-2">Senha alterada!</h2>
              <p className="text-sm text-slate-600">Redirecionando para o login...</p>
            </div>
          )}

          {(status === "ready" || status === "saving") && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-slate-600 text-center mb-2">
                Crie uma nova senha para acessar sua conta.
              </p>

              <div className="space-y-2">
                <Label htmlFor="new-password" className="text-sm font-semibold text-slate-800">
                  Nova senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 text-base bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-[#0077B6] focus:ring-[#0077B6]"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    disabled={status === "saving"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm-password" className="text-sm font-semibold text-slate-800">
                  Confirmar nova senha
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="confirm-password"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Repita a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 pr-10 h-12 text-base bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-[#0077B6] focus:ring-[#0077B6]"
                    required
                    minLength={8}
                    autoComplete="new-password"
                    disabled={status === "saving"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 p-1"
                    tabIndex={-1}
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={status === "saving"}
                className="w-full h-12 bg-gradient-to-r from-[#0077B6] via-[#005F8A] to-[#003D5C] hover:from-[#005F8A] hover:to-[#003D5C] text-white font-bold shadow-lg"
              >
                {status === "saving" ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Salvar nova senha
                  </>
                )}
              </Button>

              <p className="text-xs text-slate-500 text-center pt-2">
                Após salvar, você precisará fazer login novamente com a nova senha.
              </p>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
