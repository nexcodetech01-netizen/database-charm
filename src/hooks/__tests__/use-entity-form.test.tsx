/**
 * useEntityForm — regressão do "Maximum update depth exceeded".
 *
 * Corrigido em 2026-08-12: a primeira versão do fix de categoria/unidade
 * não fixando (ver git history) retornava um `setForm` recriado a cada
 * render, quebrando a estabilidade referencial que o `setState` nativo do
 * React sempre garante. Componentes que usavam `setForm` em array de
 * dependências (ex.: ProductForm → useFiscalAutofill.onApply) entravam em
 * loop infinito de atualização assim que a tela de editar produto abria.
 */
import { describe, it, expect, vi } from "vitest";
import { render, act } from "@testing-library/react";
import { useEntityForm } from "../use-entity-form";

type Entity = { id: string; updated_at?: string | null; name: string };

function Harness({
  entity,
  onRender,
}: {
  entity: Entity | null;
  onRender: (setForm: unknown, form: unknown) => void;
}) {
  const [form, setForm] = useEntityForm(entity, (e) => ({
    name: e?.name ?? "",
  }));
  onRender(setForm, form);
  return null;
}

describe("useEntityForm", () => {
  it("setForm mantém a mesma identidade entre renders (regressão do loop infinito)", () => {
    const renders: unknown[] = [];
    const entity: Entity = { id: "p1", updated_at: "2026-01-01", name: "Produto A" };
    const { rerender } = render(
      <Harness entity={entity} onRender={(setForm) => renders.push(setForm)} />,
    );
    // Força mais renders sem trocar id/updated_at (mesmo cenário de um
    // componente pai re-renderizando por qualquer outro motivo).
    rerender(<Harness entity={entity} onRender={(setForm) => renders.push(setForm)} />);
    rerender(<Harness entity={entity} onRender={(setForm) => renders.push(setForm)} />);

    expect(renders.length).toBeGreaterThanOrEqual(3);
    expect(renders[0]).toBe(renders[1]);
    expect(renders[1]).toBe(renders[2]);
  });

  it("não sobrescreve edição em andamento quando updated_at muda em segundo plano", () => {
    let latestForm: any;
    let latestSetForm: any;
    const onRender = (setForm: unknown, form: unknown) => {
      latestSetForm = setForm;
      latestForm = form;
    };

    const entity: Entity = { id: "p1", updated_at: "2026-01-01", name: "Produto A" };
    const { rerender } = render(<Harness entity={entity} onRender={onRender} />);

    // Usuário edita localmente.
    act(() => {
      latestSetForm((s: any) => ({ ...s, name: "Editado pelo usuário" }));
    });
    expect(latestForm.name).toBe("Editado pelo usuário");

    // Refetch em segundo plano muda updated_at, mas o nome no servidor
    // continua o antigo ("Produto A") — não deve sobrescrever a edição.
    const refetched: Entity = { ...entity, updated_at: "2026-01-02" };
    rerender(<Harness entity={refetched} onRender={onRender} />);
    expect(latestForm.name).toBe("Editado pelo usuário");
  });

  it("resincroniza ao trocar de entidade (id diferente)", () => {
    let latestForm: any;
    let latestSetForm: any;
    const onRender = (setForm: unknown, form: unknown) => {
      latestSetForm = setForm;
      latestForm = form;
    };

    const entityA: Entity = { id: "p1", updated_at: "2026-01-01", name: "Produto A" };
    const { rerender } = render(<Harness entity={entityA} onRender={onRender} />);

    act(() => {
      latestSetForm((s: any) => ({ ...s, name: "Editado pelo usuário" }));
    });
    expect(latestForm.name).toBe("Editado pelo usuário");

    const entityB: Entity = { id: "p2", updated_at: "2026-01-01", name: "Produto B" };
    rerender(<Harness entity={entityB} onRender={onRender} />);
    expect(latestForm.name).toBe("Produto B");
  });
});
