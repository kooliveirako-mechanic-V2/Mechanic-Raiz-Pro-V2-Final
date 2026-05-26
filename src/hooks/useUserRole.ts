import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useOficina } from "@/contexts/OficinaContext";

export type AppRole = "proprietario" | "administrador" | "funcionario";

export function useUserRole() {
  const { user } = useAuth();
  const { oficinaAtual } = useOficina();

  const { data: role, isLoading } = useQuery({
    queryKey: ["user-role", user?.id, oficinaAtual?.id],
    queryFn: async () => {
      if (!user || !oficinaAtual) return null;

      // Check if user is owner (proprietário)
      if (oficinaAtual.user_id === user.id) {
        return "proprietario" as AppRole;
      }

      // Check user_roles table for other roles
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("oficina_id", oficinaAtual.id)
        .single();

      if (error || !data) {
        return null;
      }

      return data.role as AppRole;
    },
    enabled: !!user && !!oficinaAtual,
  });

  const isProprietario = role === "proprietario";
  const isAdministrador = role === "administrador" || isProprietario;
  // isFuncionario = tem QUALQUER role ativa (funcionário, admin ou proprietário)
  const isFuncionario = !!role;

  // Permissions
  const canManageUsers = isProprietario;
  const canManageSettings = isAdministrador;
  
  // Financial visibility permissions
  const canViewFinanceiro = isAdministrador; // Acesso ao menu financeiro
  const canViewFaturamento = isAdministrador; // Ver faturamento/receita
  const canViewLucro = isProprietario; // Só proprietário vê lucro/margem
  const canViewCustos = isProprietario; // Só proprietário vê custos de compra
  
  const canEditData = isFuncionario;

  return {
    role,
    isLoading,
    isProprietario,
    isAdministrador,
    isFuncionario,
    canManageUsers,
    canManageSettings,
    canViewFinanceiro,
    canViewFaturamento,
    canViewLucro,
    canViewCustos,
    canEditData,
  };
}
