import { describe, it, expect } from "vitest";
import { humanizeError } from "@/lib/errorHandling";

describe("humanizeError — Regressão de Tratamento de Erros", () => {
  it("converte erro genérico em mensagem legível", () => {
    const result = humanizeError(new Error("Algo deu errado"));
    expect(result).toHaveProperty("message");
    expect(typeof result.message).toBe("string");
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("converte erro de Guard em mensagem legível", () => {
    const result = humanizeError(new Error("[Guard] oficina_id ausente ao criar OS — sessão inválida"));
    expect(result.message).toBeTruthy();
  });

  it("converte string em mensagem legível", () => {
    const result = humanizeError("Network error");
    expect(result).toHaveProperty("message");
  });

  it("lida com objeto de erro do Supabase", () => {
    const supabaseError = { message: "Row level security violation", code: "42501" };
    const result = humanizeError(supabaseError);
    expect(result).toHaveProperty("message");
  });

  it("lida com null/undefined sem quebrar", () => {
    expect(() => humanizeError(null as any)).not.toThrow();
    expect(() => humanizeError(undefined as any)).not.toThrow();
  });
});
