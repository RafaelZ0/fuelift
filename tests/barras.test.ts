import { describe, expect, it } from "vitest";
import { cacheValido, conferirEnergia, destinoDoProduto, extrairProdutoOff, normalizarCodigo, problemasDeSanidade } from "@/lib/barras";

describe("código de barras", () => {
  it("aceita EAN-13, EAN-8 e UPC-A com dígito verificador correto", () => {
    expect(normalizarCodigo("7891000100103")).toBe("7891000100103");
    expect(normalizarCodigo("96385074")).toBe("96385074"); // EAN-8
    expect(normalizarCodigo("036000291452")).toBe("0036000291452"); // UPC-A vira EAN-13
    expect(normalizarCodigo(" 7891000100103 ")).toBe("7891000100103");
  });
  it.each([
    ["dígito errado", "7891000100104"],
    ["curto", "123456"],
    ["longo", "78910001001031"],
    ["letras", "78910001001ab"],
    ["vazio", ""],
    ["com espaço no meio", "789 1000100103"],
    ["injeção", "7891000100103'; drop table x;--"],
  ])("recusa %s", (_, codigo) => {
    expect(normalizarCodigo(codigo)).toBeNull();
  });
  it("recusa o que não é texto", () => {
    expect(normalizarCodigo(7891000100103)).toBeNull();
    expect(normalizarCodigo(null)).toBeNull();
    expect(normalizarCodigo(undefined)).toBeNull();
  });
});

const off = (nm: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
  code: "7891000100103",
  status: 1,
  product: { product_name: "Leite condensado", brands: "Nestlé, Moça", quantity: "395 g", serving_quantity: 20, nutriments: nm, ...extra },
});
const completo = { "energy-kcal_100g": 325, proteins_100g: 7, carbohydrates_100g: 55, fat_100g: 8, fiber_100g: 0, sodium_100g: 0.1 };

describe("resposta do Open Food Facts", () => {
  it("converte um produto completo para valores por 100 g", () => {
    const p = extrairProdutoOff(off(completo));
    expect(p).toMatchObject({ status: "encontrado", nome: "Leite condensado", marca: "Nestlé", quantidade: "395 g", porcaoG: 20, incompleto: false, suspeito: false });
    if (p.status === "encontrado") expect(p.nutrientes).toEqual({ kcal: 325, proteinaG: 7, carboG: 55, gorduraG: 8, fibraG: 0, sodioMg: 100 });
    expect(destinoDoProduto(p)).toBe("adicionar");
  });

  it("calcula calorias a partir de kJ quando faltam kcal", () => {
    const p = extrairProdutoOff(off({ ...completo, "energy-kcal_100g": undefined, "energy-kj_100g": 1360 }));
    if (p.status !== "encontrado") throw new Error("esperado produto");
    expect(p.nutrientes.kcal).toBeCloseTo(325.0, 0);
  });

  it("produto não encontrado ou sem nome", () => {
    expect(extrairProdutoOff({ code: "1", status: 0, status_verbose: "product not found" })).toEqual({ status: "nao_encontrado" });
    expect(extrairProdutoOff({ status: 1, product: { product_name: "   ", nutriments: completo } })).toEqual({ status: "nao_encontrado" });
    expect(extrairProdutoOff(null)).toEqual({ status: "nao_encontrado" });
    expect(extrairProdutoOff("lixo")).toEqual({ status: "nao_encontrado" });
  });

  it("sem calorias: cadastrar pelo rótulo; sem algum macro: conferir", () => {
    expect(destinoDoProduto(extrairProdutoOff(off({ proteins_100g: 3 })))).toBe("cadastrar");
    const p = extrairProdutoOff(off({ "energy-kcal_100g": 100, carbohydrates_100g: 20 }));
    expect(p).toMatchObject({ incompleto: true });
    expect(destinoDoProduto(p)).toBe("conferir");
  });

  it("valores absurdos são descartados e o produto fica suspeito", () => {
    const p = extrairProdutoOff(off({ ...completo, "energy-kcal_100g": 5000 }));
    if (p.status !== "encontrado") throw new Error("esperado produto");
    expect(p.nutrientes.kcal).toBeNull();
    expect(p.suspeito).toBe(true);
    expect(destinoDoProduto(p)).toBe("cadastrar");
  });

  it("calorias que não fecham com os macros deixam o produto suspeito (200 em vez de 20)", () => {
    const p = extrairProdutoOff(off({ "energy-kcal_100g": 200, proteins_100g: 1, carbohydrates_100g: 2, fat_100g: 0 }));
    if (p.status !== "encontrado") throw new Error("esperado produto");
    expect(p.suspeito).toBe(true);
    expect(destinoDoProduto(p)).toBe("conferir");
  });

  it("macros somando mais de 100 g é suspeito", () => {
    const p = extrairProdutoOff(off({ "energy-kcal_100g": 400, proteins_100g: 60, carbohydrates_100g: 60, fat_100g: 10 }));
    if (p.status !== "encontrado") throw new Error("esperado produto");
    expect(p.suspeito).toBe(true);
  });

  it("textos viram texto puro e curto; porção inválida vira nula", () => {
    const p = extrairProdutoOff(off(completo, { product_name: "<b>Bolo</b>\n\u0000 de cenoura " + "x".repeat(300), brands: "A".repeat(200), serving_quantity: -5 }));
    if (p.status !== "encontrado") throw new Error("esperado produto");
    expect(p.nome).not.toMatch(/[\n\u0000]/);
    expect(p.nome.length).toBeLessThanOrEqual(120);
    expect(p.marca!.length).toBeLessThanOrEqual(80);
    expect(p.porcaoG).toBeNull();
  });

  it("números como texto são aceitos, texto que não é número é ignorado", () => {
    const p = extrairProdutoOff(off({ ...completo, "energy-kcal_100g": "325", proteins_100g: "abc" }));
    if (p.status !== "encontrado") throw new Error("esperado produto");
    expect(p.nutrientes.kcal).toBe(325);
    expect(p.nutrientes.proteinaG).toBeNull();
    expect(p.incompleto).toBe(true);
  });
});

