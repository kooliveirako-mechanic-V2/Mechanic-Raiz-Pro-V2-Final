import { describe, it, expect } from "vitest";
import { isEqualForDirty } from "@/hooks/useModalClose";

/**
 * Prova das 3 condições contra FALSO-SUJO (docs/AUDITORIA-MODAIS-2026.md §7.1).
 * A condição 1 (snapshot pós-carga) e a 2 (ignoreKeys) são estruturais do hook;
 * aqui se prova a 3 (equivalência de vazios) e a detecção real de mudança.
 */
describe("isEqualForDirty — condição 3: vazios equivalentes", () => {
  it("trata '', null e undefined como o mesmo valor", () => {
    expect(isEqualForDirty("", null)).toBe(true);
    expect(isEqualForDirty("", undefined)).toBe(true);
    expect(isEqualForDirty(null, undefined)).toBe(true);
    expect(isEqualForDirty(undefined, "")).toBe(true);
  });

  it("campo que nasce undefined e o React vira '' NÃO conta como sujo", () => {
    const snapshot = { descricao: undefined, valor: "" };
    const atual = { descricao: "", valor: "" };
    expect(isEqualForDirty(atual, snapshot)).toBe(true);
  });
});

describe("isEqualForDirty — detecta mudança real", () => {
  it("valor digitado conta como sujo", () => {
    expect(isEqualForDirty({ valor: "150" }, { valor: "" })).toBe(false);
  });

  it("apagar o que estava preenchido conta como sujo", () => {
    expect(isEqualForDirty({ descricao: "" }, { descricao: "Óleo" })).toBe(false);
  });

  it("0 NÃO é vazio — zero é valor digitado", () => {
    expect(isEqualForDirty(0, "")).toBe(false);
    expect(isEqualForDirty(0, null)).toBe(false);
  });

  it("false NÃO é vazio", () => {
    expect(isEqualForDirty(false, undefined)).toBe(false);
  });

  it("boolean alterado conta como sujo", () => {
    expect(isEqualForDirty({ recorrente: true }, { recorrente: false })).toBe(false);
  });
});

describe("isEqualForDirty — estruturas aninhadas", () => {
  it("item adicionado à lista conta como sujo", () => {
    expect(isEqualForDirty({ itens: [{ id: 1 }] }, { itens: [] })).toBe(false);
  });

  it("lista igual não conta como sujo", () => {
    expect(isEqualForDirty({ itens: [{ id: 1 }] }, { itens: [{ id: 1 }] })).toBe(true);
  });

  it("campo aninhado alterado conta como sujo", () => {
    expect(
      isEqualForDirty({ end: { rua: "B" } }, { end: { rua: "A" } })
    ).toBe(false);
  });

  it("vazio aninhado equivale a ausente", () => {
    expect(isEqualForDirty({ end: { rua: "" } }, { end: { rua: null } })).toBe(true);
  });
});

describe("isEqualForDirty — cenário real do FinanceiroPreFiscalModal", () => {
  const inicial = {
    tipo: "entrada",
    valor: "",
    descricao: "",
    categoriaId: "",
    status: "pago",
    classificacao: "empresa",
    recorrente: false,
  };

  it("(a) abriu e fechou sem digitar → NÃO sujo (fecha calado)", () => {
    expect(isEqualForDirty({ ...inicial }, inicial)).toBe(true);
  });

  it("(b) digitou valor → sujo (pede confirmação)", () => {
    expect(isEqualForDirty({ ...inicial, valor: "1500" }, inicial)).toBe(false);
  });

  it("mudou só o tipo de lançamento → sujo", () => {
    expect(isEqualForDirty({ ...inicial, tipo: "saida" }, inicial)).toBe(false);
  });
});
