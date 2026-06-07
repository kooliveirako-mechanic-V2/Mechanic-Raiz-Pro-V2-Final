import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, ArrowLeft, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PasswordRecoveryModalProps {
  visible: boolean;
  onClose: () => void;
  initialEmail?: string;
}

export function PasswordRecoveryModal({ visible, onClose, initialEmail = "" }: PasswordRecoveryModalProps) {
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);

  // Sync initialEmail when modal opens
  if (visible && initialEmail && email !== initialEmail && !loading) {
    setEmail(initialEmail);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      toast.error("Digite seu e-mail");
      return;
    }

    setLoading(true);

    try {
      // Use apex domain to match Supabase Site URL exactly — avoids 307 redirects that strip the hash fragment with tokens
      const redirectUrl = `https://mechanicraizpro.com.br/reset-password`;

      const { error } = await supabase.functions.invoke("send-password-reset", {
        body: { email, redirectUrl },
      });

      if (error) throw error;

      toast.success("Email enviado!", {
        description: "Se o email existir, você receberá um link de recuperação.",
      });
      onClose();
      setEmail("");
    } catch (error: any) {
      console.error("Error sending recovery email:", error);
      toast.error("Erro ao enviar email", {
        description: "Tente novamente mais tarde.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={onClose}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-slate-600" />
              </button>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Recuperar Senha</h2>
                <p className="text-sm text-slate-500">Digite seu e-mail para receber o link</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="recovery-email" className="text-sm font-semibold text-slate-800">
                  E-mail cadastrado
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input
                    id="recovery-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12 text-base bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-[#0077B6] focus:ring-[#0077B6]"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-gradient-to-r from-[#0077B6] via-[#005F8A] to-[#003D5C] hover:from-[#005F8A] hover:to-[#003D5C] text-white font-bold shadow-lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4 mr-2" />
                    Enviar link de recuperação
                  </>
                )}
              </Button>
            </form>

            <p className="text-xs text-slate-400 text-center mt-4">
              O link será enviado para o e-mail cadastrado e expira em 24 horas.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
