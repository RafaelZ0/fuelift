import { describe, expect, it } from "vitest";
import { calcularReceita, type IngredienteReceita } from "@/lib/receita";

const ing = (nome: string, gramas: number, kcal: number | null, p: number | null, c: number | null, g: number | null, f: number | null = 0): IngredienteReceita => ({
  nome,
  gramas,
  nutrientes: { kcal, proteinaG: p, carboG: c, gorduraG: g, fibraG: f },
});

const bolo = [ing("Farinha de trigo", 300, 1092, 30, 228, 3, 9), ing("Ovo", 150, 215, 18, 1, 15, 0), ing("Açúcar", 200, 774, 0, 200, 0, 0), ing("Óleo", 100, 884, 0, 0, 100, 0)];

describe("receita", () => {
  it("soma ingredientes e divide por porção e por 100 g", () => {
    const r = calcularReceita({ ingredientes: bolo, porcoes: 10, pesoFinalG: 750 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.totais.kcal).toBe(2965);
    expect(r.pesoFinalG).toBe(750);
    expect(r.por100g.kcal).toBeCloseTo((2965 / 750) * 100, 2);
    expect(r.porPorcao.gramas).toBe(75);
    expect(r.porPorcao.kcal).toBeCloseTo(2965 / 10, 1);
    expect(r.porPorcao.proteinaG).toBeCloseTo(4.8, 1);
  });
  it("sem peso final usa a soma dos ingredientes", () => {
    const r = calcularReceita({ ingredientes: [ing("Arroz cozido", 200, 256, 5, 56, 0.4, 1.6), ing("Feijão cozido", 100, 76, 4.8, 13.6, 0.5, 8.5)], porcoes: 2, pesoFinalG: null });
    expect(r.ok && r.pesoFinalG).toBe(300);
    expect(r.ok && r.porPorcao.gramas).toBe(150);
  });
  it("nutriente desconhecido deixa o total parcial, sem virar zero escondido", () => {
    const r = calcularReceita({ ingredientes: [ing("A", 100, 100, 5, 10, 2, null), ing("B", 100, 200, null, 20, 4, 1)], porcoes: 1, pesoFinalG: null });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.parcial).toEqual({ proteinaG: true, carboG: false, gorduraG: false, fibraG: true });
  });
  it("ingrediente sem calorias é recusado, pelo nome", () => {
    const r = calcularReceita({ ingredientes: [ing("Sal", 5, null, null, null, null)], porcoes: 1, pesoFinalG: null });
    expect(r).toEqual({ ok: false, erro: '"Sal" está sem calorias na tabela. Troque o ingrediente.' });
  });
  it.each([
    ["sem ingredientes", { ingredientes: [], porcoes: 1, pesoFinalG: null }],
    ["porções zero", { ingredientes: bolo, porcoes: 0, pesoFinalG: null }],
    ["porções demais", { ingredientes: bolo, porcoes: 500, pesoFinalG: null }],
    ["peso final zero", { ingredientes: bolo, porcoes: 4, pesoFinalG: 0 }],
    ["peso final absurdo", { ingredientes: bolo, porcoes: 4, pesoFinalG: 90000 }],
  ])("recusa %s", (_, args) => {
    expect(calcularReceita(args).ok).toBe(false);
  });
  it("recusa o que viraria alimento impossível (peso final pequeno demais)", () => {
    const r = calcularReceita({ ingredientes: bolo, porcoes: 4, pesoFinalG: 100 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.erro).toMatch(/900 kcal|100 g|peso final/i);
  });
  it("limite de 40 ingredientes", () => {
    const muitos = Array.from({ length: 41 }, (_, i) => ing(`Item ${i}`, 10, 10, 1, 1, 0));
    expect(calcularReceita({ ingredientes: muitos, porcoes: 4, pesoFinalG: null }).ok).toBe(false);
  });
});