describe("conferência da conta do rótulo", () => {
  const n = (kcal: number | null, p: number | null, c: number | null, g: number | null) => ({ kcal, proteinaG: p, carboG: c, gorduraG: g, fibraG: null, sodioMg: null });
  it("fecha quando as calorias batem com 4/4/9", () => {
    expect(conferirEnergia(n(325, 7, 55, 8))).toMatchObject({ fecha: true, esperadas: 320 });
  });
  it("não fecha quando o número foi digitado errado", () => {
    expect(conferirEnergia(n(200, 1, 2, 0))).toMatchObject({ fecha: false, esperadas: 12 });
    expect(conferirEnergia(n(20, 10, 60, 20))).toMatchObject({ fecha: false });
  });
  it("tolera arredondamento e produtos pobres (água, café)", () => {
    expect(conferirEnergia(n(2, 0, 0, 0)).fecha).toBe(true);
    expect(conferirEnergia(n(0, 0, 0, 0)).fecha).toBe(true);
  });
  it("sem os três macros não dá para conferir", () => {
    expect(conferirEnergia(n(100, null, 10, 2))).toEqual({ fecha: true, esperadas: null, diferenca: null });
  });
  it("limites físicos", () => {
    expect(problemasDeSanidade(n(325, 7, 55, 8))).toEqual([]);
    expect(problemasDeSanidade(n(950, 1, 1, 1))).toHaveLength(1);
    expect(problemasDeSanidade(n(500, 60, 60, 10))[0]).toMatch(/passam de 100/);
    expect(problemasDeSanidade(n(300, -1, 10, 10))[0]).toMatch(/Proteína/);
  });
});

describe("validade do cache", () => {
  const agora = new Date("2026-10-10T12:00:00Z");
  const dias = (n: number) => new Date(agora.getTime() - n * 86_400_000);
  it("produto achado vale 30 dias; não encontrado, 1 dia", () => {
    expect(cacheValido("encontrado", dias(29), agora)).toBe(true);
    expect(cacheValido("encontrado", dias(31), agora)).toBe(false);
    expect(cacheValido("nao_encontrado", dias(0.5), agora)).toBe(true);
    expect(cacheValido("nao_encontrado", dias(2), agora)).toBe(false);
  });
  it("tolera pequena diferença de relógio, mas não datas muito no futuro", () => {
    expect(cacheValido("encontrado", new Date(agora.getTime() + 5 * 60_000), agora)).toBe(true);
    expect(cacheValido("encontrado", new Date(agora.getTime() + 3 * 3_600_000), agora)).toBe(false);
  });
});
