import { useEffect, useState, Fragment } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatters";
import { Loader2, Wrench, Phone, Share2, Download, MessageCircle, Package, DollarSign } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

interface PublicOSItem {
  nome_item: string;
  tipo?: "servico" | "produto" | null;
  quantidade: number;
  valor_unitario: number;
  valor_mao_obra?: number;
  valor_total: number;
}

interface PublicOS {
  id: string;
  status: string;
  tipo_servico: string;
  descricao: string | null;
  data_servico: string;
  valor_servico: number;
  desconto?: number;
  desconto_motivo?: string | null;
  tem_garantia: boolean;
  dias_garantia: number;
  created_at: string;
  data_conclusao: string | null;
  forma_pagamento: string | null;
  observacoes_conclusao: string | null;
  km_no_servico: number | null;
  oficina: {
    nome: string;
    logo_url: string | null;
    telefone: string | null;
    endereco: string | null;
    cnpj: string | null;
    razao_social: string | null;
  };
  cliente: {
    nome: string;
    telefone: string | null;
    cpf_cnpj: string | null;
    endereco: string | null;
  };
  veiculo: {
    marca: string;
    modelo: string;
    placa: string | null;
    ano: number | null;
    cor: string | null;
    km_atual: number | null;
  };
  itens: PublicOSItem[];
  sinais?: Array<{ id: string; valor: number; forma_pagamento: string | null; data_pagamento: string }>;
  total_sinais?: number;
  saldo_restante?: number;
}

const statusConfig: Record<string, { label: string; color: string; step: number }> = {
  pendente: { label: "Aguardando", color: "#F59E0B", step: 0 },
  em_diagnostico: { label: "Em Diagnóstico", color: "#D97706", step: 1 },
  em_andamento: { label: "Em Execução", color: "#3B82F6", step: 2 },
  aguardando_peca: { label: "Aguardando Peça", color: "#F97316", step: 1 },
  finalizado: { label: "Finalizado", color: "#10B981", step: 3 },
  cancelado: { label: "Cancelado", color: "#EF4444", step: -1 },
};

const progressSteps = [
  { label: "Recebido", shortLabel: "Recebido" },
  { label: "Diagnóstico", shortLabel: "Diagn." },
  { label: "Em Execução", shortLabel: "Exec." },
  { label: "Concluído", shortLabel: "Pronto" },
];

