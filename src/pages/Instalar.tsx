import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Smartphone,
  Download,
  Share,
  MoreVertical,
  Plus,
  CheckCircle2,
  ArrowRight,
  Wrench,
  Zap,
  Wifi,
  Bell,
  QrCode,
  Apple,
  Copy,
  Check,
  Monitor,
  Laptop,
  ChevronRight,
  Globe,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function Instalar() {
  const navigate = useNavigate();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"mobile" | "desktop">("mobile");

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsAndroid(/Android/.test(ua));

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") setIsInstalled(true);
    setDeferredPrompt(null);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const featuresMobile = [
    { icon: Zap, title: "Acesso Rápido", description: "Abra com 1 toque, sem digitar URL" },
    { icon: Wifi, title: "Funciona Offline", description: "Consulte dados mesmo sem internet" },
    { icon: Bell, title: "Notificações", description: "Receba alertas de serviços" },
    { icon: Smartphone, title: "Como App", description: "Fica na tela inicial igual aplicativo" },
  ];

  const featuresDesktop = [
    { icon: Monitor, title: "Tela Grande", description: "Visualize gráficos e relatórios com conforto" },
    { icon: Zap, title: "Atalhos do Teclado", description: "Navegue mais rápido com comandos de teclado" },
    { icon: Wifi, title: "Sincronizado", description: "Mesmos dados do celular em tempo real" },
    { icon: Laptop, title: "Janela Própria", description: "Não fica misturado com abas do navegador" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 safe-area-inset">
      {/* Header */}
      <div className="bg-primary/5 border-b border-primary/10 px-4 py-6 md:py-10">
        <div className="max-w-lg mx-auto text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center mx-auto mb-4 shadow-xl shadow-primary/25"
          >
            <Wrench className="w-10 h-10 md:w-12 md:h-12 text-white" />
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-2xl md:text-3xl font-bold text-foreground mb-2"
          >
            Mechanic Raiz Pro
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-muted-foreground"
          >
            Instale em qualquer dispositivo
          </motion.p>
        </div>
      </div>

      <div className="max-w-lg mx-auto p-4 md:p-6 space-y-6">
        {/* Device Tabs */}
        <motion.div
          initial={{ opacity: 1, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
          className="flex rounded-xl bg-muted/50 p-1 gap-1"
        >
          <button
            onClick={() => setActiveTab("mobile")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "mobile"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Smartphone className="w-4 h-4" />
            Celular
          </button>
          <button
            onClick={() => setActiveTab("desktop")}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-semibold transition-all ${
              activeTab === "desktop"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Monitor className="w-4 h-4" />
            Computador
          </button>
        </motion.div>

        {activeTab === "mobile" && (
          <MobileTab
            isInstalled={isInstalled}
            isIOS={isIOS}
            isAndroid={isAndroid}
            deferredPrompt={deferredPrompt}
            onInstall={handleInstall}
            onCopy={handleCopyLink}
            copied={copied}
            features={featuresMobile}
          />
        )}

        {activeTab === "desktop" && (
          <DesktopTab
            features={featuresDesktop}
          />
        )}

        {/* Skip link */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="text-center">
          <Button variant="ghost" onClick={() => navigate("/")}>
            Continuar no navegador
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}

function MobileTab({
  isInstalled,
  isIOS,
  isAndroid,
  deferredPrompt,
  onInstall,
  onCopy,
  copied,
  features,
}: {
  isInstalled: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  deferredPrompt: BeforeInstallPromptEvent | null;
  onInstall: () => void;
  onCopy: () => void;
  copied: boolean;
  features: { icon: typeof Smartphone; title: string; description: string }[];
}) {
  return (
    <>
      {/* Already Installed */}
      {isInstalled ? (
        <motion.div initial={{ opacity: 1, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
          <Card className="bg-success/5 border-success/20">
            <CardContent className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Já está instalado!</h2>
              <p className="text-muted-foreground mb-4">
                O Mechanic Raiz Pro já está na sua tela inicial.
              </p>
              <Button onClick={() => window.location.reload()} className="w-full">
                Abrir Sistema
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <>
          {/* Features */}
          <motion.div
            initial={{ opacity: 1, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-2 gap-3"
          >
            {features.map((feature, index) => (
              <Card key={index} className="bg-card/50">
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <feature.icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-xs">{feature.title}</h3>
                    <p className="text-[11px] text-muted-foreground">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>

          {/* Detected Platform */}
          {isIOS && <IOSInstructions />}
          {isAndroid && <AndroidInstructions deferredPrompt={!!deferredPrompt} onInstall={onInstall} />}
          {!isIOS && !isAndroid && <DesktopInstructionsMobile onCopy={onCopy} copied={copied} />}

          {/* QR Code for desktop */}
          {(!isIOS && !isAndroid) && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}>
              <Card className="bg-muted/30">
                <CardContent className="p-5 text-center space-y-3">
                  <QrCode className="w-10 h-10 text-primary mx-auto" />
                  <h3 className="font-semibold text-foreground">Abra no celular</h3>
                  <p className="text-sm text-muted-foreground">
                    Aponte a câmera do celular para este QR Code:
                  </p>
                  <div className="flex justify-center">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin)}`}
                      alt="QR Code para acessar no celular"
                      className="w-48 h-48 rounded-xl border border-border"
                      loading="lazy"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ou acesse direto: <strong>{window.location.origin}</strong>
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </>
  );
}

function DesktopTab({
  features,
}: {
  features: { icon: typeof Monitor; title: string; description: string }[];
}) {
  return (
    <>
      {/* Features */}
      <motion.div
        initial={{ opacity: 1, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 gap-3"
      >
        {features.map((feature, index) => (
          <Card key={index} className="bg-card/50">
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <feature.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-xs">{feature.title}</h3>
                <p className="text-[11px] text-muted-foreground">{feature.description}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Card>
          <CardContent className="p-5 space-y-5">
            <div className="flex items-center gap-3">
              <Monitor className="w-6 h-6 text-primary" />
              <h2 className="font-bold text-foreground">Baixar para Computador</h2>
            </div>

            <p className="text-sm text-muted-foreground">
              Escolha seu sistema operacional e baixe o instalador:
            </p>

            <div className="space-y-3">
              {/* Windows */}
              <DownloadCard
                os="Windows"
                icon={<Laptop className="w-5 h-5 text-[#0078D4]" />}
                file="MechanicRaizPro-win32-x64.zip"
                instructions={[
                  "Baixe o arquivo .zip",
                  "Extraia a pasta em qualquer lugar do computador",
                  "Abra a pasta e clique em MechanicRaizPro.exe",
                ]}
              />

              {/* macOS */}
              <DownloadCard
                os="Mac (macOS)"
                icon={<Apple className="w-5 h-5" />}
                file="MechanicRaizPro-darwin-x64.zip"
                instructions={[
                  "Baixe o arquivo .zip",
                  "Extraia a pasta MechanicRaizPro.app",
                  "Arraste para a pasta Aplicações (Applications)",
                ]}
              />

              {/* Linux */}
              <DownloadCard
                os="Linux"
                icon={<Globe className="w-5 h-5 text-[#E95420]" />}
                file="MechanicRaizPro-linux-x64.tar.gz"
                instructions={[
                  "Baixe o arquivo .tar.gz",
                  "Extraia com: tar -xzf MechanicRaizPro-linux-x64.tar.gz",
                  "Execute: ./MechanicRaizPro/MechanicRaizPro",
                ]}
              />
            </div>

            <div className="bg-primary/5 rounded-lg p-3 text-xs text-muted-foreground flex items-start gap-2">
              <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
              <span>
                <strong>Dica:</strong> A versão desktop sincroniza automaticamente com seus dados na nuvem. Basta fazer login com a mesma conta do celular.
              </span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </>
  );
}

function DownloadCard({
  os,
  icon,
  file,
  instructions,
}: {
  os: string;
  icon: React.ReactNode;
  file: string;
  instructions: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 bg-card hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          {icon}
          <span className="font-semibold text-foreground">{os}</span>
        </div>
        <ChevronRight className={`w-5 h-5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
      </button>

      {open && (
        <div className="p-4 bg-muted/30 space-y-4 border-t border-border">
          <div className="space-y-2">
            {instructions.map((step, i) => (
              <Step key={i} number={i + 1}>
                <p className="text-sm text-foreground">{step}</p>
              </Step>
            ))}
          </div>
          <div className="bg-accent/10 rounded-lg p-3 text-xs text-muted-foreground">
            Solicite o arquivo de instalação para {os} ao suporte ou administrador do sistema.
          </div>
        </div>
      )}
    </div>
  );
}

function IOSInstructions() {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Apple className="w-6 h-6 text-primary" />
            <h2 className="font-bold text-foreground">Como instalar no iPhone</h2>
          </div>

          <div className="space-y-4">
            <Step number={1} icon={<Share className="w-5 h-5 text-primary" />}>
              <p className="text-sm text-foreground">
                Toque no botão <strong>Compartilhar</strong> na barra do Safari
              </p>
              <div className="mt-2 p-3 bg-muted rounded-lg flex items-center justify-center">
                <Share className="w-6 h-6 text-primary" />
              </div>
            </Step>

            <Step number={2} icon={<Plus className="w-5 h-5 text-primary" />}>
              <p className="text-sm text-foreground">
                Role para baixo e toque em <strong>"Adicionar à Tela de Início"</strong>
              </p>
              <div className="mt-2 p-3 bg-muted rounded-lg flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Adicionar à Tela de Início</span>
              </div>
            </Step>

            <Step number={3} check>
              <p className="text-sm text-foreground">
                Toque em <strong>"Adicionar"</strong> no canto superior direito. Pronto!
              </p>
            </Step>
          </div>

          <div className="bg-primary/5 rounded-lg p-3 text-xs text-muted-foreground">
            <strong>Dica:</strong> Depois de instalar, o ícone do app aparece na tela inicial e funciona igual um aplicativo.
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AndroidInstructions({
  deferredPrompt,
  onInstall,
}: {
  deferredPrompt: boolean;
  onInstall: () => void;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-3">
            <Smartphone className="w-6 h-6 text-primary" />
            <h2 className="font-bold text-foreground">Como instalar no Android</h2>
          </div>

          {deferredPrompt ? (
            <>
              <Button onClick={onInstall} className="w-full h-14 text-lg bg-gradient-to-r from-primary to-accent hover:opacity-90">
                <Download className="w-5 h-5 mr-2" />
                Instalar Agora
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Se não aparecer o botão acima, siga os passos abaixo:
              </p>
            </>
          ) : null}

          <div className="space-y-4">
            <Step number={1} icon={<MoreVertical className="w-5 h-5 text-primary" />}>
              <p className="text-sm text-foreground">
                Toque nos <strong>3 pontinhos</strong> no canto do navegador
              </p>
              <div className="mt-2 p-3 bg-muted rounded-lg flex items-center justify-center">
                <MoreVertical className="w-6 h-6 text-primary" />
              </div>
            </Step>

            <Step number={2} icon={<Download className="w-5 h-5 text-primary" />}>
              <p className="text-sm text-foreground">
                Toque em <strong>"Instalar app"</strong> ou <strong>"Adicionar à tela inicial"</strong>
              </p>
              <div className="mt-2 p-3 bg-muted rounded-lg flex items-center gap-2">
                <Download className="w-5 h-5 text-primary" />
                <span className="text-sm font-medium">Instalar app</span>
              </div>
            </Step>

            <Step number={3} check>
              <p className="text-sm text-foreground">
                Confirme a instalação e o ícone aparecerá na tela inicial
              </p>
            </Step>
          </div>

          <div className="bg-primary/5 rounded-lg p-3 text-xs text-muted-foreground">
            <strong>Dica:</strong> Em alguns celulares o menu pode se chamar "Adicionar à tela inicial" em vez de "Instalar app".
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function DesktopInstructionsMobile({ onCopy, copied }: { onCopy: () => void; copied: boolean }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
      <Card>
        <CardContent className="p-5 text-center space-y-3">
          <Smartphone className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-bold text-foreground mb-2">Acesse pelo celular</h2>
          <p className="text-sm text-muted-foreground">
            Para instalar o app, acesse este link pelo navegador do seu celular:
          </p>
          <div className="flex items-center gap-2 justify-center">
            <code className="bg-muted px-3 py-2 rounded-lg text-sm font-mono text-foreground">
              {window.location.origin}
            </code>
            <Button size="sm" variant="outline" onClick={onCopy} className="gap-1">
              {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Step({
  number,
  icon,
  check,
  children,
}: {
  number?: number;
  icon?: React.ReactNode;
  check?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
          check
            ? "bg-success/10 text-success"
            : "bg-primary/10 text-primary"
        }`}
      >
        {check ? <CheckCircle2 className="w-4 h-4" /> : icon || number}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}
