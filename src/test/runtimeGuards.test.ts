import { describe, it, expect } from "vitest";
import {
  guardCreateOS,
  guardAddItemOS,
  guardCreateFinanceiro,
  guardCreateEstoque,
  guardCreateCliente,
  guardCreateVeiculo,
  guardOficina,
} from "@/lib/runtimeGuards";

describe("Runtime Guards — Regressão Crítica", () => {
  // ========================================
  // guardCreateOS
  // ========================================
  describe("guardCreateOS", () => {
    const valid = {
      oficina_id: "abc-123",
      cliente_id: "cli-456",
      veiculo_id: "vei-789",
      tipo_servico: "diagnostico",
    };

    it("aceita input válido sem lançar erro", () => {
      expect(() => guardCreateOS(valid)).not.toThrow();
    });

    it("rejeita oficina_id vazio", () => {
      expect(() => guardCreateOS({ ...valid, oficina_id: "" })).toThrow("[Guard] oficina_id");
    });

    it("rejeita cliente_id vazio", () => {
      expect(() => guardCreateOS({ ...valid, cliente_id: "" })).toThrow("[Guard] cliente_id");
    });

    it("rejeita veiculo_id vazio", () => {
      expect(() => guardCreateOS({ ...valid, veiculo_id: "" })).toThrow("[Guard] veiculo_id");
    });

    it("rejeita tipo_servico vazio", () => {
      expect(() => guardCreateOS({ ...valid, tipo_servico: "" })).toThrow("[Guard] tipo_servico");
    });

    it("rejeita strings só com espaços", () => {
      expect(() => guardCreateOS({ ...valid, oficina_id: "   " })).toThrow("[Guard] oficina_id");
      expect(() => guardCreateOS({ ...valid, cliente_id: "   " })).toThrow("[Guard] cliente_id");
    });
  });

  // ========================================
  // guardAddItemOS
  // ========================================
  describe("guardAddItemOS", () => {
    const valid = {
      ordem_servico_id: "os-123",
      nome_item: "Bateria 60A",
      quantidade: 2,
      valor_unitario: 350,
    };

    it("aceita input válido", () => {
      expect(() => guardAddItemOS(valid)).not.toThrow();
    });

    it("rejeita ordem_servico_id vazio", () => {
      expect(() => guardAddItemOS({ ...valid, ordem_servico_id: "" })).toThrow("[Guard] ordem_servico_id");
    });

    it("rejeita nome_item vazio", () => {
      expect(() => guardAddItemOS({ ...valid, nome_item: "" })).toThrow("[Guard] nome_item");
    });

    it("rejeita quantidade zero", () => {
      expect(() => guardAddItemOS({ ...valid, quantidade: 0 })).toThrow("[Guard] quantidade");
    });

    it("rejeita quantidade negativa", () => {
      expect(() => guardAddItemOS({ ...valid, quantidade: -1 })).toThrow("[Guard] quantidade");
    });

    it("rejeita valor_unitario negativo", () => {
      expect(() => guardAddItemOS({ ...valid, valor_unitario: -10 })).toThrow("[Guard] valor_unitario");
    });

    it("aceita valor_unitario zero (mão de obra sem custo de peça)", () => {
      expect(() => guardAddItemOS({ ...valid, valor_unitario: 0 })).not.toThrow();
    });
  });

  // ========================================
  // guardCreateFinanceiro
  // ========================================
  describe("guardCreateFinanceiro", () => {
    const valid = {
      oficina_id: "ofc-123",
      tipo: "entrada",
      origem: "os",
      valor: 500,
    };

    it("aceita input válido", () => {
      expect(() => guardCreateFinanceiro(valid)).not.toThrow();
    });

    it("rejeita tipo inválido", () => {
      expect(() => guardCreateFinanceiro({ ...valid, tipo: "credito" })).toThrow("[Guard] tipo financeiro");
    });

    it("rejeita valor zero", () => {
      expect(() => guardCreateFinanceiro({ ...valid, valor: 0 })).toThrow("[Guard] valor");
    });

    it("rejeita valor negativo", () => {
      expect(() => guardCreateFinanceiro({ ...valid, valor: -100 })).toThrow("[Guard] valor");
    });

    it("rejeita origem vazia", () => {
      expect(() => guardCreateFinanceiro({ ...valid, origem: "" })).toThrow("[Guard] origem");
    });
  });

  // ========================================
  // guardCreateEstoque
  // ========================================
  describe("guardCreateEstoque", () => {
    const valid = { oficina_id: "ofc-1", nome: "Bateria", categoria: "Elétrica" };

    it("aceita input válido", () => {
      expect(() => guardCreateEstoque(valid)).not.toThrow();
    });

    it("rejeita nome vazio", () => {
      expect(() => guardCreateEstoque({ ...valid, nome: "" })).toThrow("[Guard] nome");
    });

    it("rejeita categoria vazia", () => {
      expect(() => guardCreateEstoque({ ...valid, categoria: "" })).toThrow("[Guard] categoria");
    });
  });

  // ========================================
  // guardCreateCliente
  // ========================================
  describe("guardCreateCliente", () => {
    it("aceita input válido", () => {
      expect(() => guardCreateCliente({ oficina_id: "x", nome: "João" })).not.toThrow();
    });

    it("rejeita nome vazio", () => {
      expect(() => guardCreateCliente({ oficina_id: "x", nome: "" })).toThrow("[Guard] nome");
    });

    it("rejeita oficina_id vazio", () => {
      expect(() => guardCreateCliente({ oficina_id: "", nome: "João" })).toThrow("[Guard] oficina_id");
    });
  });

  // ========================================
  // guardCreateVeiculo
  // ========================================
  describe("guardCreateVeiculo", () => {
    const valid = {
      oficina_id: "ofc",
      cliente_id: "cli",
      marca: "Honda",
      modelo: "CG 160",
      tipo: "moto",
    };

    it("aceita input válido", () => {
      expect(() => guardCreateVeiculo(valid)).not.toThrow();
    });

    it("rejeita cliente_id vazio", () => {
      expect(() => guardCreateVeiculo({ ...valid, cliente_id: "" })).toThrow("[Guard] cliente_id");
    });

    it("rejeita marca vazia", () => {
      expect(() => guardCreateVeiculo({ ...valid, marca: "" })).toThrow("[Guard] marca");
    });

    it("rejeita modelo vazio", () => {
      expect(() => guardCreateVeiculo({ ...valid, modelo: "" })).toThrow("[Guard] modelo");
    });

    it("rejeita tipo vazio", () => {
      expect(() => guardCreateVeiculo({ ...valid, tipo: "" })).toThrow("[Guard] tipo");
    });
  });

  // ========================================
  // guardOficina
  // ========================================
  describe("guardOficina", () => {
    it("aceita string válida", () => {
      expect(() => guardOficina("abc", "test")).not.toThrow();
    });

    it("rejeita undefined", () => {
      expect(() => guardOficina(undefined, "test")).toThrow("[Guard]");
    });

    it("rejeita null", () => {
      expect(() => guardOficina(null, "test")).toThrow("[Guard]");
    });

    it("rejeita string vazia", () => {
      expect(() => guardOficina("", "test")).toThrow("[Guard]");
    });

    it("rejeita string só com espaços", () => {
      expect(() => guardOficina("   ", "test")).toThrow("[Guard]");
    });
  });
});
