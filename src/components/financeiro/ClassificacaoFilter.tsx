import { Button } from "@/components/ui/button";
import { Building2, User, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface ClassificacaoFilterProps {
  value: "todos" | "empresa" | "pessoal";
  onChange: (value: "todos" | "empresa" | "pessoal") => void;
}

export function ClassificacaoFilter({ value, onChange }: ClassificacaoFilterProps) {
  return (
    <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange("todos")}
        className={cn(
          "h-8 px-3 gap-1.5",
          value === "todos" && "bg-background shadow-sm"
        )}
      >
        <Users className="w-4 h-4" />
        Todos
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange("empresa")}
        className={cn(
          "h-8 px-3 gap-1.5",
          value === "empresa" && "bg-background shadow-sm"
        )}
      >
        <Building2 className="w-4 h-4" />
        Empresa
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onChange("pessoal")}
        className={cn(
          "h-8 px-3 gap-1.5",
          value === "pessoal" && "bg-background shadow-sm"
        )}
      >
        <User className="w-4 h-4" />
        Pessoal
      </Button>
    </div>
  );
}
