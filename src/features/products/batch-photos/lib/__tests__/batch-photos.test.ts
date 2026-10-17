import { describe, expect, it } from "vitest";
import {
  chunkPhotos,
  duplicatedAssignments,
  moveItem,
  sortPhotos,
  suggestAssignments,
} from "../batch-photos";

describe("fotos em lote", () => {
  it("ordena por data e, no empate, por nome natural", () => {
    const files = [
      { name: "foto 10.png", lastModified: 5 },
      { name: "foto 2.png", lastModified: 5 },
      { name: "a.png", lastModified: 1 },
    ];
    expect(sortPhotos(files).map((f) => f.name)).toEqual(["a.png", "foto 2.png", "foto 10.png"]);
  });

  it("agrupa de 3 em 3", () => {
    expect(chunkPhotos([1, 2, 3, 4, 5, 6, 7], 3)).toEqual([[1, 2, 3], [4, 5, 6], [7]]);
  });

  it("move fotos", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });

  it("sugere produtos sem foto pela ordem do cadastro", () => {
    const c = [
      { id: "p2", name: "B", created_at: "2026-10-17T10:00:00Z" },
      { id: "p1", name: "A", created_at: "2026-10-17T09:00:00Z" },
    ];
    expect(suggestAssignments(3, c)).toEqual(["p1", "p2", null]);
  });

  it("aponta produto repetido", () => {
    expect([...duplicatedAssignments(["a", "b", "a", null])]).toEqual(["a"]);
  });
});
