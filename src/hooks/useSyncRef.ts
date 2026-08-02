import { useEffect, type MutableRefObject } from "react";

/**
 * Sincroniza um ref JÁ EXISTENTE com um valor derivado do render.
 *
 * Item E — extraído do wiring inline do OrdemServicoFormModal (anyChildOpenRef).
 * O risco que motivou isto: quando a sincronização era um useEffect solto no
 * componente, apagá-la deixava os testes da função pura shouldBlockParentClose
 * verdes e o furo voltava sem ninguém perceber. Como hook próprio, o wiring
 * vira uma unidade testável: se a sincronização quebrar, o teste deste hook
 * fica vermelho.
 *
 * Recebe um ref externo (e não retorna outro) porque no OrdemServicoFormModal o
 * ref é criado cedo — usado por isChildCloseEcho — enquanto os states que o
 * alimentam só existem bem depois. Sincronizar um ref existente respeita essa
 * ordem sem reorganizar o componente.
 */
export function useSyncRef<T>(ref: MutableRefObject<T>, value: T): void {
  useEffect(() => {
    ref.current = value;
  }, [ref, value]);
}
