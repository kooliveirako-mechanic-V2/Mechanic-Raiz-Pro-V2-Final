import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useState, useEffect } from "react";
import { useModalClose } from "@/hooks/useModalClose";

/**
 * Testa o CICLO do hook (não só o comparador): snapshot pós-hidratação,
 * confirmação ao fechar sujo, e o caso que suspeito estar quebrado — form que
 * hidrata do servidor um render DEPOIS da abertura.
 */
describe("useModalClose — ciclo", () => {
  it("abre limpo e fecha sem confirmar quando nada mudou", () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() =>
      useModalClose({ open: true, data: { nome: "" }, onOpenChange })
    );
    act(() => result.current.handleOpenChange(false));
    expect(result.current.confirmOpen).toBe(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("segura o fechamento quando sujo", () => {
    const onOpenChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ data }) => useModalClose({ open: true, data, onOpenChange }),
      { initialProps: { data: { nome: "" } } }
    );
    rerender({ data: { nome: "Silva" } }); // usuário digitou
    act(() => result.current.handleOpenChange(false));
    expect(result.current.confirmOpen).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("REGRESSÃO: form que hidrata 1 render depois NÃO nasce sujo", () => {
    // Simula o padrão de OficinaForm/CatalogoServico/DadosFiscais:
    // abre com dados vazios; a prop do servidor chega no render seguinte.
    const onOpenChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ data, ready }) =>
        useModalClose({ open: true, data, onOpenChange, snapshotReady: ready }),
      { initialProps: { data: { nome: "" }, ready: false } }
    );
    // servidor respondeu: dados chegam E snapshotReady vira true no mesmo render
    rerender({ data: { nome: "Oficina X" }, ready: true });
    // usuário não tocou em nada; fechar não pode pedir confirmação
    act(() => result.current.handleOpenChange(false));
    expect(result.current.confirmOpen).toBe(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("CONTRATO: snapshotReady=true com hidratação por useEffect => nasce SUJO (por isso o caller precisa sinalizar)", () => {
    // Reproduz CatalogoServicoFormModal em modo edição: snapshotReady é true
    // desde o início (prop síncrona), mas a hidratação real acontece num
    // useEffect que roda DEPOIS do primeiro render. Se o snapshot for capturado
    // no render 1 (dados vazios) e a hidratação preencher no render 2, o form
    // nasce sujo mesmo sem o usuário tocar em nada.
    // Simulação FIEL: o estado e o efeito de hidratação vivem no MESMO
    // componente que chama o hook, como nos formulários reais. Assim o setState
    // da hidratação e o do hook são agrupados no mesmo tick pelo React — o que
    // um `rerender` manual não reproduz.
    const onOpenChange = vi.fn();
    const { result } = renderHook(() => {
      const [nome, setNome] = useState("");
      useEffect(() => {
        setNome("Serviço Existente"); // hidratação (equivale a setNome(servico?.nome))
      }, []);
      return useModalClose({
        open: true,
        data: { nome },
        onOpenChange,
        snapshotReady: true,
      });
    });
    // DOCUMENTA A LIMITAÇÃO: com snapshotReady=true desde a montagem, o snapshot
    // pega os campos vazios do 1º render e a hidratação vira "edição". O hook não
    // consegue distinguir hidratação de digitação — quem sabe é o caller.
    // Por isso o contrato é: form que hidrata por useEffect DEVE passar
    // snapshotReady=false até a hidratação terminar (ver CatalogoServicoFormModal).
    act(() => result.current.handleOpenChange(false));
    expect(result.current.confirmOpen).toBe(true); // falso-sujo, como esperado
  });

  it("CONTRATO CUMPRIDO: hidratação por useEffect + snapshotReady sinalizado => NÃO nasce sujo", () => {
    const onOpenChange = vi.fn();
    const { result } = renderHook(() => {
      const [nome, setNome] = useState("");
      const [hydrated, setHydrated] = useState(false);
      useEffect(() => {
        setNome("Serviço Existente"); // hidratação
        setHydrated(true);            // ...e o sinal, no mesmo tick
      }, []);
      return useModalClose({
        open: true,
        data: { nome },
        onOpenChange,
        snapshotReady: hydrated,
      });
    });
    act(() => result.current.handleOpenChange(false));
    expect(result.current.confirmOpen).toBe(false);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("depois de hidratar, edição real é detectada como suja", () => {
    const onOpenChange = vi.fn();
    const { result, rerender } = renderHook(
      ({ data, ready }) =>
        useModalClose({ open: true, data, onOpenChange, snapshotReady: ready }),
      { initialProps: { data: { nome: "" }, ready: false } }
    );
    rerender({ data: { nome: "Oficina X" }, ready: true }); // hidratou
    rerender({ data: { nome: "Oficina X Editada" }, ready: true }); // usuário editou
    act(() => result.current.handleOpenChange(false));
    expect(result.current.confirmOpen).toBe(true);
  });
});
