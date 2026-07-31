import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Fechamento de modal com confirmação quando o formulário está SUJO.
 *
 * Substitui o padrão `onOpenChange={onOpenChange}` (repasse direto ao pai), que
 * fecha o modal em silêncio e descarta o que o usuário digitou. Ver
 * docs/AUDITORIA-MODAIS-2026.md §0 e §7.1.
 *
 * O MESMO `handleOpenChange` deve ir no branch mobile (Drawer) E no desktop
 * (Dialog). É isso que impede a assimetria de comportamento entre os dois —
 * por construção, não por disciplina.
 *
 * ---------------------------------------------------------------------------
 * DETECÇÃO DE SUJO: SNAPSHOT, não campo-a-campo
 * ---------------------------------------------------------------------------
 * Um snapshot do `data` é capturado quando o modal abre; ao fechar, compara-se o
 * `data` atual contra ele. Só pergunta se mudou de fato.
 *
 * As 3 condições obrigatórias contra FALSO-SUJO (um aviso que aparece sempre é
 * um aviso que o usuário aprende a dispensar sem ler — pior que não ter aviso):
 *
 *   1. O snapshot é tirado DEPOIS que os dados de edição carregam. Use
 *      `snapshotReady` para segurar a captura enquanto o fetch não voltou.
 *      Sem isso, todo modal de edição abre "sujo" (snapshot vazio × dados
 *      preenchidos) e pergunta a quem só abriu e fechou.
 *   2. Campos voláteis ficam FORA da comparação, via `ignoreKeys`: timestamps,
 *      IDs gerados, flags de UI, defaults preenchidos na montagem e valores
 *      auto-preenchidos por seleção (ex.: veículo que muda ao escolher cliente).
 *   3. `""`, `null` e `undefined` são equivalentes. Campo que nasce `undefined`
 *      e o React normaliza para `""` produziria sujeira falsa.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ `onReset` NÃO PODE CHAMAR `onOpenChange(true)`
 * ---------------------------------------------------------------------------
 * `onReset` roda no caminho de fechamento. Se ele reabrir o modal, o próximo
 * fechamento cai no mesmo caminho e o ciclo não termina. Use-o apenas para
 * limpar estado local (campos, arquivo selecionado, passo do wizard).
 */

interface UseModalCloseOptions<T extends Record<string, unknown>> {
  /** Estado atual do modal (vem do pai). */
  open: boolean;
  /** Objeto de dados do formulário — o mesmo passado ao `useAutoSave`. */
  data: T;
  /** Callback do pai para abrir/fechar. */
  onOpenChange: (open: boolean) => void;
  /** Limpa o estado local. NÃO pode chamar `onOpenChange(true)`. */
  onReset?: () => void;
  /**
   * Condição 2 — chaves voláteis excluídas da comparação.
   * Tipado como `(keyof T)[]`: chave inexistente é erro de COMPILAÇÃO.
   * Em runtime há uma checagem extra (ver `invalidIgnoreKeys` abaixo) para o
   * caso de `T` frouxo (`Record<string, unknown>`, `any`) onde o compilador
   * não consegue barrar.
   */
  ignoreKeys?: (keyof T)[];
  /**
   * Condição 1 — só captura o snapshot quando os dados já carregaram.
   * Default `true` (formulário de criação, sem fetch).
   */
  snapshotReady?: boolean;
  /**
   * `false` desliga a confirmação e o modal fecha direto. Usado quando ainda
   * não há nada a perder — ex.: modal de importação recém-aberto, sem arquivo
   * selecionado nem colunas mapeadas.
   */
  enabled?: boolean;
}

interface UseModalCloseResult {
  /** Vai no `onOpenChange` do Drawer E do Dialog. */
  handleOpenChange: (open: boolean) => void;
  /** Controla o `ConfirmDialog` de "sair sem salvar?". */
  confirmOpen: boolean;
  setConfirmOpen: (v: boolean) => void;
  /** Confirma a saída: reseta e fecha. */
  confirmClose: () => void;
  /** `true` se o `data` divergiu do snapshot. */
  isDirty: boolean;
}

/** Condição 3: `""`, `null` e `undefined` contam como o mesmo valor. */
function isBlank(v: unknown): boolean {
  return v === "" || v === null || v === undefined;
}

