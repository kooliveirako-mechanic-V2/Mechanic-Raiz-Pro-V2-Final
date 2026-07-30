import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Users, 
  UserPlus, 
  Crown, 
  Shield, 
  Wrench, 
  Trash2, 
  Mail,
  Loader2,
  UserX,
  Edit2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOficina } from "@/contexts/OficinaContext";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { toast } from "sonner";
import { getBaseUrl } from "@/utils/url";

interface TeamModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface TeamMember {
  user_id: string;
  nome: string;
  role: AppRole;
  email?: string;
}

const roleLabels: Record<AppRole, string> = {
  proprietario: "Proprietário",
  administrador: "Administrador",
  funcionario: "Funcionário",
};

const roleIcons: Record<AppRole, typeof Crown> = {
  proprietario: Crown,
  administrador: Shield,
  funcionario: Wrench,
};

const roleColors: Record<AppRole, string> = {
  proprietario: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  administrador: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  funcionario: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
};

export function TeamModal({ open, onOpenChange }: TeamModalProps) {
  const { oficinaAtual } = useOficina();
  const { isProprietario } = useUserRole();
  const queryClient = useQueryClient();
  
  const [showAddForm, setShowAddForm] = useState(false);
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<"administrador" | "funcionario">("funcionario");
  const [memberToRemove, setMemberToRemove] = useState<TeamMember | null>(null);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  // Fetch team members
  const { data: teamMembers = [], isLoading } = useQuery({
    queryKey: ["team-members", oficinaAtual?.id],
    queryFn: async () => {
      if (!oficinaAtual) return [];
      
      const { data, error } = await supabase
        .rpc("get_oficina_funcionarios", { _oficina_id: oficinaAtual.id });

      if (error) throw error;
      return (data || []) as TeamMember[];
    },
    enabled: !!oficinaAtual && open,
  });

  // Send invite by email (works whether user exists or not)
  const addMember = useMutation({
    mutationFn: async ({ email, role }: { email: string; role: "administrador" | "funcionario" }) => {
      if (!oficinaAtual) throw new Error("Oficina não selecionada");

      const { data, error } = await supabase.functions.invoke("send-team-invite", {
        body: {
          oficina_id: oficinaAtual.id,
          email: email.toLowerCase().trim(),
          role,
          base_url: getBaseUrl(),
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; invite_url: string; email_sent: boolean; user_exists: boolean };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
      setEmail("");
      setSelectedRole("funcionario");
      setShowAddForm(false);
      if (result.email_sent) {
        toast.success("Convite enviado por e-mail!", {
          description: "O funcionário receberá um link para entrar na equipe.",
        });
      } else {
        toast.success("Convite criado!", {
          description: `Compartilhe o link: ${result.invite_url}`,
          duration: 10000,
        });
      }
    },
    onError: (error: Error) => {
      console.error("Error sending invite:", error);
      toast.error(error.message);
    },
  });

  // Update role mutation
  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: "administrador" | "funcionario" }) => {
      if (!oficinaAtual) throw new Error("Oficina não selecionada");

      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId)
        .eq("oficina_id", oficinaAtual.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
      setEditingMember(null);
      toast.success("Cargo atualizado com sucesso!");
    },
    onError: (error) => {
      console.error("Error updating role:", error);
      toast.error("Erro ao atualizar cargo");
    },
  });

  // Remove member mutation
  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      if (!oficinaAtual) throw new Error("Oficina não selecionada");

      // Deactivate instead of delete for audit trail
      const { error } = await supabase
        .from("user_roles")
        .update({ 
          active: false,
          deactivated_at: new Date().toISOString()
        })
        .eq("user_id", userId)
        .eq("oficina_id", oficinaAtual.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      queryClient.invalidateQueries({ queryKey: ["funcionarios"] });
      setMemberToRemove(null);
      toast.success("Membro removido com sucesso!");
    },
    onError: (error) => {
      console.error("Error removing member:", error);
      toast.error("Erro ao remover membro");
    },
  });

  const handleAddMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Digite o e-mail do funcionário");
      return;
    }
    addMember.mutate({ email: email.trim(), role: selectedRole });
  };

  const proprietario = teamMembers.find(m => m.role === "proprietario");
  const otherMembers = teamMembers.filter(m => m.role !== "proprietario");

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              Equipe da Oficina
            </DialogTitle>
            <DialogDescription>
              Gerencie os funcionários e administradores que têm acesso ao sistema.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Permission Levels Explanation */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Níveis de Acesso:</p>
              <div className="space-y-1.5 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Crown className="w-4 h-4 text-amber-500" />
                  <span><strong>Proprietário:</strong> Acesso total, incluindo lucros e custos</span>
                </div>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-blue-500" />
                  <span><strong>Admin:</strong> Faturamento e gestão, sem ver lucros</span>
                </div>
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4 text-emerald-500" />
                  <span><strong>Funcionário:</strong> Apenas operacional, sem financeiro</span>
                </div>
              </div>
            </div>

            {/* Owner Section */}
            {proprietario && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-muted-foreground">Proprietário</h4>
                <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                  <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Crown className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-foreground">{proprietario.nome}</p>
                    <p className="text-sm text-muted-foreground">Controle total da oficina</p>
                  </div>
                  <Badge className={roleColors.proprietario}>
                    Proprietário
                  </Badge>
                </div>
              </div>
            )}

            {/* Team Members Section */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-muted-foreground">
                  Equipe ({otherMembers.length})
                </h4>
                {isProprietario && (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setShowAddForm(!showAddForm)}
                  >
                    <UserPlus className="w-4 h-4 mr-2" />
                    Adicionar
                  </Button>
                )}
              </div>

              {/* Add Member Form */}
              {showAddForm && isProprietario && (
                <form onSubmit={handleAddMember} className="p-4 rounded-lg border border-dashed border-primary/50 bg-primary/5 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">E-mail do funcionário</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="funcionario@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Enviaremos um convite por e-mail. Se ainda não tiver conta, ele cria na hora.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Select 
                      value={selectedRole} 
                      onValueChange={(val) => setSelectedRole(val as "administrador" | "funcionario")}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="administrador">
                          <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4 text-blue-500" />
                            Administrador
                          </div>
                        </SelectItem>
                        <SelectItem value="funcionario">
                          <div className="flex items-center gap-2">
                            <Wrench className="w-4 h-4 text-emerald-500" />
                            Funcionário
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => {
                        setShowAddForm(false);
                        setEmail("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      className="flex-1"
                      disabled={addMember.isPending}
                    >
                      {addMember.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        "Enviar convite"
                      )}
                    </Button>
                  </div>
                </form>
              )}

              {/* Members List */}
              {isLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : otherMembers.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-lg">
                  <UserX className="w-10 h-10 text-muted-foreground/50 mb-2" />
                  <p className="text-muted-foreground">Nenhum funcionário adicionado</p>
                  <p className="text-sm text-muted-foreground/70">
                    Adicione membros para sua equipe
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {otherMembers.map((member) => {
                    const RoleIcon = roleIcons[member.role];
                    const isEditing = editingMember?.user_id === member.user_id;

                    return (
                      <div 
                        key={member.user_id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
                      >
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          member.role === "administrador" ? "bg-blue-500/10" : "bg-emerald-500/10"
                        }`}>
                          <RoleIcon className={`w-5 h-5 ${
                            member.role === "administrador" ? "text-blue-500" : "text-emerald-500"
                          }`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{member.nome}</p>
                          {isEditing ? (
                            <Select 
                              value={member.role}
                              onValueChange={(val) => {
                                updateRole.mutate({ 
                                  userId: member.user_id, 
                                  newRole: val as "administrador" | "funcionario" 
                                });
                              }}
                            >
                              <SelectTrigger className="h-7 w-40 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="administrador">Administrador</SelectItem>
                                <SelectItem value="funcionario">Funcionário</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              {roleLabels[member.role]}
                            </p>
                          )}
                        </div>

                        {isProprietario && (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => setEditingMember(isEditing ? null : member)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setMemberToRemove(member)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover membro da equipe?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{memberToRemove?.nome}</strong> perderá acesso ao sistema imediatamente. 
              Esta ação pode ser revertida adicionando o membro novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => memberToRemove && removeMember.mutate(memberToRemove.user_id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMember.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Remover"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
