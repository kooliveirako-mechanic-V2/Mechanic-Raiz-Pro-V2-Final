import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Lock, User, Eye, EyeOff, Loader2, Phone } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { RegistrationHelpBubble } from "@/components/landing/RegistrationHelpBubble";
import { LegacyMigrationBanner } from "@/components/auth/LegacyMigrationBanner";

interface AuthFormTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  // Login
  loginEmail: string;
  onLoginEmailChange: (v: string) => void;
  loginPassword: string;
  onLoginPasswordChange: (v: string) => void;
  onLoginSubmit: (e: React.FormEvent) => void;
  // Register
  registerName: string;
  onRegisterNameChange: (v: string) => void;
  registerEmail: string;
  onRegisterEmailChange: (v: string) => void;
  registerPhone: string;
  onRegisterPhoneChange: (v: string) => void;
  registerPassword: string;
  onRegisterPasswordChange: (v: string) => void;
  onRegisterSubmit: (e: React.FormEvent) => void;
  // Shared
  loading: boolean;
  postResetMode?: boolean;
  showPassword: boolean;
  onTogglePassword: () => void;
  onForgotPassword: () => void;
  // Variant for size differences
  variant?: "mobile" | "tablet" | "desktop";
}

export function AuthFormTabs({
  activeTab,
  onTabChange,
  loginEmail,
  onLoginEmailChange,
  loginPassword,
  onLoginPasswordChange,
  onLoginSubmit,
  registerName,
  onRegisterNameChange,
  registerEmail,
  onRegisterEmailChange,
  registerPhone,
  onRegisterPhoneChange,
  registerPassword,
  onRegisterPasswordChange,
  onRegisterSubmit,
  loading,
  postResetMode = false,
  showPassword,
  onTogglePassword,
  onForgotPassword,
  variant = "desktop",
}: AuthFormTabsProps) {
  const isDesktop = variant === "desktop";
  const isTablet = variant === "tablet";
  const isMobile = variant === "mobile";

  const inputH = isTablet ? "h-11" : "h-12";
  const btnH = isTablet ? "h-12" : "h-14";
  const tabsH = isTablet ? "h-10" : isMobile ? "h-11" : "h-12";
  const spacing = isTablet ? "space-y-3" : "space-y-4";
  const regSpacing = isTablet ? "space-y-2.5" : isMobile ? "space-y-3" : "space-y-3";
  const labelSpacing = isTablet || isMobile ? "space-y-1.5" : "space-y-2";
  const regLabelSpacing = isTablet ? "space-y-1" : "space-y-1.5";
  const tabsMb = isDesktop ? "mb-6" : "mb-4";
  const focusColor = "focus:border-accent focus:ring-accent";
  const registerFocusColor = focusColor;

  const registerBtnText = isDesktop
    ? "Quero controlar minha oficina — 14 dias grátis"
    : "Começar 14 dias grátis";

  const idSuffix = isMobile ? "-mobile" : isTablet ? "-tablet" : "";

  return (
    <Tabs value={activeTab} onValueChange={onTabChange} className="w-full">
      {/* Aviso permanente para clientes da base legada */}
      <div className={tabsMb === "mb-6" ? "mb-4" : "mb-3"}>
        <LegacyMigrationBanner />
      </div>

      <TabsList className={`grid w-full grid-cols-2 ${tabsH} ${tabsMb} bg-muted border border-border rounded-lg`}>
        <TabsTrigger
          value="login"
          className="text-sm font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all rounded-md"
        >
          Entrar
        </TabsTrigger>
        <TabsTrigger
          value="register"
          className="text-sm font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-all rounded-md"
        >
          Cadastrar
        </TabsTrigger>
      </TabsList>

      {/* Login Tab */}
      <TabsContent value="login" className={`mt-0 ${spacing}`}>
        {/* Upsell Banner - only on login tab */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-primary rounded-xl p-3 shadow-lg shadow-primary/30"
        >
          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-lg">🎁</span>
            <p className="text-primary-foreground font-semibold text-sm text-center">
              {isMobile ? (
                <>Novo aqui? <span className="text-yellow-300 font-bold">Crie sua conta grátis</span>!</>
              ) : (
                <>Novo aqui? <span className="text-yellow-300 font-bold">14 DIAS GRÁTIS</span> para testar!</>
              )}
            </p>
            <button
              type="button"
              onClick={() => onTabChange("register")}
              className="bg-white/20 hover:bg-white/30 text-primary-foreground text-xs font-bold px-3 py-1 rounded-full transition-all"
            >
              Criar conta
            </button>
          </div>
        </motion.div>

        <form onSubmit={onLoginSubmit} className={spacing}>
          <div className={labelSpacing}>
            <Label htmlFor={`login-email${idSuffix}`} className="text-sm font-semibold text-foreground">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id={`login-email${idSuffix}`}
                type="email"
                placeholder="seu@email.com"
                value={loginEmail}
                onChange={(e) => onLoginEmailChange(e.target.value)}
                className={`pl-10 ${inputH} text-base bg-background border-border text-foreground placeholder:text-muted-foreground ${focusColor}`}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className={labelSpacing}>
            <Label htmlFor={`login-password${idSuffix}`} className="text-sm font-semibold text-foreground">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id={`login-password${idSuffix}`}
                type={showPassword ? "text" : "password"}
                key={postResetMode ? `post-reset-password${idSuffix}` : `login-password-blind${idSuffix}`}
                placeholder={postResetMode ? "Digite a NOVA senha" : "••••••••"}
                value={loginPassword}
                onChange={(e) => onLoginPasswordChange(e.target.value)}
                className={`pl-10 pr-10 ${inputH} text-base bg-background border-border text-foreground placeholder:text-muted-foreground ${focusColor}`}
                required
                autoComplete="off"
                data-1p-ignore="true"
                data-lpignore="true"
                data-form-type="other"
                name={postResetMode ? `mrp-pwd-${idSuffix}-${Date.now()}` : `mrp-pwd-${idSuffix}`}
              />
              <button
                type="button"
                onClick={onTogglePassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {postResetMode && (
            <p className="text-xs text-warning font-medium text-center -mt-1">
              Atenção: digite manualmente a nova senha. O navegador pode sugerir a antiga.
            </p>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-sm text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Esqueci minha senha
            </button>
          </div>

          <Button
            type="submit"
            className={`w-full ${btnH} bg-primary hover:bg-primary/90 text-primary-foreground text-base font-bold shadow-xl shadow-primary/30 hover:shadow-primary/40 transition-all hover:-translate-y-0.5`}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </Button>
        </form>
        <GoogleSignInButton />

        <div className="pt-2 text-center">
          <button
            type="button"
            onClick={() => {
              try {
                Object.keys(localStorage).forEach((k) => {
                  if (k.startsWith("sb-") || k.includes("supabase") || k.includes("mrp_") || k === "oficinaAtual") {
                    localStorage.removeItem(k);
                  }
                });
                Object.keys(sessionStorage).forEach((k) => {
                  if (k.startsWith("sb-") || k.includes("supabase") || k.includes("mrp_")) {
                    sessionStorage.removeItem(k);
                  }
                });
                if ("serviceWorker" in navigator) {
                  navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.unregister()));
                }
                if ("caches" in window) {
                  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)));
                }
                onLoginEmailChange("");
                onLoginPasswordChange("");
              } finally {
                setTimeout(() => window.location.reload(), 200);
              }
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Usar outra conta / limpar dados deste navegador
          </button>
        </div>
      </TabsContent>

      {/* Register Tab */}
      <TabsContent value="register" className={`mt-0 ${regSpacing}`}>
        {isMobile && activeTab === "register" && <RegistrationHelpBubble />}

        <form onSubmit={onRegisterSubmit} className={regSpacing}>
          <div className={regLabelSpacing}>
            <Label htmlFor={`register-name${idSuffix}`} className="text-sm font-semibold text-foreground">Nome</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id={`register-name${idSuffix}`}
                type="text"
                placeholder="Seu nome"
                value={registerName}
                onChange={(e) => onRegisterNameChange(e.target.value)}
                className={`pl-10 ${inputH} text-base bg-background border-border text-foreground placeholder:text-muted-foreground ${registerFocusColor}`}
                required
                autoComplete="name"
              />
            </div>
          </div>

          <div className={regLabelSpacing}>
            <Label htmlFor={`register-email${idSuffix}`} className="text-sm font-semibold text-foreground">E-mail</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id={`register-email${idSuffix}`}
                type="email"
                placeholder="seu@email.com"
                value={registerEmail}
                onChange={(e) => onRegisterEmailChange(e.target.value)}
                className={`pl-10 ${inputH} text-base bg-background border-border text-foreground placeholder:text-muted-foreground ${registerFocusColor}`}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className={regLabelSpacing}>
            <Label htmlFor={`register-phone${idSuffix}`} className="text-sm font-semibold text-foreground">WhatsApp <span className="text-muted-foreground font-normal">(opcional)</span></Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id={`register-phone${idSuffix}`}
                type="tel"
                placeholder="11999998888"
                value={registerPhone}
                onChange={(e) => onRegisterPhoneChange(e.target.value)}
                className={`pl-10 ${inputH} text-base bg-background border-border text-foreground placeholder:text-muted-foreground ${registerFocusColor}`}
                autoComplete="tel"
              />
            </div>
          </div>

          <div className={regLabelSpacing}>
            <Label htmlFor={`register-password${idSuffix}`} className="text-sm font-semibold text-foreground">Senha</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id={`register-password${idSuffix}`}
                type={showPassword ? "text" : "password"}
                placeholder="Mínimo 8 caracteres"
                value={registerPassword}
                onChange={(e) => onRegisterPasswordChange(e.target.value)}
                className={`pl-10 pr-10 ${inputH} text-base bg-background border-border text-foreground placeholder:text-muted-foreground ${registerFocusColor}`}
                required
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={onTogglePassword}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className={`w-full ${btnH} bg-accent hover:bg-accent/90 text-accent-foreground ${isDesktop ? "text-base" : "text-sm"} font-bold shadow-xl shadow-accent/30 hover:shadow-accent/40 transition-all hover:-translate-y-0.5 whitespace-normal leading-tight ${isMobile ? "active:scale-[0.98]" : ""}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Criando conta...
              </>
            ) : (
              registerBtnText
            )}
          </Button>
          {isMobile && (
            <p className="text-xs text-muted-foreground text-center">
              Sem cartão de crédito · Cancela quando quiser · Leva 2 minutos
            </p>
          )}
        </form>
        <GoogleSignInButton />
      </TabsContent>
    </Tabs>
  );
}
