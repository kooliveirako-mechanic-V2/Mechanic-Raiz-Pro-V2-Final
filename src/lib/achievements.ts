import { supabase } from "@/integrations/supabase/client";

// Marcos de conquista que disparam email
const ACHIEVEMENT_MILESTONES = [10, 25, 50, 100, 250, 500, 1000];

type AchievementType = 'estoque' | 'clientes' | 'veiculos' | 'ordens_servico';

/**
 * Verifica se a quantidade atual é um marco de conquista e dispara o email automaticamente
 * Dispara em background para não bloquear a operação principal
 */
export async function checkAndSendAchievement(
  oficinaId: string,
  tipo: AchievementType,
  quantidadeAtual: number
): Promise<void> {
  // Verificar se é um marco
  if (!ACHIEVEMENT_MILESTONES.includes(quantidadeAtual)) {
    return;
  }

  console.log(`🏆 Marco atingido: ${quantidadeAtual} ${tipo}! Disparando email...`);

  try {
    // Dispara em background - não bloqueia a UI
    supabase.functions.invoke('send-achievement-email', {
      body: {
        oficina_id: oficinaId,
        tipo,
        quantidade_atual: quantidadeAtual,
      },
    }).then(({ data, error }) => {
      if (error) {
        console.error('Erro ao enviar email de conquista:', error);
      } else {
        console.log('✅ Email de conquista disparado:', data);
      }
    });
  } catch (error) {
    // Silenciosamente ignora erros para não impactar o fluxo principal
    console.error('Erro ao verificar conquista:', error);
  }
}

/**
 * Conta itens de uma tabela para uma oficina
 */
export async function getTableCount(
  table: 'estoque' | 'clientes' | 'veiculos' | 'ordens_servico',
  oficinaId: string
): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .eq('oficina_id', oficinaId);

  if (error) {
    console.error(`Erro ao contar ${table}:`, error);
    return 0;
  }

  return count || 0;
}
