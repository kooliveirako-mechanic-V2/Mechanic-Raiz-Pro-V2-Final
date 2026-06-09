import { useState, useMemo, useEffect, useCallback } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Phone, User, Edit2, MoreHorizontal, Link2, ChevronRight, Upload, Star } from "lucide-react";
import { useClientes, Cliente } from "@/hooks/useClientes";
import { useClienteSearch } from "@/hooks/useClienteSearch";
import { useOrdensServico } from "@/hooks/useOrdensServico";
import { ClienteFormModal } from "@/components/forms/ClienteFormModal";
import { OrdemServicoFormModal } from "@/components/forms/OrdemServicoFormModal";
import { OrcamentoFormModal } from "@/components/forms/OrcamentoFormModal";
import { ImportContactsModal } from "@/components/clientes/ImportContactsModal";
import { PageLoader } from "@/components/ui/loading-states";
import { DraftResumeBanner } from "@/components/DraftResumeBanner";
import { useOficina } from "@/contexts/OficinaContext";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Clientes() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clientes, isLoading, totalCount, hasNextPage, isFetchingNextPage, fetchNextPage } = useClientes();
  const { ordens } = useOrdensServico();
  const { oficinaAtual } = useOficina();
  const [searchTerm, setSearchTerm] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [clienteEdit, setClienteEdit] = useState<Cliente | null>(null);
  const [initialTab, setInitialTab] = useState<"dados" | "historico" | undefined>();
  const [importModalOpen, setImportModalOpen] = useState(false);

  const [osModalOpen, setOsModalOpen] = useState(false);
  const [orcModalOpen, setOrcModalOpen] = useState(false);
  const [prefillClienteId, setPrefillClienteId] = useState("");
  const [prefillVeiculoId, setPrefillVeiculoId] = useState("");

  const clienteFielMap = useMemo(() => {
    const map = new Map<string, number>();
    ordens.forEach((os) => {
      if (os.status === "finalizado") {
        map.set(os.cliente_id, (map.get(os.cliente_id) || 0) + 1);
      }
    });
    return map;
  }, [ordens]);

  const openClienteModal = useCallback((cliente: Cliente | null, tab?: "dados" | "historico") => {
    setClienteEdit(cliente);
    setInitialTab(tab);
    setModalOpen(true);

    const params = new URLSearchParams(searchParams);
    params.set("cliente", cliente?.id || "novo");
    if (tab) params.set("clienteTab", tab);
    else params.delete("clienteTab");
    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

  const handleClienteModalChange = useCallback((open: boolean) => {
    setModalOpen(open);
    if (!open) {
      setClienteEdit(null);
      setInitialTab(undefined);
      const params = new URLSearchParams(searchParams);
      params.delete("cliente");
      params.delete("clienteTab");
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleOSModalChange = useCallback((open: boolean) => {
    setOsModalOpen(open);
    if (!open) {
      setPrefillClienteId("");
      setPrefillVeiculoId("");
      const params = new URLSearchParams(searchParams);
      params.delete("os");
      params.delete("clienteId");
      params.delete("veiculoId");
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const handleOrcamentoModalChange = useCallback((open: boolean) => {
    setOrcModalOpen(open);
    if (!open) {
      setPrefillClienteId("");
      setPrefillVeiculoId("");
      const params = new URLSearchParams(searchParams);
      params.delete("orc");
      params.delete("clienteId");
      params.delete("veiculoId");
      setSearchParams(params, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const state = location.state as { editClienteId?: string; tab?: string } | null;
    if (state?.editClienteId && clientes.length > 0) {
      const cliente = clientes.find((c) => c.id === state.editClienteId);
      if (cliente) {
        openClienteModal(cliente, state.tab === "historico" ? "historico" : "dados");
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, clientes, openClienteModal]);

  useEffect(() => {
    const clienteParam = searchParams.get("cliente");
    const clienteTab = searchParams.get("clienteTab");
    const osParam = searchParams.get("os");
    const orcParam = searchParams.get("orc");
    const queryClienteId = searchParams.get("clienteId") || "";
    const queryVeiculoId = searchParams.get("veiculoId") || "";

    if (clienteParam && !modalOpen) {
      if (clienteParam === "novo") {
        setClienteEdit(null);
        setInitialTab(clienteTab === "historico" ? "historico" : "dados");
        setModalOpen(true);
      } else if (clientes.length > 0) {
        const found = clientes.find((cliente) => cliente.id === clienteParam);
        if (found) {
          setClienteEdit(found);
          setInitialTab(clienteTab === "historico" ? "historico" : "dados");
          setModalOpen(true);
        } else {
          const params = new URLSearchParams(searchParams);
          params.delete("cliente");
          params.delete("clienteTab");
          setSearchParams(params, { replace: true });
        }
      }
    }

    if (osParam === "nova" && !osModalOpen) {
      setPrefillClienteId(queryClienteId);
      setPrefillVeiculoId(queryVeiculoId);
      setOsModalOpen(true);
    }

    if (orcParam === "nova" && !orcModalOpen) {
      setPrefillClienteId(queryClienteId);
      setPrefillVeiculoId(queryVeiculoId);
      setOrcModalOpen(true);
    }
  }, [searchParams, clientes, modalOpen, osModalOpen, orcModalOpen, setSearchParams]);

  // CAUSA RAIZ: Busca server-side para encontrar clientes além dos paginados
  const { results: searchResults, isLoading: isSearching, isSearching: hasActiveSearch } = useClienteSearch(searchTerm);

  // Quando há busca ativa, usa resultados do servidor; senão, usa lista paginada
  const filteredClients = hasActiveSearch ? searchResults : clientes;

  const handleEdit = (cliente: Cliente) => {
    openClienteModal(cliente);
  };

  const handleNew = () => {
    openClienteModal(null);
  };

  const handleNovaOS = (clienteId: string, veiculoId?: string) => {
    setModalOpen(false);
    setClienteEdit(null);
    setInitialTab(undefined);
    setPrefillClienteId(clienteId);
    setPrefillVeiculoId(veiculoId || "");

    const params = new URLSearchParams(searchParams);
    params.delete("cliente");
    params.delete("clienteTab");
    params.set("os", "nova");
    params.set("clienteId", clienteId);
    if (veiculoId) params.set("veiculoId", veiculoId);
    else params.delete("veiculoId");
    setSearchParams(params, { replace: true });

    setTimeout(() => setOsModalOpen(true), 200);
  };

  const handleNovoOrcamento = (clienteId: string, veiculoId?: string) => {
    setModalOpen(false);
    setClienteEdit(null);
    setInitialTab(undefined);
    setPrefillClienteId(clienteId);
    setPrefillVeiculoId(veiculoId || "");

    const params = new URLSearchParams(searchParams);
    params.delete("cliente");
    params.delete("clienteTab");
    params.set("orc", "nova");
    params.set("clienteId", clienteId);
    if (veiculoId) params.set("veiculoId", veiculoId);
    else params.delete("veiculoId");
    setSearchParams(params, { replace: true });

    setTimeout(() => setOrcModalOpen(true), 200);
  };

  const getPortalUrl = (token: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/portal/${token}`;
  };

  const handleCopyPortalLink = (e: React.MouseEvent, cliente: Cliente) => {
    e.stopPropagation();
    if (!cliente.portal_token) {
      toast.error("Token do portal não disponível");
      return;
    }
    const url = getPortalUrl(cliente.portal_token);
    navigator.clipboard.writeText(url);
    toast.success("Link copiado!");
  };

  const handleShareWhatsApp = (e: React.MouseEvent, cliente: Cliente) => {
    e.stopPropagation();
    if (!cliente.portal_token || !cliente.telefone) {
      toast.error("Telefone ou token não disponível");
      return;
    }
    const url = getPortalUrl(cliente.portal_token);
    const phone = cliente.telefone.replace(/\D/g, "");
    const message = encodeURIComponent(`Olá ${cliente.nome.split(" ")[0]}! Acesse seu portal: ${url}`);
    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
  };

  if (isLoading) {
    return (
      <MainLayout>
        <PageLoader message="Carregando clientes..." />
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">Clientes</h1>
            <p className="text-sm text-muted-foreground">
              {totalCount > clientes.length ? `Exibindo ${clientes.length} de ${totalCount}` : `${clientes.length} cadastrados`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportModalOpen(true)} className="flex-shrink-0" size="icon" title="Importar Contatos">
              <Upload className="w-4 h-4" />
            </Button>
            <Button onClick={handleNew} className="bg-accent hover:bg-accent/90 flex-shrink-0">
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">Novo Cliente</span>
              <span className="sm:hidden">Novo</span>
            </Button>
          </div>
        </div>

        {/* BLINDAGEM: banner de retomada de rascunho de novo cliente */}
        <DraftResumeBanner
          draftKey={`cliente-form-${oficinaAtual?.id || "global"}-new`}
          label="cliente"
          hidden={modalOpen}
          onResume={() => handleNew()}
        />

        <div className="relative">

          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, CPF ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {isSearching ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center">
            <p className="text-sm text-muted-foreground">Buscando...</p>
          </div>
        ) : filteredClients.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-8 text-center space-y-4">
            <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mx-auto">
              <User className="w-8 h-8 text-primary" />
            </div>
            {clientes.length === 0 && !hasActiveSearch ? (
              <>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Nenhum cliente cadastrado</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Cadastre seu primeiro cliente para começar a criar ordens de serviço
                  </p>
                </div>
                <Button onClick={handleNew} className="bg-accent hover:bg-accent/90">
                  <Plus className="w-4 h-4 mr-2" /> Cadastrar primeiro cliente
                </Button>
              </>
            ) : (
              <p className="text-muted-foreground">Nenhum resultado para esta busca.</p>
            )}
          </div>
        ) : (
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="divide-y divide-border">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  className="flex items-center gap-3 p-3 sm:p-4 cursor-pointer transition-colors hover:bg-muted/30"
                  onClick={() => handleEdit(client)}
                >
                  <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold flex-shrink-0 text-xs">
                    {client.nome.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-medium text-foreground truncate">{client.nome}</h3>
                      {(clienteFielMap.get(client.id) || 0) >= 5 && <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />}
                    </div>
                    {client.telefone && <p className="text-xs text-muted-foreground">{client.telefone}</p>}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="flex h-9 w-9 min-h-[44px] min-w-[44px]">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleEdit(client); }}>
                        <Edit2 className="w-4 h-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={(e) => handleCopyPortalLink(e as unknown as React.MouseEvent, client)}>
                        <Link2 className="w-4 h-4 mr-2" />
                        Copiar link portal
                      </DropdownMenuItem>
                      {client.telefone && (
                        <DropdownMenuItem onClick={(e) => handleShareWhatsApp(e as unknown as React.MouseEvent, client)}>
                          <Phone className="w-4 h-4 mr-2" />
                          Enviar WhatsApp
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <ChevronRight className="w-4 h-4 text-muted-foreground/40 flex-shrink-0" />
                </div>
              ))}
            </div>
          </div>
        )}

        {hasNextPage && !hasActiveSearch && (
          <div className="flex justify-center py-4">
            <Button
              variant="outline"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
              className="min-w-[200px]"
            >
              {isFetchingNextPage ? "Carregando..." : "Carregar mais"}
            </Button>
          </div>
        )}
      </div>

      <ClienteFormModal open={modalOpen} onOpenChange={handleClienteModalChange} cliente={clienteEdit} initialTab={initialTab} onNovaOS={handleNovaOS} onNovoOrcamento={handleNovoOrcamento} />
      <ImportContactsModal open={importModalOpen} onOpenChange={setImportModalOpen} />
      <OrdemServicoFormModal open={osModalOpen} onOpenChange={handleOSModalChange} initialClienteId={prefillClienteId} initialVeiculoId={prefillVeiculoId} />
      <OrcamentoFormModal open={orcModalOpen} onOpenChange={handleOrcamentoModalChange} initialClienteId={prefillClienteId} initialVeiculoId={prefillVeiculoId} />
    </MainLayout>
  );
}