function ProgressBar({ currentStep, isCanceled }: { currentStep: number; isCanceled: boolean }) {
  if (isCanceled) {
    return (
      <div className="px-6 md:px-8 py-4" style={{ backgroundColor: '#FEF2F2' }}>
        <div className="flex items-center justify-center gap-2">
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#EF4444' }} />
          <span className="text-sm font-bold" style={{ color: '#EF4444' }}>Serviço Cancelado</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 md:px-8 py-5 no-print" style={{ backgroundColor: '#F8FAFC', borderBottom: '1px solid #e5e7eb' }}>
      <div className="flex items-center justify-between relative">
        {/* Connection line */}
        <div className="absolute top-[14px] left-[28px] right-[28px] h-[3px]" style={{ backgroundColor: '#E2E8F0' }}>
          <div
            className="h-full transition-all duration-700 ease-out rounded-full"
            style={{
              backgroundColor: '#10B981',
              width: `${Math.min((currentStep / (progressSteps.length - 1)) * 100, 100)}%`,
            }}
          />
        </div>

        {progressSteps.map((step, idx) => {
          const isCompleted = idx <= currentStep;
          const isCurrent = idx === currentStep;

          return (
            <div key={idx} className="relative z-10 flex flex-col items-center" style={{ minWidth: '56px' }}>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-500"
                style={{
                  backgroundColor: isCompleted ? '#10B981' : '#E2E8F0',
                  color: isCompleted ? '#FFFFFF' : '#94A3B8',
                  boxShadow: isCurrent ? '0 0 0 4px rgba(16, 185, 129, 0.2)' : 'none',
                  transform: isCurrent ? 'scale(1.15)' : 'scale(1)',
                }}
              >
                {isCompleted ? '✓' : idx + 1}
              </div>
              <span
                className="text-[10px] mt-1.5 font-semibold text-center leading-tight"
                style={{ color: isCompleted ? '#10B981' : '#94A3B8' }}
              >
                <span className="hidden sm:inline">{step.label}</span>
                <span className="sm:hidden">{step.shortLabel}</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function OSPublica() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const isPrintMode = searchParams.get("print") === "true";
  const [os, setOs] = useState<PublicOS | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const prevClass = root.classList.contains('dark');
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
    return () => {
      if (prevClass) root.classList.add('dark');
    };
  }, []);

  // Fetch OS data
  useEffect(() => {
    async function fetchOS() {
      if (!id) { 
        setError("ID da OS não fornecido"); 
        setLoading(false); 
        return; 
      }
      
      try {
        console.log("[OSPublica] Buscando OS:", id);
        const isNumero = /^\d+$/.test(id);
        const p_numero = isNumero ? parseInt(id) : null;
        
        // Tentativa 1: RPC (Caminho principal)
        const { data, error: rpcError } = isNumero
          ? await supabase.rpc("get_public_os_by_numero", { os_numero: p_numero })
          : await supabase.rpc("get_public_os", { os_id: id });
          
        if (!rpcError && data) {
          setOs(data as unknown as PublicOS);
          setLoading(false);
          return;
        }

        // Tentativa 2: Fallback direto via SELECT (Robusto contra falhas de RPC)
        console.log("[OSPublica] RPC falhou ou não retornou dados, tentando SELECT direto...");
        let query = supabase
          .from('ordens_servico')
          .select(`
            id, status, tipo_servico, descricao, data_servico, valor_servico, 
            desconto, desconto_motivo, tem_garantia, dias_garantia, created_at, 
            data_conclusao, forma_pagamento, observacoes_conclusao, km_no_servico,
            oficina:oficinas(nome, logo_url, telefone, endereco),
            cliente:clientes(nome, telefone, cpf_cnpj, endereco),
            veiculo:veiculos(marca, modelo, placa, ano, cor, km_atual),
            itens:itens_os(nome_item, tipo, quantidade, valor_unitario, valor_mao_obra, valor_total)
          `);

        if (isNumero) {
          query = query.eq('numero', p_numero);
        } else {
          query = query.eq('id', id);
        }

        const { data: directData, error: directError } = await query.maybeSingle();
        
        if (directData && !directError) {
          console.log("[OSPublica] Dados recuperados via Fallback Select");
          setOs(directData as unknown as PublicOS);
          setLoading(false);
          return;
        }

        if (rpcError) throw rpcError;
        if (directError) throw directError;
        
        setError("Ordem de serviço não encontrada");
      } catch (err: any) {
        console.error("[OSPublica] Erro fatal ao carregar OS:", err);
        setError(`Erro ao carregar ordem de serviço: ${err.message || 'Erro desconhecido'}`);
      } finally { 
        setLoading(false); 
      }
    }
    fetchOS();
  }, [id]);

  // Realtime: subscribe to status changes
  useEffect(() => {
    if (!os?.id) return;

    const channel = supabase
      .channel(`os-public-${os.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ordens_servico',
          filter: `id=eq.${os.id}`,
        },
        (payload) => {
          const newStatus = (payload.new as any)?.status;
          if (newStatus && newStatus !== os.status) {
            setRealtimeStatus(newStatus);
            // Re-fetch full data to get latest observations etc
            const isNumero = /^\d+$/.test(id || '');
            const fetchFn = isNumero
              ? supabase.rpc("get_public_os_by_numero", { os_numero: parseInt(id!) })
              : supabase.rpc("get_public_os", { os_id: id! });
            fetchFn.then(({ data }) => {
              if (data) {
                setOs(data as unknown as PublicOS);
                setRealtimeStatus(null);
              }
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [os?.id, id]);

  useEffect(() => {
    if (isPrintMode && os && !loading) {
      const timer = setTimeout(() => window.print(), 600);
      return () => clearTimeout(timer);
    }
  }, [isPrintMode, os, loading]);

  const fmtDate = (d: string) => { const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
  const fmtMoney = (v: number) => formatCurrency(v);
  const fmtPhone = (p: string) => {
    const clean = p.replace(/\D/g, "");
    if (clean.length === 11) return `(${clean.slice(0,2)}) ${clean.slice(2,7)}-${clean.slice(7)}`;
    if (clean.length === 10) return `(${clean.slice(0,2)}) ${clean.slice(2,6)}-${clean.slice(6)}`;
    return p;
  };

  const handleShare = async () => {
    const url = window.location.href.replace("?print=true", "");
    if (navigator.share) {
      try { await navigator.share({ title: `OS - ${os?.oficina.nome}`, url }); } catch {}
    } else {
      navigator.clipboard.writeText(url);
      toast.success("Link copiado!");
    }
  };

  const handleWhatsApp = () => {
    if (!os?.oficina.telefone) return;
    const phone = os.oficina.telefone.replace(/\D/g, "");
    const fullPhone = phone.length <= 11 ? `55${phone}` : phone;
    const msg = encodeURIComponent(
      `Olá! Sou ${os.cliente?.nome || 'cliente'}, gostaria de informações sobre minha OS (${os.tipo_servico} - ${os.veiculo.marca} ${os.veiculo.modelo}).`
    );
    window.open(`https://wa.me/${fullPhone}?text=${msg}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !os) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white p-4">
        <Card className="max-w-sm w-full">
          <CardContent className="pt-8 pb-6 text-center">
            <Wrench className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <h2 className="text-lg font-bold text-gray-900 mb-1">Não encontrada</h2>
            <p className="text-gray-500 text-sm">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentStatus = realtimeStatus || os.status;
  const status = statusConfig[currentStatus] || { label: currentStatus, color: "#6B7280", step: 0 };
  const itens = os.itens || [];
  const hasItens = itens.length > 0;

  // ── 3 BLOCOS SEPARADOS (mesma lógica do OSVisualizacaoModal) ──
  // 1) SERVIÇOS PUROS — só o valor do serviço em si
  const servicosBase = itens.filter((i) => (i.tipo ?? "servico") === "servico");
  const produtosBase = itens.filter((i) => (i.tipo ?? "servico") === "produto");

  const servicoItens = servicosBase.map((i) => {
    const mo = Number(i.valor_mao_obra ?? 0);
    const total = Number(i.valor_total ?? 0);
    return {
      nome: i.nome_item,
      valor: mo > 0 ? mo : total,
    };
  });

  // 2) PEÇAS PURAS — qtd × unit (sem MO misturada)
  const pecaItens = produtosBase.map((i) => {
    const qtd = Number(i.quantidade || 0);
    const unit = Number(i.valor_unitario || 0);
    return {
      nome: i.nome_item,
      quantidade: qtd,
      valor_unitario: unit,
      subtotal: qtd * unit,
    };
  });

  // 3) MÃO DE OBRA — apenas vinculada a peças
  // (a MO dos serviços já está embutida no valor do serviço no bloco 1, evita duplicação visual)
  const moItens: Array<{ origem: "Serviço" | "Peça"; nome: string; valor: number }> = [
    ...produtosBase
      .filter((i) => Number(i.valor_mao_obra ?? 0) > 0)
      .map((i) => ({ origem: "Peça" as const, nome: i.nome_item, valor: Number(i.valor_mao_obra) })),
  ];

  const subtotalServicos = servicoItens.reduce((a, r) => a + r.valor, 0);
  const subtotalPecas = pecaItens.reduce((a, r) => a + r.subtotal, 0);
  const subtotalMO = moItens.reduce((a, r) => a + r.valor, 0);
  const itensTotal = subtotalServicos + subtotalPecas + subtotalMO;
  // valor_servico do DB já consolida tudo; usamos como fonte principal
  const subtotalBruto = (os.valor_servico || 0) > 0 ? (os.valor_servico || 0) : itensTotal;
  const descontoOS = Number(os.desconto || 0);
  const valorTotal = Math.max(subtotalBruto - descontoOS, 0);

  return (
    <div className="min-h-screen os-public-page" style={{ backgroundColor: '#f3f4f6', colorScheme: 'light' }} data-theme="light">
      <style>{`
        .os-public-page, .os-public-page *, .os-public-page .os-doc {
          color-scheme: light !important;
        }
        .os-public-page .os-doc {
          background-color: #ffffff !important;
        }
        .os-public-page .os-header {
          background-color: #ffffff !important;
        }
        .os-public-page .os-footer {
          background-color: #f9fafb !important;
        }
        .os-table-wrapper {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }
        .os-table-wrapper table {
          min-width: 500px;
        }
        @media print {
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .os-doc { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; max-width: 100% !important; }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; animation: none !important; transition: none !important; }
          @page { margin: 8mm 10mm; size: A4; }
          .os-table-wrapper { overflow: visible; }
          .os-table-wrapper table { min-width: auto; }
        }
      `}</style>

      {/* ── BARRA DE AÇÕES (tela) ── */}
      <div className="no-print sticky top-0 z-10 px-4 py-2.5 shadow-sm" style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e5e7eb' }}>
        <div className="max-w-[850px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {os.oficina.logo_url ? (
              <img src={os.oficina.logo_url} alt="" className="w-9 h-9 rounded-lg object-cover" style={{ border: '1px solid #e5e7eb' }} />
            ) : (
              <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#111827' }}>
                <span className="font-bold text-sm" style={{ color: '#ffffff' }}>{os.oficina.nome.charAt(0)}</span>
              </div>
            )}
            <div>
              <p className="font-bold text-sm leading-tight" style={{ color: '#111827' }}>{os.oficina.nome}</p>
              <p className="text-[10px]" style={{ color: '#6b7280' }}>Ordem de Serviço</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2">
            {os.oficina.telefone && (
              <button
                className="h-9 px-3 sm:px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                style={{ backgroundColor: '#25D366', color: '#ffffff', border: 'none' }}
                onClick={handleWhatsApp}
              >
                <MessageCircle className="w-4 h-4" style={{ color: '#ffffff' }} />
                <span className="hidden sm:inline">WhatsApp</span>
              </button>
            )}
            <button className="h-9 px-3 sm:px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5" style={{ backgroundColor: '#111827', color: '#ffffff', border: '2px solid #111827' }} onClick={() => window.print()}>
              <Download className="w-4 h-4" style={{ color: '#ffffff' }} />
              <span className="hidden sm:inline">PDF</span>
            </button>
            <button className="h-9 px-3 sm:px-4 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5" style={{ backgroundColor: '#ffffff', color: '#111827', border: '2px solid #d1d5db' }} onClick={handleShare}>
              <Share2 className="w-4 h-4" style={{ color: '#111827' }} />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          </div>
        </div>
      </div>

      {/* ══════════ DOCUMENTO ══════════ */}
      <div className="os-doc max-w-[850px] mx-auto my-4 md:my-8 shadow-xl rounded-lg print:shadow-none print:rounded-none print:my-0 overflow-hidden" style={{ backgroundColor: '#ffffff' }}>
        
        {/* ── HEADER ── */}
        <div className="os-header px-6 py-5 md:px-8 md:py-6" style={{ backgroundColor: '#ffffff', borderBottom: '2px solid #e5e7eb' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {os.oficina.logo_url ? (
                <img
                  src={os.oficina.logo_url}
                  alt={os.oficina.nome}
                  className="w-16 h-16 md:w-20 md:h-20 object-contain rounded-lg p-1"
                  style={{ border: '1px solid #e5e7eb' }}
                />
              ) : (
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#f3f4f6', border: '1px solid #d1d5db' }}>
                  <span className="text-2xl md:text-3xl font-black" style={{ color: '#6b7280' }}>{os.oficina.nome.charAt(0)}</span>
                </div>
              )}
              <div>
                <h1 className="text-xl md:text-2xl font-black uppercase tracking-wider" style={{ color: '#111827' }}>
                  {os.oficina.nome}
                </h1>
                {os.oficina.razao_social && os.oficina.razao_social !== os.oficina.nome && (
                  <p className="text-xs mt-0.5 font-medium" style={{ color: '#6b7280' }}>{os.oficina.razao_social}</p>
                )}
                {os.oficina.cnpj && (
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>CNPJ: {os.oficina.cnpj}</p>
                )}
                {os.oficina.endereco && (
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>{os.oficina.endereco}</p>
                )}
                {os.oficina.telefone && (
                  <p className="text-xs mt-0.5" style={{ color: '#9ca3af' }}>
                    Tel: {fmtPhone(os.oficina.telefone)}
                  </p>
                )}
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#9ca3af' }}>
                Ordem de Serviço
              </p>
              <p className="text-2xl font-black mt-1 tabular-nums" style={{ color: '#111827' }}>{fmtDate(os.data_servico)}</p>
            </div>
          </div>
          <div className="sm:hidden mt-3 pt-3 flex justify-between items-center" style={{ borderTop: '1px solid #e5e7eb' }}>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: '#9ca3af' }}>Ordem de Serviço</p>
            <p className="text-lg font-black tabular-nums" style={{ color: '#111827' }}>{fmtDate(os.data_servico)}</p>
          </div>
        </div>

        {/* ── BARRA DE PROGRESSO VISUAL ── */}
        <ProgressBar currentStep={status.step} isCanceled={currentStatus === 'cancelado'} />

        {/* ── STATUS BAR (print) ── */}
        <div className="hidden print:flex px-6 md:px-8 py-2.5 border-b border-gray-200 items-center justify-between" style={{ backgroundColor: status.color + "08" }}>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: status.color }}>
              {status.label}
            </span>
          </div>
          {os.data_conclusao && (
            <span className="text-xs text-gray-500">Concluído em {fmtDate(os.data_conclusao)}</span>
          )}
        </div>

        <div className="px-6 md:px-8 py-6 space-y-6">

          {/* ── CLIENTE + VEÍCULO ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 border border-gray-300 rounded-lg overflow-hidden">
            <div className="p-4 md:border-r border-gray-300">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-gray-900 rounded-full" />
                <h2 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.15em]">Cliente</h2>
              </div>
              <div className="space-y-1.5">
                <p className="font-bold text-gray-900">{os.cliente?.nome || "—"}</p>
                {os.cliente?.telefone && <p className="text-sm text-gray-600">{fmtPhone(os.cliente.telefone)}</p>}
                {os.cliente?.cpf_cnpj && <p className="text-sm text-gray-600">CPF/CNPJ: {os.cliente.cpf_cnpj}</p>}
                {os.cliente?.endereco && <p className="text-sm text-gray-500">{os.cliente.endereco}</p>}
              </div>
            </div>
            <div className="p-4 border-t md:border-t-0 border-gray-300">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-1 h-4 bg-gray-900 rounded-full" />
                <h2 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.15em]">Veículo</h2>
              </div>
              <div className="space-y-1.5">
                <p className="font-bold text-gray-900">
                  {os.veiculo.marca} {os.veiculo.modelo}
                  {os.veiculo.ano ? ` ${os.veiculo.ano}` : ""}
                </p>
                <div className="flex flex-wrap gap-3">
                  {os.veiculo.placa && (
                    <span className="inline-flex items-center gap-1 text-sm">
                      <span className="text-gray-500">Placa:</span>
                      <span className="font-mono font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded text-xs uppercase tracking-wider">
                        {os.veiculo.placa}
                      </span>
                    </span>
                  )}
                  {os.veiculo.cor && <span className="text-sm text-gray-600">Cor: {os.veiculo.cor}</span>}
                </div>
                {(os.km_no_servico || os.veiculo.km_atual) && (
                  <p className="text-sm text-gray-600">
                    KM: {(os.km_no_servico || os.veiculo.km_atual || 0).toLocaleString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── SERVIÇO DESCRITIVO ── */}
          <div className="border border-gray-300 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1 h-4 bg-gray-900 rounded-full" />
              <h2 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.15em]">Serviço</h2>
            </div>
            <p className="font-semibold text-gray-900">{os.tipo_servico}</p>
            {os.descricao && <p className="text-sm text-gray-600 mt-1.5 leading-relaxed">{os.descricao}</p>}
            {os.observacoes_conclusao && (
              <div className="mt-3 pt-3 border-t border-dashed border-gray-300">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Observações</p>
                <p className="text-sm text-gray-700 leading-relaxed">{os.observacoes_conclusao}</p>
              </div>
            )}
          </div>

          {/* ── 1) SERVIÇOS EXECUTADOS ── */}
          {servicoItens.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Wrench className="w-4 h-4" style={{ color: '#f97316' }} />
                <h2 className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#f97316' }}>Serviços Executados</h2>
              </div>
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#fed7aa', backgroundColor: '#fff7ed' }}>
                <div className="os-table-wrapper">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: '#fed7aa' }}>
                        <th className="text-left py-2.5 px-3 text-[10px] font-black uppercase tracking-wider w-10" style={{ color: '#9a3412' }}>#</th>
                        <th className="text-left py-2.5 px-3 text-[10px] font-black uppercase tracking-wider" style={{ color: '#9a3412' }}>Serviço</th>
                        <th className="text-right py-2.5 px-4 text-[10px] font-black uppercase tracking-wider w-44" style={{ color: '#9a3412' }}>Valor (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicoItens.map((row, idx) => (
                        <tr key={`s-${idx}`} className="border-b" style={{ borderColor: '#fed7aa' }}>
                          <td className="py-3 px-3 align-top">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ backgroundColor: '#f97316', color: '#fff' }}>{idx + 1}</span>
                          </td>
                          <td className="py-3 px-3 text-sm font-semibold" style={{ color: '#111827' }}>{row.nome}</td>
                          <td className="py-3 px-4 text-sm font-bold text-right tabular-nums" style={{ color: '#111827' }}>{fmtMoney(row.valor)}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: '#ffedd5' }}>
                        <td colSpan={2} className="py-2.5 px-3 text-right text-[11px] font-black uppercase tracking-wider" style={{ color: '#9a3412' }}>
                          Subtotal Serviços
                        </td>
                        <td className="py-2.5 px-4 text-right text-base font-black tabular-nums" style={{ color: '#f97316' }}>{fmtMoney(subtotalServicos)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── 2) PEÇAS UTILIZADAS ── */}
          {pecaItens.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4" style={{ color: '#0077B6' }} />
                <h2 className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#0077B6' }}>Peças Utilizadas</h2>
              </div>
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#bae6fd', backgroundColor: '#f0f9ff' }}>
                <div className="os-table-wrapper">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: '#bae6fd' }}>
                        <th className="text-left py-2.5 px-3 text-[10px] font-black uppercase tracking-wider w-10" style={{ color: '#075985' }}>#</th>
                        <th className="text-left py-2.5 px-3 text-[10px] font-black uppercase tracking-wider" style={{ color: '#075985' }}>Peça</th>
                        <th className="text-center py-2.5 px-2 text-[10px] font-black uppercase tracking-wider w-16" style={{ color: '#075985' }}>Qtd.</th>
                        <th className="text-right py-2.5 px-3 text-[10px] font-black uppercase tracking-wider w-28" style={{ color: '#075985' }}>Valor Unit.</th>
                        <th className="text-right py-2.5 px-3 text-[10px] font-black uppercase tracking-wider w-28" style={{ color: '#075985' }}>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pecaItens.map((row, idx) => (
                        <tr key={`p-${idx}`} className="border-b" style={{ borderColor: '#bae6fd', backgroundColor: idx % 2 === 1 ? '#e0f2fe' : 'transparent' }}>
                          <td className="py-2.5 px-3">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold" style={{ backgroundColor: '#0077B6', color: '#fff' }}>{idx + 1}</span>
                          </td>
                          <td className="py-2.5 px-3 text-sm" style={{ color: '#111827' }}>{row.nome}</td>
                          <td className="py-2.5 px-2 text-sm text-center tabular-nums" style={{ color: '#111827' }}>{row.quantidade}</td>
                          <td className="py-2.5 px-3 text-sm text-right tabular-nums" style={{ color: '#374151' }}>{fmtMoney(row.valor_unitario)}</td>
                          <td className="py-2.5 px-3 text-sm font-semibold text-right tabular-nums" style={{ color: '#111827' }}>{fmtMoney(row.subtotal)}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: '#e0f2fe' }}>
                        <td colSpan={4} className="py-2.5 px-3 text-right text-[11px] font-black uppercase tracking-wider" style={{ color: '#075985' }}>
                          Subtotal Peças
                        </td>
                        <td className="py-2.5 px-3 text-right text-base font-black tabular-nums" style={{ color: '#0077B6' }}>{fmtMoney(subtotalPecas)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── 3) MÃO DE OBRA (separada) ── */}
          {moItens.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <DollarSign className="w-4 h-4" style={{ color: '#7c3aed' }} />
                <h2 className="text-[11px] font-black uppercase tracking-[0.15em]" style={{ color: '#7c3aed' }}>Mão de Obra</h2>
              </div>
              <div className="border rounded-lg overflow-hidden" style={{ borderColor: '#ddd6fe', backgroundColor: '#faf5ff' }}>
                <div className="os-table-wrapper">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr style={{ backgroundColor: '#ddd6fe' }}>
                        <th className="text-left py-2.5 px-3 text-[10px] font-black uppercase tracking-wider w-20" style={{ color: '#5b21b6' }}>Origem</th>
                        <th className="text-left py-2.5 px-3 text-[10px] font-black uppercase tracking-wider" style={{ color: '#5b21b6' }}>Item</th>
                        <th className="text-right py-2.5 px-4 text-[10px] font-black uppercase tracking-wider w-36" style={{ color: '#5b21b6' }}>Valor (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {moItens.map((row, idx) => (
                        <tr key={`mo-${idx}`} className="border-b" style={{ borderColor: '#ddd6fe', backgroundColor: idx % 2 === 1 ? '#f3e8ff' : 'transparent' }}>
                          <td className="py-2.5 px-3">
                            <span
                              className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
                              style={
                                row.origem === "Serviço"
                                  ? { backgroundColor: '#fed7aa', color: '#9a3412' }
                                  : { backgroundColor: '#bae6fd', color: '#075985' }
                              }
                            >
                              {row.origem}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-sm" style={{ color: '#111827' }}>{row.nome}</td>
                          <td className="py-2.5 px-4 text-sm font-semibold text-right tabular-nums" style={{ color: '#111827' }}>{fmtMoney(row.valor)}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: '#f3e8ff' }}>
                        <td colSpan={2} className="py-2.5 px-3 text-right text-[11px] font-black uppercase tracking-wider" style={{ color: '#5b21b6' }}>
                          Subtotal Mão de Obra
                        </td>
                        <td className="py-2.5 px-4 text-right text-base font-black tabular-nums" style={{ color: '#7c3aed' }}>{fmtMoney(subtotalMO)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── RESUMO FINANCEIRO ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1 h-4 bg-gray-900 rounded-full" />
              <h2 className="text-[11px] font-black text-gray-900 uppercase tracking-[0.15em]">Resumo Financeiro</h2>
            </div>
            {!hasItens ? (
              <div className="border border-gray-300 rounded-lg px-4 py-6 text-center text-sm text-gray-400 italic" style={{ backgroundColor: '#ffffff' }}>
                Nenhum item adicionado
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="border rounded-lg p-3" style={{ borderColor: '#fed7aa', backgroundColor: '#fff7ed' }}>
                  <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#f97316' }}>Subtotal Serviços</p>
                  <p className="text-lg md:text-xl font-black tabular-nums mt-1" style={{ color: '#9a3412' }}>{fmtMoney(subtotalServicos)}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#9a3412' }}>Valor dos serviços</p>
                </div>
                <div className="border rounded-lg p-3" style={{ borderColor: '#bae6fd', backgroundColor: '#f0f9ff' }}>
                  <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#0077B6' }}>Subtotal Peças</p>
                  <p className="text-lg md:text-xl font-black tabular-nums mt-1" style={{ color: '#075985' }}>{fmtMoney(subtotalPecas)}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#075985' }}>Total das peças</p>
                </div>
                <div className="border rounded-lg p-3" style={{ borderColor: '#ddd6fe', backgroundColor: '#faf5ff' }}>
                  <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#7c3aed' }}>Mão de Obra</p>
                  <p className="text-lg md:text-xl font-black tabular-nums mt-1" style={{ color: '#5b21b6' }}>{fmtMoney(subtotalMO)}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#5b21b6' }}>Mão de obra total</p>
                </div>
                <div className="border-2 rounded-lg p-3" style={{ borderColor: '#10B981', backgroundColor: '#ECFDF5' }}>
                  <p className="text-[9px] font-black uppercase tracking-wider" style={{ color: '#065F46' }}>Total do Serviço</p>
                  <p className="text-xl md:text-2xl font-black tabular-nums mt-1" style={{ color: '#065F46' }}>{fmtMoney(valorTotal)}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#065F46' }}>Serviços + Peças + MO</p>
                </div>
              </div>
            )}
            {descontoOS > 0 && (
              <div className="mt-3 border-2 rounded-lg overflow-hidden" style={{ borderColor: '#10B981' }}>
                <div className="px-4 py-3 space-y-1.5" style={{ backgroundColor: '#ECFDF5' }}>
                  <div className="flex justify-between text-xs" style={{ color: '#065F46' }}>
                    <span>Subtotal bruto</span>
                    <span className="tabular-nums line-through">{fmtMoney(subtotalBruto)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold" style={{ color: '#065F46' }}>
                    <span>🏷️ Desconto{os.desconto_motivo ? ` (${os.desconto_motivo})` : ''}</span>
                    <span className="tabular-nums">− {fmtMoney(descontoOS)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2" style={{ borderTop: '1px solid #10B981' }}>
                    <span className="font-black text-sm uppercase tracking-wider" style={{ color: '#065F46' }}>Total com desconto</span>
                    <span className="text-xl md:text-2xl font-black tabular-nums" style={{ color: '#065F46' }}>{fmtMoney(valorTotal)}</span>
                  </div>
                </div>
              </div>
            )}
            {(os.sinais || []).length > 0 && (
              <div className="mt-3 border rounded-lg overflow-hidden" style={{ borderColor: '#FCD34D' }}>
                <div className="px-4 py-3 space-y-1" style={{ backgroundColor: '#FFFBEB' }}>
                  {(os.sinais || []).map((s, idx) => (
                    <div key={s.id} className="flex justify-between text-xs" style={{ color: '#92400E' }}>
                      <span>Sinal {idx + 1} — {s.forma_pagamento || '—'} ({fmtDate(s.data_pagamento)})</span>
                      <span className="font-semibold tabular-nums">− {fmtMoney(Number(s.valor))}</span>
                    </div>
                  ))}
                  <div className="flex justify-between text-xs font-bold pt-1" style={{ color: '#92400E', borderTop: '1px solid #FCD34D' }}>
                    <span>Total recebido</span>
                    <span className="tabular-nums">− {fmtMoney(Number(os.total_sinais || 0))}</span>
                  </div>
                </div>
                {(os.total_sinais || 0) > 0 && (
                  <div className="px-4 py-3 flex justify-between items-center" style={{ backgroundColor: (os.saldo_restante || 0) <= 0 ? '#ECFDF5' : '#FEF2F2' }}>
                    <span className="font-black text-sm uppercase tracking-wider" style={{ color: (os.saldo_restante || 0) <= 0 ? '#065F46' : '#991B1B' }}>
                      {(os.saldo_restante || 0) <= 0 ? '✓ Pago integralmente' : 'Saldo a pagar'}
                    </span>
                    <span className="text-xl md:text-2xl font-black tabular-nums" style={{ color: (os.saldo_restante || 0) <= 0 ? '#065F46' : '#991B1B' }}>
                      {fmtMoney(os.saldo_restante || 0)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── INFO CARDS ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {os.forma_pagamento && (
              <div className="border border-gray-200 rounded-lg p-3 text-center">
                <p className="text-[9px] text-gray-400 uppercase tracking-[0.15em] font-bold">Pagamento</p>
                <p className="font-bold text-gray-900 text-sm mt-1">{os.forma_pagamento}</p>
              </div>
            )}
            {os.tem_garantia && (
              <div className="border-2 border-green-400 bg-green-50 rounded-lg p-3 text-center">
                <p className="text-[9px] text-green-600 uppercase tracking-[0.15em] font-bold">Garantia</p>
                <p className="font-black text-green-700 text-lg mt-0.5">{os.dias_garantia} <span className="text-xs font-bold">dias</span></p>
              </div>
            )}
            <div className="border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-[9px] text-gray-400 uppercase tracking-[0.15em] font-bold">Data</p>
              <p className="font-bold text-gray-900 text-sm mt-1">{fmtDate(os.data_servico)}</p>
            </div>
            <div className="border border-gray-200 rounded-lg p-3 text-center">
              <p className="text-[9px] text-gray-400 uppercase tracking-[0.15em] font-bold">Status</p>
              <p className="font-bold text-sm mt-1" style={{ color: status.color }}>{status.label}</p>
            </div>
          </div>


          {/* ── WHATSAPP CTA (mobile, no-print) ── */}
          {os.oficina.telefone && (
            <div className="no-print">
              <button
                onClick={handleWhatsApp}
                className="w-full py-3.5 rounded-lg text-sm font-bold inline-flex items-center justify-center gap-2"
                style={{ backgroundColor: '#25D366', color: '#ffffff', border: 'none' }}
              >
                <MessageCircle className="w-5 h-5" />
                Falar com a oficina via WhatsApp
              </button>
            </div>
          )}

          {/* ── ASSINATURAS ── */}
          <div className="pt-8 mt-4">
            <div className="grid grid-cols-2 gap-16">
              <div className="text-center">
                <div className="h-16 border-b-2 border-gray-900 mb-2" />
                <p className="text-xs font-bold text-gray-900">{os.oficina.nome}</p>
                {os.oficina.cnpj && (
                  <p className="text-[10px] text-gray-500 mt-0.5">CNPJ: {os.oficina.cnpj}</p>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">Responsável Técnico</p>
              </div>
              <div className="text-center">
                <div className="h-16 border-b-2 border-gray-900 mb-2" />
                <p className="text-xs font-bold text-gray-900">{os.cliente?.nome || "Cliente"}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">Cliente</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── RODAPÉ ── */}
        <div className="os-footer border-t px-6 md:px-8 py-3 text-center" style={{ backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}>
          <p className="text-[10px] text-gray-400">
            Documento gerado em {new Date().toLocaleDateString("pt-BR")} às{" "}
            {new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            {" · "}{os.oficina.nome}
            {os.oficina.cnpj && ` · CNPJ: ${os.oficina.cnpj}`}
            {" — Obrigado pela preferência!"}
          </p>
        </div>
      </div>

      <div className="h-4 md:h-8 no-print" />
    </div>
  );
}
