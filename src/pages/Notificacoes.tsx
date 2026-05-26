import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Bell,
  Clock,
  Package,
  Wrench,
  CheckCircle2,
  Trash2,
  Check,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNotificacoes } from "@/hooks/useNotificacoes";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";

type NotificationType = "recorrencia" | "estoque" | "servico" | "sistema";

const notificationConfig: Record<
  NotificationType,
  { icon: typeof Bell; bgColor: string; iconColor: string }
> = {
  recorrencia: {
    icon: Clock,
    bgColor: "bg-warning/10",
    iconColor: "text-warning",
  },
  estoque: {
    icon: Package,
    bgColor: "bg-destructive/10",
    iconColor: "text-destructive",
  },
  servico: {
    icon: Wrench,
    bgColor: "bg-success/10",
    iconColor: "text-success",
  },
  sistema: {
    icon: Bell,
    bgColor: "bg-info/10",
    iconColor: "text-info",
  },
};

export default function Notificacoes() {
  const { 
    notificacoes, 
    countNaoLidas, 
    isLoading,
    marcarComoLida,
    marcarTodasComoLidas,
    deletarNotificacao 
  } = useNotificacoes();
  const [activeTab, setActiveTab] = useState("all");

  const filteredNotifications = notificacoes.filter((n) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !n.lida;
    return n.tipo === activeTab;
  });

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ptBR });
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
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
      <div className="space-y-6 max-w-3xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Notificações
            </h1>
            <p className="text-muted-foreground mt-1">
              {countNaoLidas > 0
                ? `${countNaoLidas} notificação${countNaoLidas > 1 ? "ões" : ""} não lida${countNaoLidas > 1 ? "s" : ""}`
                : "Todas as notificações lidas"}
            </p>
          </div>
          {countNaoLidas > 0 && (
            <Button 
              variant="outline" 
              onClick={() => marcarTodasComoLidas.mutate()}
              disabled={marcarTodasComoLidas.isPending}
            >
              <Check className="w-4 h-4 mr-2" />
              Marcar todas como lidas
            </Button>
          )}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50 p-1 flex-wrap h-auto">
            <TabsTrigger value="all" className="data-[state=active]:bg-card">
              Todas
            </TabsTrigger>
            <TabsTrigger value="unread" className="data-[state=active]:bg-card">
              Não Lidas
              {countNaoLidas > 0 && (
                <Badge variant="destructive" className="ml-2 text-xs px-1.5 py-0">
                  {countNaoLidas}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="recorrencia" className="data-[state=active]:bg-card">
              Recorrências
            </TabsTrigger>
            <TabsTrigger value="estoque" className="data-[state=active]:bg-card">
              Estoque
            </TabsTrigger>
            <TabsTrigger value="servico" className="data-[state=active]:bg-card">
              Serviços
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            {filteredNotifications.length === 0 ? (
              <div className="bg-card rounded-xl border border-border p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  Nenhuma notificação
                </h3>
                <p className="text-sm text-muted-foreground">
                  {activeTab === "all" 
                    ? "Você não tem notificações ainda" 
                    : "Nenhuma notificação nesta categoria"}
                </p>
              </div>
            ) : (
              <div className="bg-card rounded-xl border border-border overflow-hidden">
                <div className="divide-y divide-border">
                  {filteredNotifications.map((notification, index) => {
                    const tipoNorm = notification.tipo as NotificationType;
                    const config = notificationConfig[tipoNorm] || notificationConfig.sistema;
                    const Icon = config.icon;

                    return (
                      <div
                        key={notification.id}
                        className={cn(
                          "p-4 md:p-6 transition-colors cursor-pointer animate-slide-up",
                          !notification.lida
                            ? "bg-accent/5 hover:bg-accent/10"
                            : "hover:bg-muted/30"
                        )}
                        style={{ animationDelay: `${index * 30}ms` }}
                        onClick={() => {
                          if (!notification.lida) {
                            marcarComoLida.mutate(notification.id);
                          }
                        }}
                      >
                        <div className="flex items-start gap-4">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                              config.bgColor
                            )}
                          >
                            <Icon className={cn("w-5 h-5", config.iconColor)} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-foreground">
                                {notification.titulo}
                              </p>
                              {!notification.lida && (
                                <div className="w-2 h-2 rounded-full bg-accent" />
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {notification.mensagem}
                            </p>
                            <p className="text-xs text-muted-foreground mt-2">
                              {formatTime(notification.created_at)}
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletarNotificacao.mutate(notification.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
