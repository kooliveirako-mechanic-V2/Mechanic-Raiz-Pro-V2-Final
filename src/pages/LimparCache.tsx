import { useEffect, useState } from "react";
import { RefreshCw, CheckCircle, AlertTriangle } from "lucide-react";

export default function LimparCache() {
  const [status, setStatus] = useState<"limpando" | "sucesso" | "erro">("limpando");
  const [details, setDetails] = useState<string[]>([]);

  useEffect(() => {
    const limpar = async () => {
      const logs: string[] = [];

      try {
        // 1. Unregister all service workers
        if ("serviceWorker" in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map((r) => r.unregister()));
          logs.push(`✅ ${regs.length} service worker(s) removido(s)`);
        } else {
          logs.push("ℹ️ Service Worker não suportado");
        }

        // 2. Clear all caches
        if ("caches" in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
          logs.push(`✅ ${keys.length} cache(s) limpo(s)`);
        }

        // 3. Clear localStorage
        try {
          const count = localStorage.length;
          localStorage.clear();
          logs.push(`✅ ${count} itens do armazenamento local limpos`);
        } catch {
          logs.push("⚠️ Não foi possível limpar armazenamento local");
        }

        setDetails(logs);
        setStatus("sucesso");

        // 4. Redirect to home after 3 seconds
        setTimeout(() => {
          window.location.replace("/?_bust=" + Date.now());
        }, 3000);
      } catch (err) {
        logs.push(`❌ Erro: ${err instanceof Error ? err.message : String(err)}`);
        setDetails(logs);
        setStatus("erro");
      }
    };

    limpar();
  }, []);

  return (
    <div className="min-h-screen bg-[#0E1B2A] flex items-center justify-center p-6">
      <div className="bg-[#162A3E] rounded-2xl p-8 max-w-md w-full text-center space-y-6 border border-white/10">
        {status === "limpando" && (
          <>
            <RefreshCw className="w-16 h-16 text-[#00A8E8] mx-auto animate-spin" />
            <h1 className="text-2xl font-bold text-white">Atualizando o sistema...</h1>
            <p className="text-gray-400">Limpando cache e dados antigos. Aguarde...</p>
          </>
        )}

        {status === "sucesso" && (
          <>
            <CheckCircle className="w-16 h-16 text-emerald-500 mx-auto" />
            <h1 className="text-2xl font-bold text-white">Sistema atualizado! ✅</h1>
            <p className="text-gray-400">
              Tudo limpo! Você será redirecionado em instantes...
            </p>
            <p className="text-sm text-gray-500">
              Se não redirecionar, toque no botão abaixo:
            </p>
            <button
              onClick={() => window.location.replace("/?_bust=" + Date.now())}
              className="bg-[#0077B6] hover:bg-[#0077B6]/80 text-white font-semibold py-3 px-6 rounded-xl transition-colors w-full"
            >
              Ir para o sistema
            </button>
          </>
        )}

        {status === "erro" && (
          <>
            <AlertTriangle className="w-16 h-16 text-amber-500 mx-auto" />
            <h1 className="text-2xl font-bold text-white">Erro na limpeza</h1>
            <p className="text-gray-400">
              Tente limpar manualmente: Configurações do navegador → Dados de sites → Limpar
            </p>
            <button
              onClick={() => window.location.replace("/?_bust=" + Date.now())}
              className="bg-[#0077B6] hover:bg-[#0077B6]/80 text-white font-semibold py-3 px-6 rounded-xl transition-colors w-full"
            >
              Tentar acessar mesmo assim
            </button>
          </>
        )}

        {details.length > 0 && (
          <div className="text-left bg-black/30 rounded-lg p-4 space-y-1">
            {details.map((d, i) => (
              <p key={i} className="text-xs text-gray-400 font-mono">{d}</p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}