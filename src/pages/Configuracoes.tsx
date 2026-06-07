import { useState, useRef, useEffect } from "react";
import { validateFile, getSafeExtension } from "@/lib/uploadValidation";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Building2,
  User,
  Bell,
  Shield,
  Palette,
  CreditCard,
  HelpCircle,
  ChevronRight,
  Camera,
  Bike,
  Car,
  Moon,
  Sun,
  LogOut,
  Loader2,
  Users,
  Upload,
  Receipt,
  Percent,
  Smartphone,
  Download,
  CalendarClock,
} from "lucide-react";
import { useOficina } from "@/contexts/OficinaContext";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole } from "@/hooks/useUserRole";
import { OficinaFormModal } from "@/components/forms/OficinaFormModal";
import { AccountModal } from "@/components/configuracoes/AccountModal";
import { SecurityModal } from "@/components/configuracoes/SecurityModal";
import { NotificationsModal } from "@/components/configuracoes/NotificationsModal";
import { HelpModal } from "@/components/configuracoes/HelpModal";
import { TeamModal } from "@/components/configuracoes/TeamModal";
import { DadosFiscaisModal } from "@/components/configuracoes/DadosFiscaisModal";
import { ComissoesModal } from "@/components/configuracoes/ComissoesModal";
import { AgendamentoOnlineModal } from "@/components/configuracoes/AgendamentoOnlineModal";
import { useOficinaConfiguracoes } from "@/hooks/useOficinaConfiguracoes";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { DataSecurityCard } from "@/components/configuracoes/DataSecurityCard";
import { BuildVersionIndicator } from "@/components/BuildVersionIndicator";

const getSettingsSections = (isProprietario: boolean) => {
  const sections = [
    {
      id: "workshop",
      icon: Building2,
      title: "Dados da Oficina",
      description: "Nome, endereço e informações de contato",
      iconColor: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      id: "profile",
      icon: User,
      title: "Minha Conta",
      description: "Dados pessoais e senha",
      iconColor: "text-accent",
      bgColor: "bg-accent/10",
    },
  ];

  // Seção de equipe e comissões só para proprietário
  if (isProprietario) {
    sections.push(
      {
        id: "team",
        icon: Users,
        title: "Equipe",
        description: "Funcionários e permissões",
        iconColor: "text-info",
        bgColor: "bg-info/10",
      },
      {
        id: "comissoes",
        icon: Percent,
        title: "Comissões",
        description: "Percentual de comissão por mecânico",
        iconColor: "text-accent",
        bgColor: "bg-accent/10",
      }
    );
  }

  sections.push({
    id: "agendamento_online",
    icon: CalendarClock,
    title: "Agendamento Online",
    description: "Link público para clientes solicitarem horários",
    iconColor: "text-fuchsia-500",
    bgColor: "bg-fuchsia-500/10",
  });

  sections.push(
    {
      id: "fiscal",
      icon: Receipt,
      title: "Dados Fiscais",
      description: "CNPJ, regime tributário e dados para NF",
      iconColor: "text-highlight",
      bgColor: "bg-highlight/10",
    },
    {
      id: "notifications",
      icon: Bell,
      title: "Notificações",
      description: "Alertas e lembretes",
      iconColor: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      id: "security",
      icon: Shield,
      title: "Segurança",
      description: "Senha e autenticação",
      iconColor: "text-success",
      bgColor: "bg-success/10",
    },
    {
      id: "appearance",
      icon: Palette,
      title: "Aparência",
      description: "Tema e personalização",
      iconColor: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      id: "billing",
      icon: CreditCard,
      title: "Plano e Pagamento",
      description: "Assinatura e faturamento",
      iconColor: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      id: "help",
      icon: HelpCircle,
      title: "Ajuda e Suporte",
      description: "FAQ e contato",
      iconColor: "text-muted-foreground",
      bgColor: "bg-muted",
    },
    {
      id: "tour",
      icon: HelpCircle,
      title: "Ver Tour Novamente",
      description: "Reveja o tutorial de introdução",
      iconColor: "text-info",
      bgColor: "bg-info/10",
    }
  );

  return sections;
};

