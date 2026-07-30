import { describe, it, expect } from "vitest";
import { toFotoPath } from "@/lib/storage/fotos";

describe("toFotoPath — extração de path do bucket os-fotos", () => {
  it("retorna path relativo de OS inalterado", () => {
    expect(toFotoPath("a15cdcd8-7d38-4e57-9d14-29d60ae82527/entrada-1777432404894-x.jpg")).toBe(
      "a15cdcd8-7d38-4e57-9d14-29d60ae82527/entrada-1777432404894-x.jpg"
    );
  });

  it("retorna path relativo temp/ inalterado", () => {
    expect(toFotoPath("temp/1777774400997-llxd1a.jpg")).toBe("temp/1777774400997-llxd1a.jpg");
  });

  it("extrai path de URL pública legada (host NOVO)", () => {
    const url =
      "https://kurlgmngmglhvknwxjee.supabase.co/storage/v1/object/public/os-fotos/uuid-os/entrada-1.jpg";
    expect(toFotoPath(url)).toBe("uuid-os/entrada-1.jpg");
  });

  it("extrai path de URL pública legada (host ANTIGO)", () => {
    const url =
      "https://cuhkkoqqeguascdsvtky.supabase.co/storage/v1/object/public/os-fotos/uuid-os/saida-2.jpg";
    expect(toFotoPath(url)).toBe("uuid-os/saida-2.jpg");
  });

  it("extrai path de URL assinada legada, descartando o token", () => {
    const url =
      "https://x.supabase.co/storage/v1/object/sign/os-fotos/uuid-os/foto.jpg?token=abc.def.ghi";
    expect(toFotoPath(url)).toBe("uuid-os/foto.jpg");
  });

  it("decodifica caracteres percent-encoded no path", () => {
    const url =
      "https://x.supabase.co/storage/v1/object/public/os-fotos/uuid-os/foto%20com%20espaco.jpg";
    expect(toFotoPath(url)).toBe("uuid-os/foto com espaco.jpg");
  });

  it("remove barras iniciais de path relativo", () => {
    expect(toFotoPath("/uuid-os/foto.jpg")).toBe("uuid-os/foto.jpg");
  });

  it("rejeita blob: (preview local)", () => {
    expect(toFotoPath("blob:https://app/abc-123")).toBeNull();
  });

  it("rejeita data: URI", () => {
    // data: não casa http/https nem é path do bucket; cai no ramo relativo,
    // mas não deve ser tratado como path — validado no getSignedFotoUrl.
    expect(toFotoPath("blob:data")).toBeNull();
  });

  it("rejeita path com traversal (..)", () => {
    expect(toFotoPath("../outra-oficina/segredo.jpg")).toBeNull();
    expect(toFotoPath("uuid/../../etc.jpg")).toBeNull();
  });

  it("rejeita URL externa que não é do bucket os-fotos", () => {
    expect(toFotoPath("https://x.supabase.co/storage/v1/object/public/outro-bucket/f.jpg")).toBeNull();
    expect(toFotoPath("https://exemplo.com/foto.jpg")).toBeNull();
  });

  it("retorna null para vazio/nulo/undefined", () => {
    expect(toFotoPath("")).toBeNull();
    expect(toFotoPath("   ")).toBeNull();
    expect(toFotoPath(null)).toBeNull();
    expect(toFotoPath(undefined)).toBeNull();
  });
});
