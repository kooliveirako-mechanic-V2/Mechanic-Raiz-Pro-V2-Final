import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { useRef, type MutableRefObject } from "react";
import { useSyncRef } from "@/hooks/useSyncRef";

/**
 * Item E — rede para o wiring do Item B.
 *
 * O furo que este teste fecha: quando a sincronização do anyChildOpenRef era um
 * useEffect solto no OrdemServicoFormModal, apagá-la deixava os testes da função
 * pura shouldBlockParentClose verdes — o furo voltava sem detecção. Extraído
 * para useSyncRef, o wiring vira unidade testável: se a sincronização quebrar,
 * ESTE teste fica vermelho.
 *
 * Prova de dentes (mutação, no relatório): remover o corpo do useEffect em
 * useSyncRef.ts faz o caso "reflete o valor após atualização" falhar.
 */

function Harness({ value, refOut }: { value: boolean; refOut: MutableRefObject<boolean> }) {
  useSyncRef(refOut, value);
  return null;
}

describe("useSyncRef — sincronização de ref (wiring do guard do OS)", () => {
  it("reflete o valor inicial após montar", () => {
    const ref = { current: false } as MutableRefObject<boolean>;
    render(<Harness value={true} refOut={ref} />);
    expect(ref.current).toBe(true);
  });

  it("reflete a atualização do valor após rerender", () => {
    const ref = { current: false } as MutableRefObject<boolean>;
    const { rerender } = render(<Harness value={false} refOut={ref} />);
    expect(ref.current).toBe(false);

    rerender(<Harness value={true} refOut={ref} />);
    expect(ref.current).toBe(true);

    rerender(<Harness value={false} refOut={ref} />);
    expect(ref.current).toBe(false);
  });

  it("integração com useRef real do componente", () => {
    let captured: boolean | null = null;
    function Real({ v }: { v: boolean }) {
      const r = useRef(false);
      useSyncRef(r, v);
      captured = r.current;
      return null;
    }
    const { rerender } = render(<Real v={true} />);
    rerender(<Real v={true} />);
    expect(captured).toBe(true);
  });
});