export default function Configuracoes() {
  const { oficinaAtual, refetch: refetchOficinas } = useOficina();
  const { user, signOut } = useAuth();
  const { isProprietario } = useUserRole();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const appearanceRef = useRef<HTMLDivElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { configuracoes, isLoading: configLoading, updateConfiguracoes } = useOficinaConfiguracoes();
  
  // Get settings sections based on role
  const settingsSections = getSettingsSections(isProprietario);
  
  // Modal states
  const [oficinaModalOpen, setOficinaModalOpen] = useState(false);
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [notificationsModalOpen, setNotificationsModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [fiscalModalOpen, setFiscalModalOpen] = useState(false);
  const [comissoesModalOpen, setComissoesModalOpen] = useState(false);
  const [agendamentoOnlineOpen, setAgendamentoOnlineOpen] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  // Quick settings state - sincronizado com banco
  const [whatsappNotif, setWhatsappNotif] = useState(true);
  const [estoqueAlerta, setEstoqueAlerta] = useState(true);
  const [recorrenciaLembrete, setRecorrenciaLembrete] = useState(true);
  const [resumoDiario, setResumoDiario] = useState(false);

  // Handle logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !oficinaAtual) return;

    const validation = validateFile(file, "logo");
    if (!validation.ok) {
      toast.error(validation.error!);
      return;
    }

    setUploadingLogo(true);

    try {
      // Upload to storage — extensão extraída de forma segura
      const fileExt = getSafeExtension(file.name) || "png";
      const filePath = `${oficinaAtual.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('oficina-logos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('oficina-logos')
        .getPublicUrl(filePath);

      // Update oficina with logo URL
      const { error: updateError } = await supabase
        .from('oficinas')
        .update({ logo_url: publicUrl })
        .eq('id', oficinaAtual.id);

      if (updateError) throw updateError;

      // Refresh data
      refetchOficinas?.();
      queryClient.invalidateQueries({ queryKey: ['oficinas'] });
      
      toast.success("Logo atualizada com sucesso!");
    } catch (error: any) {
      toast.error("Erro ao atualizar logo", { description: error.message });
    } finally {
      setUploadingLogo(false);
    }
  };

  // Sincronizar estado local com configurações do banco
  useEffect(() => {
    if (configuracoes) {
      setWhatsappNotif(configuracoes.whatsapp_notificacoes);
      setEstoqueAlerta(configuracoes.estoque_alertas);
      setRecorrenciaLembrete(configuracoes.recorrencia_lembretes);
      setResumoDiario(configuracoes.resumo_diario);
    }
  }, [configuracoes]);

  // Função para atualizar configuração no banco
  const handleConfigChange = async (key: string, value: boolean) => {
    try {
      await updateConfiguracoes.mutateAsync({ [key]: value });
    } catch (error) {
      // O hook já mostra toast de erro
    }
  };

  const handleSectionClick = (sectionId: string) => {
    switch (sectionId) {
      case "workshop":
        setOficinaModalOpen(true);
        break;
      case "profile":
        setAccountModalOpen(true);
        break;
      case "team":
        setTeamModalOpen(true);
        break;
      case "comissoes":
        setComissoesModalOpen(true);
        break;
      case "agendamento_online":
        setAgendamentoOnlineOpen(true);
        break;
      case "fiscal":
        setFiscalModalOpen(true);
        break;
      case "notifications":
        setNotificationsModalOpen(true);
        break;
      case "security":
        setSecurityModalOpen(true);
        break;
      case "appearance":
        appearanceRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        break;
      case "billing":
        navigate("/upgrade");
        break;
      case "help":
        setHelpModalOpen(true);
        break;
      case "tour":
        localStorage.removeItem("mechanic_tour_completed");
        toast.success("Tour resetado! Volte ao dashboard para vê-lo novamente.");
        break;
      default:
        toast.info("Em breve!");
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      navigate("/auth");
    } catch (error) {
      toast.error("Erro ao sair");
    }
  };

  const getOficinaIcon = () => {
    if (oficinaAtual?.tipo === "carro") return Car;
    if (oficinaAtual?.tipo === "moto") return Bike;
    return Bike; // Default for "ambos"
  };

  const OficinaIcon = getOficinaIcon();

  if (configLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="space-y-6 max-w-4xl pb-24">
        {/* Header */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Configurações
          </h1>
          <p className="text-muted-foreground mt-1">
            Gerencie as configurações da sua oficina
          </p>
        </div>

        {/* Workshop Profile Card */}
        <div className="bg-card rounded-xl border border-border p-6">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="relative">
              {oficinaAtual?.logo_url ? (
                <img 
                  src={oficinaAtual.logo_url} 
                  alt="Logo da oficina"
                  className="w-24 h-24 rounded-xl object-cover border border-border"
                />
              ) : (
                <div className="w-24 h-24 rounded-xl bg-accent/10 flex items-center justify-center">
                  <OficinaIcon className="w-12 h-12 text-accent" />
                </div>
              )}
              <input
                type="file"
                ref={logoInputRef}
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
              <button 
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
                className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-accent text-accent-foreground flex items-center justify-center shadow-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
              >
                {uploadingLogo ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground">
                {oficinaAtual?.nome || "Minha Oficina"}
              </h2>
              <p className="text-muted-foreground">
                {oficinaAtual?.tipo === "carro" && "Carros"}
                {oficinaAtual?.tipo === "moto" && "Motos"}
                {oficinaAtual?.tipo === "ambos" && "Moto & Carro"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {oficinaAtual?.endereco || "Endereço não cadastrado"}
              </p>
            </div>
            <Button variant="outline" onClick={() => setOficinaModalOpen(true)}>
              Editar Perfil
            </Button>
          </div>
        </div>

        {/* Instalar no Celular */}
        <div className="bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl border border-primary/10 p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Smartphone className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Instalar no Celular</h3>
              <p className="text-sm text-muted-foreground">Use como aplicativo na tela inicial</p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Instale o Mechanic Raiz Pro no celular para acesso rápido, notificações e funcionamento offline.
          </p>
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => window.open("/instalar", "_blank")}
          >
            <Download className="w-4 h-4" />
            Ver como instalar
          </Button>
        </div>

        {/* Aparência - Theme Toggle */}
        <div ref={appearanceRef} className="bg-card rounded-xl border border-border p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Palette className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">Aparência</h3>
              <p className="text-sm text-muted-foreground">Escolha o tema do aplicativo</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant={theme === "light" ? "default" : "outline"}
              className={`flex-1 h-12 ${theme === "light" ? "bg-accent hover:bg-accent/90" : ""}`}
              onClick={() => setTheme("light")}
            >
              <Sun className="w-5 h-5 mr-2" />
              Claro
            </Button>
            <Button
              variant={theme === "dark" ? "default" : "outline"}
              className={`flex-1 h-12 ${theme === "dark" ? "bg-accent hover:bg-accent/90" : ""}`}
              onClick={() => setTheme("dark")}
            >
              <Moon className="w-5 h-5 mr-2" />
              Escuro
            </Button>
          </div>
        </div>

        {/* Quick Settings */}
        <div className="bg-card rounded-xl border border-border divide-y divide-border">
          <div className="p-6">
            <h3 className="font-semibold text-foreground mb-4">Configurações Rápidas</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Notificações por WhatsApp</p>
                  <p className="text-sm text-muted-foreground">
                    Receba alertas de serviços e recorrências
                  </p>
                </div>
                <Switch 
                  checked={whatsappNotif} 
                  onCheckedChange={(val) => {
                    setWhatsappNotif(val);
                    handleConfigChange("whatsapp_notificacoes", val);
                  }} 
                  disabled={updateConfiguracoes.isPending}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Alertas de Estoque Baixo</p>
                  <p className="text-sm text-muted-foreground">
                    Aviso quando itens atingirem quantidade mínima
                  </p>
                </div>
                <Switch 
                  checked={estoqueAlerta} 
                  onCheckedChange={(val) => {
                    setEstoqueAlerta(val);
                    handleConfigChange("estoque_alertas", val);
                  }} 
                  disabled={updateConfiguracoes.isPending}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Lembrete de Recorrências</p>
                  <p className="text-sm text-muted-foreground">
                    Notificar sobre serviços que estão vencendo
                  </p>
                </div>
                <Switch 
                  checked={recorrenciaLembrete} 
                  onCheckedChange={(val) => {
                    setRecorrenciaLembrete(val);
                    handleConfigChange("recorrencia_lembretes", val);
                  }} 
                  disabled={updateConfiguracoes.isPending}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">Resumo Diário</p>
                  <p className="text-sm text-muted-foreground">
                    Receber resumo dos serviços do dia
                  </p>
                </div>
                <Switch 
                  checked={resumoDiario} 
                  onCheckedChange={(val) => {
                    setResumoDiario(val);
                    handleConfigChange("resumo_diario", val);
                  }} 
                  disabled={updateConfiguracoes.isPending}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Settings Sections */}
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="divide-y divide-border">
            {settingsSections.map((section, index) => (
              <button
                key={section.id}
                className="w-full p-4 md:p-6 flex items-center gap-4 hover:bg-muted/30 transition-colors text-left animate-slide-up"
                style={{ animationDelay: `${index * 30}ms` }}
                onClick={() => handleSectionClick(section.id)}
              >
                <div className={`w-10 h-10 rounded-lg ${section.bgColor} flex items-center justify-center flex-shrink-0`}>
                  <section.icon className={`w-5 h-5 ${section.iconColor}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">{section.title}</p>
                  <p className="text-sm text-muted-foreground">{section.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>

        {/* User Info */}
        <div className="bg-card rounded-xl border border-border p-6">
          <h3 className="font-semibold text-foreground mb-4">Conta Conectada</h3>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
              <User className="w-6 h-6 text-accent" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">
                {user?.user_metadata?.nome || user?.email?.split("@")[0]}
              </p>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleLogout}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
        {/* Data Security Card */}

        {/* Data Security Card */}
        <DataSecurityCard />

        {/* Build Version & Cache Diagnostics */}
        <BuildVersionIndicator />

        {/* Version Info */}
        <div className="text-center text-sm text-muted-foreground">
          <p>Mechanic Raiz Pro v1.0.0</p>
          <p className="mt-1">© 2026 Todos os direitos reservados</p>
        </div>
      </div>

      {/* Modals */}
      <OficinaFormModal 
        open={oficinaModalOpen} 
        onOpenChange={setOficinaModalOpen} 
      />
      <AccountModal
        open={accountModalOpen}
        onOpenChange={setAccountModalOpen}
      />
      <SecurityModal
        open={securityModalOpen}
        onOpenChange={setSecurityModalOpen}
      />
      <NotificationsModal
        open={notificationsModalOpen}
        onOpenChange={setNotificationsModalOpen}
      />
      <HelpModal
        open={helpModalOpen}
        onOpenChange={setHelpModalOpen}
      />
      <TeamModal
        open={teamModalOpen}
        onOpenChange={setTeamModalOpen}
      />
      <DadosFiscaisModal
        open={fiscalModalOpen}
        onOpenChange={setFiscalModalOpen}
      />
      <ComissoesModal
        open={comissoesModalOpen}
        onOpenChange={setComissoesModalOpen}
      />
      <AgendamentoOnlineModal
        open={agendamentoOnlineOpen}
        onOpenChange={setAgendamentoOnlineOpen}
      />
    </MainLayout>
  );
}
