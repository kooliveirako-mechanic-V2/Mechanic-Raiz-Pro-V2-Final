import { Shield, Cloud, Lock, Smartphone } from "lucide-react";

export function DataSecurityCard() {
  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
          <Shield className="w-5 h-5 text-success" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">🔒 Seus dados estão seguros</h3>
        </div>
      </div>
      <div className="space-y-2.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <Cloud className="w-4 h-4 text-success flex-shrink-0" />
          <span>Backup automático diário na nuvem</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Lock className="w-4 h-4 text-success flex-shrink-0" />
          <span>Dados criptografados e protegidos</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-success flex-shrink-0" />
          <span>Nenhuma informação é perdida</span>
        </div>
        <div className="flex items-center gap-2.5">
          <Smartphone className="w-4 h-4 text-success flex-shrink-0" />
          <span>Acesse de qualquer dispositivo a qualquer momento</span>
        </div>
      </div>
    </div>
  );
}