/**
 * Igualdade estrutural com as regras do falso-sujo. Arrays e objetos são
 * comparados recursivamente — um item adicionado à lista conta como sujo.
 */
export function isEqualForDirty(a: unknown, b: unknown): boolean {
  if (isBlank(a) && isBlank(b)) return true;
  if (a === b) return true;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    return a.every((item, i) => isEqualForDirty(item, b[i]));
  }

  if (typeof a === "object" && typeof b === "object" && a !== null && b !== null) {
    const ka = Object.keys(a as Record<string, unknown>);
    const kb = Object.keys(b as Record<string, unknown>);
    const keys = new Set([...ka, ...kb]);
    for (const k of keys) {
      if (
        !isEqualForDirty(
          (a as Record<string, unknown>)[k],
          (b as Record<string, unknown>)[k]
        )
      ) {
        return false;
      }
    }
    return true;
  }

  return false;
}

/** Remove as chaves voláteis antes de comparar (condição 2). */
function stripIgnored<T extends Record<string, unknown>>(
  data: T,
  ignoreKeys: (keyof T)[]
): Partial<T> {
  if (ignoreKeys.length === 0) return data;
  const out: Partial<T> = {};
  for (const k of Object.keys(data) as (keyof T)[]) {
    if (!ignoreKeys.includes(k)) out[k] = data[k];
  }
  return out;
}

export function useModalClose<T extends Record<string, unknown>>({
  open,
  data,
  onOpenChange,
  onReset,
  ignoreKeys = [],
  snapshotReady = true,
  enabled = true,
}: UseModalCloseOptions<T>): UseModalCloseResult {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const snapshotRef = useRef<Partial<T> | null>(null);

  // Refs para não recriar handlers a cada tecla digitada.
  const dataRef = useRef(data);
  dataRef.current = data;

  const ignoreRef = useRef(ignoreKeys);
  ignoreRef.current = ignoreKeys;

  /**
   * Reforço de runtime para `ignoreKeys`. O tipo `(keyof T)[]` já barra chave
   * inexistente em compilação, mas quando `T` é frouxo (ou a lista vem de fonte
   * dinâmica) o compilador não ajuda — então avisa em dev.
   */
  const invalidIgnoreKeys = useMemo(() => {
    if (!open) return [];
    const present = new Set(Object.keys(data));
    return ignoreKeys.filter((k) => !present.has(String(k)));
  }, [open, data, ignoreKeys]);

  useEffect(() => {
    if (invalidIgnoreKeys.length > 0 && import.meta.env.DEV) {
      console.warn(
        "[useModalClose] ignoreKeys inexistentes em `data`:",
        invalidIgnoreKeys.map(String).join(", "),
        "— chave errada não exclui nada e pode causar falso-sujo."
      );
    }
  }, [invalidIgnoreKeys]);

  // Condição 1: captura só quando aberto E com os dados já carregados.
  useEffect(() => {
    if (!open) {
      snapshotRef.current = null;
      return;
    }
    if (!snapshotReady) return;
    if (snapshotRef.current !== null) return; // já capturado nesta abertura
    snapshotRef.current = stripIgnored(dataRef.current, ignoreRef.current);
  }, [open, snapshotReady]);

  const isDirty = useMemo(() => {
    if (!open || !enabled) return false;
    const snap = snapshotRef.current;
    if (snap === null) return false; // sem snapshot ainda → nunca sujo
    return !isEqualForDirty(stripIgnored(data, ignoreKeys), snap);
  }, [open, enabled, data, ignoreKeys]);

  const closeNow = useCallback(() => {
    snapshotRef.current = null;
    onReset?.();
    onOpenChange(false);
  }, [onReset, onOpenChange]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (next) {
        onOpenChange(true);
        return;
      }
      if (!enabled) {
        closeNow();
        return;
      }
      const snap = snapshotRef.current;
      const dirty =
        snap !== null &&
        !isEqualForDirty(stripIgnored(dataRef.current, ignoreRef.current), snap);

      if (dirty) {
        setConfirmOpen(true); // segura o fechamento até o usuário decidir
        return;
      }
      closeNow();
    },
    [enabled, closeNow]
  );

  const confirmClose = useCallback(() => {
    setConfirmOpen(false);
    closeNow();
  }, [closeNow]);

  return { handleOpenChange, confirmOpen, setConfirmOpen, confirmClose, isDirty };
}
