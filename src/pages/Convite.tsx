import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { rpcSentinela } from "@/lib/sentinela";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, CheckCircle2, XCircle, Mail, Crown, Shield, Wrench } from "lucide-react";
import { toast } from "sonner";

interface InviteInfo {
  email: string;
  role: "administrador" | "funcionario";
  oficina_nome: string;
  expires_at: string;
}

export default function Convite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Convite inválido");
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("get_invite_info", { _token: token });
      if (error) {
        setError(error.message);
      } else {
        const res = data as unknown as { success: boolean; error?: string } & InviteInfo;
        if (!res.success) setError(res.error || "Convite inválido");
        else setInfo(res);
      }
      setLoading(false);
    })();
  }, [token]);

  const handleAccept = async () => {
    if (!token) return;
    if (!user) {
      // Save token & redirect to auth
      sessionStorage.setItem("pending_invite_token", token);
      navigate(`/auth?invite=${token}&email=${encodeURIComponent(info?.email || "")}`);
      return;
    }

    setAccepting(true);
    const { data, error } = await rpcSentinela("accept_team_invite", { _token: token });
    setAccepting(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    const res = data as unknown as { success: boolean; error?: string; oficina_id?: string };
    if (!res.success) {
      toast.error(res.error || "Não foi possível aceitar o convite");
      return;
    }

    setAccepted(true);
    sessionStorage.removeItem("pending_invite_token");
    toast.success("Convite aceito! Bem-vindo à equipe.");
    setTimeout(() => {
      window.location.href = "/";
    }, 1500);
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <XCircle className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold">Convite inválido</h1>
          <p className="text-muted-foreground">{error}</p>
          <Button asChild>
            <Link to="/">Ir para o início</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full p-8 text-center space-y-4">
          <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto" />
          <h1 className="text-2xl font-bold">Convite aceito!</h1>
          <p className="text-muted-foreground">Redirecionando...</p>
        </Card>
      </div>
    );
  }

  const RoleIcon = info?.role === "administrador" ? Shield : Wrench;
  const roleLabel = info?.role === "administrador" ? "Administrador" : "Funcionário";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full p-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Crown className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Você foi convidado!</h1>
          <p className="text-muted-foreground">
            Para fazer parte da equipe da oficina
          </p>
          <p className="text-xl font-semibold text-foreground">{info?.oficina_nome}</p>
        </div>

        <div className="space-y-3 bg-muted/50 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">E-mail do convite</p>
              <p className="font-medium">{info?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <RoleIcon className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Cargo</p>
              <p className="font-medium">{roleLabel}</p>
            </div>
          </div>
        </div>

        {user && user.email?.toLowerCase() !== info?.email.toLowerCase() && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
            Você está logado como <strong>{user.email}</strong>. Faça logout e entre com{" "}
            <strong>{info?.email}</strong> para aceitar este convite.
          </div>
        )}

        <Button
          onClick={handleAccept}
          disabled={accepting || (!!user && user.email?.toLowerCase() !== info?.email.toLowerCase())}
          className="w-full"
          size="lg"
        >
          {accepting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : user ? (
            "Aceitar convite"
          ) : (
            "Entrar / Criar conta para aceitar"
          )}
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Este convite expira em{" "}
          {info && new Date(info.expires_at).toLocaleDateString("pt-BR")}
        </p>
      </Card>
    </div>
  );
}
