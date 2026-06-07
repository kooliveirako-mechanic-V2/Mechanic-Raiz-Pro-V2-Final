import { describe, it, expect } from "vitest";
import { formatCurrency, formatPhone, parseCurrency, formatPlate } from "@/lib/formatters";

describe("formatters — Regressão de Formatação", () => {
  describe("formatCurrency", () => {
    it("formata valor positivo corretamente", () => {
      const result = formatCurrency(1500.5);
      expect(result).toContain("1.500");
    });

    it("formata zero", () => {
      const result = formatCurrency(0);
      expect(result).toContain("0");
    });

    it("formata valor negativo", () => {
      const result = formatCurrency(-250);
      expect(result).toContain("250");
    });
  });

  describe("parseCurrency", () => {
    it("converte string BR para número", () => {
      expect(parseCurrency("R$ 1.500,50")).toBe(1500.5);
    });

    it("converte valor com separador de milhar", () => {
      expect(parseCurrency("R$ 12.345,67")).toBe(12345.67);
    });

    it("converte valor simples sem milhar", () => {
      expect(parseCurrency("150,50")).toBe(150.5);
    });

    it("converte valor inteiro", () => {
      expect(parseCurrency("R$ 500")).toBe(500);
    });

    it("converte decimal com ponto vindo de cálculo interno", () => {
      expect(parseCurrency("150.00")).toBe(150);
    });

    it("converte milhar com ponto sem casas decimais", () => {
      expect(parseCurrency("1.500")).toBe(1500);
    });

    it("retorna 0 para string vazia", () => {
      expect(parseCurrency("")).toBe(0);
    });

    it("retorna 0 para lixo", () => {
      expect(parseCurrency("abc")).toBe(0);
    });
  });

  describe("formatPhone", () => {
    it("formata telefone com DDD", () => {
      const result = formatPhone("11999887766");
      expect(result).toBe("(11) 99988-7766");
    });

    it("retorna vazio para input vazio", () => {
      expect(formatPhone("")).toBe("");
    });
  });

  describe("formatPlate", () => {
    it("formata placa para uppercase", () => {
      expect(formatPlate("abc1d23")).toBe("ABC1D23");
    });

    it("remove caracteres especiais", () => {
      expect(formatPlate("ABC-1D23")).toBe("ABC1D23");
    });

    it("limita a 7 caracteres", () => {
      expect(formatPlate("ABCDEFGH123")).toHaveLength(7);
    });
  });
});
