/**
 * SENTINELA RAIZ — Camada 4 (Painel)
 *
 * Rota /sentinela protegida por super_admin (server-side via RPC).
 * Layout: desktop 3 colunas, mobile 1 coluna empilhada.
 * Cada bloco tem seu próprio ErrorBoundary local.
 */
import { useEffect, useState, useCallback, Component, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  sentinelaRpc,
  type Nivel,
  type ScorePayload,
  type ModulosPayload,
  type DetectoresPayload,
  type LogsPayload,
} from "@/lib/sentinelaRpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, AlertTriangle, Activity, Zap, RefreshCw, Eye, Bug } from "lucide-react";
import { motion } from "framer-motion";

/* ─────────── Local ErrorBoundary (por bloco) ─────────── */
class LocalBoundary extends Component<{ children: ReactNode; label: string }, { err: Error | null }> {
  state = { err: null as Error | null };
  static getDerivedStateFromError(err: Error) { return { err }; }
  componentDidCatch(err: Error) { console.error("[Sentinela]", this.props.label, err); }
  render() {
    if (this.state.err) {
      return (
        <Card className="border-destructive/40">
          <CardContent className="p-4 text-sm text-destructive flex gap-2 items-start">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-medium">Falha em "{this.props.label}"</div>
              <div className="opacity-80 text-xs mt-1">{this.state.err.message}</div>
            </div>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

const nivelColor = (n: Nivel) => n === "green" ? "text-emerald-500" : n === "yellow" ? "text-yellow-500" : "text-destructive";
const nivelBg = (n: Nivel) => n === "green" ? "bg-emerald-500/10" : n === "yellow" ? "bg-yellow-500/10" : "bg-destructive/10";
const nivelDot = (n: Nivel) => n === "green" ? "bg-emerald-500" : n === "yellow" ? "bg-yellow-500" : "bg-destructive";

/* ─────────── ScoreRadial ─────────── */
function ScoreRadial({ score, nivel }: { score: number; nivel: Nivel }) {
  const circ = 2 * Math.PI * 70;
  const offset = circ - (score / 100) * circ;
  const stroke = nivel === "green" ? "rgb(16 185 129)" : nivel === "yellow" ? "rgb(234 179 8)" : "hsl(var(--destructive))";
  return (
    <div className="relative w-44 h-44 mx-auto">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r="70" stroke="currentColor" strokeWidth="10" fill="none" className="text-muted/30" />
        <motion.circle
          cx="80" cy="80" r="70" stroke={stroke} strokeWidth="10" fill="none" strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-bold ${nivelColor(nivel)}`}>{score}</span>
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Score</span>
      </div>
    </div>
  );
}

/* ─────────── Modal de evidência ─────────── */
function EvidenciaModal({ open, onClose, sql, label }: { open: boolean; onClose: () => void; sql: string; label: string }) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Evidência: {label}</DialogTitle></DialogHeader>
        <pre className="bg-muted p-4 rounded text-xs overflow-auto max-h-[60vh] whitespace-pre-wrap">{sql}</pre>
      </DialogContent>
    </Dialog>
  );
}

/* ─────────── Página ─────────── */
export default function Sentinela() {
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [score, setScore] = useState<ScorePayload | null>(null);
  const [modulos, setModulos] = useState<ModulosPayload | null>(null);
  const [detectores, setDetectores] = useState<DetectoresPayload | null>(null);
  const [logs, setLogs] = useState<LogsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [evid, setEvid] = useState<{ sql: string; label: string } | null>(null);
  const [generatingError, setGeneratingError] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [s, m, d, l] = await Promise.all([
        sentinelaRpc.score(),
        sentinelaRpc.modulos(),
        sentinelaRpc.detectores(),
        sentinelaRpc.logs(50),
      ]);
      setScore(s.data);
      setModulos(m.data);
      setDetectores(d.data);
      setLogs(l.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess?.session?.user?.id;
      if (!uid) { setAuthorized(false); return; }
      const { data, error } = await sentinelaRpc.isSuperAdmin(uid);
      if (error || !data) { setAuthorized(false); return; }
      setAuthorized(true);
      void fetchAll();
    })();
  }, [fetchAll]);

  // Auto-refresh logs a cada 10s
  useEffect(() => {
    if (!authorized) return;
    const t = setInterval(() => {
      sentinelaRpc.logs(50).then(({ data }) => setLogs(data));
    }, 10_000);
    return () => clearInterval(t);
  }, [authorized]);

  async function gerarErroTeste() {
    setGeneratingError(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.rpc as any)("rpc_que_nao_existe_sentinela_teste", {});
    } catch { /* esperado */ }
    setTimeout(fetchAll, 1500);
    setGeneratingError(false);
  }

  if (authorized === null) return <div className="p-8"><Skeleton className="h-8 w-48" /></div>;
  if (!authorized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center">
        <Shield className="w-12 h-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground max-w-md">Esta área é exclusiva para administradores do sistema.</p>
        <Button onClick={() => navigate("/")}>Voltar</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-6 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-7 h-7 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Sentinela Raiz</h1>
            <p className="text-xs text-muted-foreground">Observabilidade proativa</p>
          </div>
        </div>
        <div className="flex gap-2">
          {import.meta.env.DEV && (
            <Button variant="outline" size="sm" onClick={gerarErroTeste} disabled={generatingError}>
              <Bug className="w-4 h-4 mr-2" />Gerar erro
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />Atualizar
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Score */}
        <LocalBoundary label="Score">
          <Card className="md:col-span-1">
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" />Score de Confiabilidade</CardTitle></CardHeader>
            <CardContent>
              {loading || !score ? <Skeleton className="h-44 w-full" /> : <>
                <ScoreRadial score={score.score} nivel={score.nivel} />
                <p className="text-xs text-center text-muted-foreground mt-3">
                  {score.from_cache ? "Cache de 5 min · " : ""}Atualizado {new Date(score.calculated_at).toLocaleString("pt-BR")}
                </p>
              </>}
            </CardContent>
          </Card>
        </LocalBoundary>

        {/* Componentes do Score */}
        <LocalBoundary label="Componentes">
          <Card className="md:col-span-2">
            <CardHeader><CardTitle className="text-sm">Componentes do Score</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {loading || !score ? <Skeleton className="h-32 w-full" /> :
                score.componentes.map((c) => (
                  <div key={c.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span>{c.label} <span className="text-muted-foreground">(peso {c.peso})</span></span>
                      <button className="text-primary hover:underline flex items-center gap-1"
                        onClick={() => setEvid({ sql: c.evidencia_sql, label: c.label })}>
                        <Eye className="w-3 h-3" />ver evidência
                      </button>
                    </div>
                    <div className="h-2 rounded bg-muted overflow-hidden">
                      <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${c.valor}%` }} transition={{ duration: 0.6 }} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">{c.valor.toFixed(1)}% → {c.pontos} pts</div>
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </LocalBoundary>

        {/* Módulos */}
        <LocalBoundary label="Módulos">
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4" />Status dos Módulos</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {loading || !modulos ? <Skeleton className="h-32 w-full" /> :
                modulos.modulos.map((m) => (
                  <div key={m.id} className={`flex justify-between items-center p-2 rounded ${nivelBg(m.status)}`}>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${nivelDot(m.status)}`} />
                      <span className="text-sm">{m.label}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{m.erros_24h} erros/24h</span>
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </LocalBoundary>

        {/* Detectores */}
        <LocalBoundary label="Detectores">
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm flex items-center justify-between">
                <span className="flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Detectores de Bug Silencioso</span>
                {detectores && <span className="text-xs font-normal text-muted-foreground">Total: {detectores.total_inconsistencias}</span>}
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {loading || !detectores ? <Skeleton className="h-32 w-full" /> :
                detectores.detectores.map((d) => (
                  <div key={d.id} className={`p-3 rounded border ${d.count > 0 ? nivelBg(d.severidade) + " border-current/20" : "border-muted"}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-xs font-medium">{d.label}</div>
                        <div className={`text-2xl font-bold ${d.count > 0 ? nivelColor(d.severidade) : "text-muted-foreground"}`}>{d.count}</div>
                      </div>
                      <span className={`w-2 h-2 rounded-full mt-1 ${d.count > 0 ? nivelDot(d.severidade) : "bg-muted"}`} />
                    </div>
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </LocalBoundary>

        {/* Logs */}
        <LocalBoundary label="Logs">
          <Card className="md:col-span-3">
            <CardHeader><CardTitle className="text-sm">Últimos erros capturados (refresh 10s)</CardTitle></CardHeader>
            <CardContent>
              {loading || !logs ? <Skeleton className="h-32 w-full" /> : logs.logs.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Nenhum erro nas últimas horas 🎉</p>
              ) : (
                <div className="space-y-1 max-h-96 overflow-auto">
                  {logs.logs.map((log) => (
                    <div key={log.id} className="flex items-start gap-3 p-2 text-xs border-b last:border-0">
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 ${log.severity === "fatal" ? "bg-destructive" : "bg-yellow-500"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono truncate"><b>{log.rpc}</b> — {log.message}</div>
                        <div className="text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")} · oficina {log.oficina_id?.slice(0, 8) ?? "—"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </LocalBoundary>
      </div>

      {evid && <EvidenciaModal open={!!evid} onClose={() => setEvid(null)} sql={evid.sql} label={evid.label} />}
    </div>
  );
}
