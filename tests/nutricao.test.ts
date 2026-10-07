import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { escaparLike, normalizarBusca, palavrasDaBusca } from "@/lib/busca";
import { rotuloDia, somarDias } from "@/lib/datas";
import {
  arredondar,
  calcularNutrientes,
  compararComMeta,
  formatarGramas,
  formatarKcal,
  gramasDaMedida,
  paraPor100g,
  somarDia,
} from "@/lib/nutricao";
import { converterCelula, extrairAlimentos } from "../scripts/importar-taco.mjs";

const arroz = { kcal: 128.26, proteinaG: 2.52, carboG: 28.06, gorduraG: 0.23, fibraG: 1.56 };

describe("cálculo de nutrientes", () => {
  it("proporcional às gramas", () => {
    expect(calcularNutrientes(arroz, 100)).toEqual({ kcal: 128.26, proteinaG: 2.52, carboG: 28.06, gorduraG: 0.23, fibraG: 1.56 });
    expect(calcularNutrientes(arroz, 150)).toEqual({ kcal: 192.39, proteinaG: 3.78, carboG: 42.09, gorduraG: 0.35, fibraG: 2.34 });
  });

  it("valor desconhecido continua desconhecido", () => {
    expect(calcularNutrientes({ ...arroz, fibraG: null }, 50)?.fibraG).toBeNull();
  });

  it("sem calorias ou com gramas inválidas não calcula", () => {
    expect(calcularNutrientes({ ...arroz, kcal: null }, 100)).toBeNull();
    expect(calcularNutrientes(arroz, 0)).toBeNull();
    expect(calcularNutrientes(arroz, -10)).toBeNull();
  });

  it("medida caseira × quantidade", () => {
    expect(gramasDaMedida(140, 1.5)).toBe(210);
    expect(gramasDaMedida(33.3, 3)).toBe(99.9);
  });

  it("rótulo: porção para 100 g", () => {
    expect(paraPor100g(120, 30)).toBe(400);
    expect(paraPor100g(2.5, 30)).toBe(8.33);
    expect(paraPor100g(null, 30)).toBeNull();
  });

  it("arredondamento sem erro de ponto flutuante", () => {
    expect(arredondar(1.005, 2)).toBe(1.01);
    expect(arredondar(0.1 + 0.2, 2)).toBe(0.3);
  });
});

describe("totais do dia", () => {
  it("soma e marca parcial quando falta valor", () => {
    const t = somarDia([
      { kcal: 100, proteinaG: 5, carboG: 10, gorduraG: 2, fibraG: 1 },
      { kcal: 50.5, proteinaG: 1.25, carboG: null, gorduraG: 0, fibraG: 0 },
    ]);
    expect(t.kcal).toBe(150.5);
    expect(t.proteinaG).toBe(6.25);
    expect(t.carboG).toBe(10);
    expect(t.parcial.carboG).toBe(true);
    expect(t.parcial.kcal).toBe(false);
  });

  it("dia vazio", () => {
    expect(somarDia([]).kcal).toBe(0);
  });

  it("comparação com a meta", () => {
    expect(compararComMeta(1500, 1800)).toEqual({ consumido: 1500, meta: 1800, restante: 300, percentual: 83 });
    expect(compararComMeta(1500, null).percentual).toBeNull();
  });

  it("formatação como a TACO", () => {
    expect(formatarKcal(123.5)).toBe("124");
    expect(formatarGramas(2.58)).toBe("2,6");
    expect(formatarGramas(null)).toBe("—");
  });
});

describe("busca", () => {
  it("normaliza acentos, maiúsculas e pontuação", () => {
    expect(normalizarBusca("Feijão, carioca, COZIDO")).toBe("feijao carioca cozido");
    expect(normalizarBusca("  Pão   francês ")).toBe("pao frances");
    expect(normalizarBusca("Açaí")).toBe("acai");
  });

  it("escapa curingas do LIKE", () => {
    expect(escaparLike("50%_x")).toBe("50\\%\\_x");
  });

  it("palavras limitadas a 6", () => {
    expect(palavrasDaBusca("a b c d e f g h")).toHaveLength(6);
  });
});

describe("datas do diário", () => {
  it("soma dias atravessando mês e ano", () => {
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("rótulos", () => {
    expect(rotuloDia("2026-10-07", "2026-10-07")).toBe("Hoje");
    expect(rotuloDia("2026-10-06", "2026-10-07")).toBe("Ontem");
    expect(rotuloDia("2026-10-05", "2026-10-07")).toBe("seg., 05/10/2026");
  });
});

describe("TACO: marcações (padrão FAO/INFOODS)", () => {
  it("converte cada marcação", () => {
    expect(converterCelula("Tr")).toEqual({ valor: 0, marca: "Tr" });
    expect(converterCelula("NA")).toEqual({ valor: 0, marca: "NA" });
    expect(converterCelula("*")).toEqual({ valor: null, marca: "*" });
    expect(converterCelula("")).toEqual({ valor: null, marca: "vazio" });
    expect(converterCelula("-2.6666666666666172E-2")).toEqual({ valor: 0, marca: "negativo" });
    expect(converterCelula("123.53489250000001")).toEqual({ valor: 123.53, marca: null });
    expect(() => converterCelula("abc")).toThrow();
  });

  it("planilha oficial: 597 alimentos válidos, 15 grupos", () => {
    const { alimentos, erros } = extrairAlimentos(readFileSync("dados/taco/Taco-4a-Edicao.xlsx"));
    expect(erros).toEqual([]);
    expect(alimentos).toHaveLength(597);
    expect(new Set(alimentos.map((a) => a.grupo)).size).toBe(15);
    const arrozIntegral = alimentos.find((a) => a.codigo === "1");
    expect(arrozIntegral?.nome).toBe("Arroz, integral, cozido");
    expect(arrozIntegral?.kcal).toBe(123.53);
    expect(alimentos.find((a) => a.codigo === "458")?.kcal).toBeNull(); // leite integral: "*"
    expect(alimentos.find((a) => a.codigo === "516")?.kcal).toBe(0); // sal: "NA"
  });
});
