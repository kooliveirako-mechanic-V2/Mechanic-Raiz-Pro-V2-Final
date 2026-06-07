import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useFuncionarios } from "@/hooks/useFuncionarios";
import { User, Crown, Shield, Wrench } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface ResponsavelSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  label?: string;
  placeholder?: string;
}

const roleIcons = {
  proprietario: Crown,
  administrador: Shield,
  funcionario: Wrench,
};

const roleLabels = {
  proprietario: "Proprietário",
  administrador: "Admin",
  funcionario: "Funcionário",
};

export function ResponsavelSelect({ 
  value, 
  onValueChange, 
  label = "Responsável",
  placeholder = "Selecione o responsável"
}: ResponsavelSelectProps) {
  const { funcionarios, isLoading } = useFuncionarios();

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className="h-11">
          <SelectValue placeholder={placeholder}>
            {value && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{funcionarios.find(f => f.user_id === value)?.nome || "Selecione"}</span>
              </div>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              <span>Sem responsável</span>
            </div>
          </SelectItem>
          {funcionarios.map((func) => {
            const RoleIcon = roleIcons[func.role] || Wrench;
            return (
              <SelectItem key={func.user_id} value={func.user_id}>
                <div className="flex items-center gap-2">
                  <RoleIcon className="w-4 h-4 text-muted-foreground" />
                  <span>{func.nome}</span>
                  <span className="text-xs text-muted-foreground">
                    ({roleLabels[func.role]})
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
    </div>
  );
}
