import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizarBusca } from "@/lib/busca";
import { alimentoPrincipal, filtrarSugestoes, preparosDoNome, type CandidatoIbge } from "@/lib/medidas-ibge";
import { adicionarSchema } from "@/lib/validacao/comida";
import { extrairMedidas } from "../scripts/importar-ibge.mjs";

let n = 0;
const c = (refAlimento: string, medida: string, gramas: number, semelhanca = 0.5): CandidatoIbge => ({
  id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
  refAlimento,
  medida,
  gramas,
  nomeBusca: normalizarBusca(refAlimento),
  semelhanca,
});

describe("sugestões de medidas do IBGE", () => {
  it("alimento principal e preparos", () => {
    expect(alimentoPrincipal("Pão, trigo, francês")).toBe("pao");
    expect(alimentoPrincipal("Maçã, Fuji, com casca, crua")).toBe("maca");
    expect([...preparosDoNome("feijao carioca cozido")]).toEqual(["cozid"]);
    expect([...preparosDoNome("banana prata crua")]).toEqual(["cru"]);
  });

  it("exige o mesmo alimento principal como palavra inteira", () => {
    const s = filtrarSugestoes("Maçã, Fuji, com casca, crua", [c("Maçã", "unidade média", 150), c("Macarrão a bolonhesa", "pegador", 110)]);
    expect(s.map((x) => x.refAlimento)).toEqual(["Maçã"]);
    const leite = filtrarSugestoes("Leite, de vaca, integral", [c("Doce de leite", "colher de sopa", 20), c("Leite de vaca integral pó", "colher de sopa cheia", 16)]);
    expect(leite.map((x) => x.refAlimento)).toEqual(["Leite de vaca integral pó"]);
  });

  it("descarta preparo diferente", () => {
    const s = filtrarSugestoes("Arroz, tipo 1, cozido", [c("Arroz cozido", "colher de arroz cheia", 45), c("Arroz cru", "xícara", 180), c("Arroz frito", "colher", 30)]);
    expect(s.map((x) => x.refAlimento)).toEqual(["Arroz cozido"]);
  });

  it("descarta semelhança baixa, ordena e não repete a mesma medida", () => {
    const s = filtrarSugestoes("Pão, trigo, francês", [
      c("Pão de milho", "unidade", 70, 0.25),
      c("Pão francês", "unidade", 50, 0.6),
      c("Pão careca", "coió", 38, 0.1),
    ]);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ refAlimento: "Pão francês", gramas: 50 });
  });

  it("limita a quantidade de sugestões", () => {
    const muitos = Array.from({ length: 20 }, (_, i) => c("Queijo minas", `medida ${i}`, 10 + i));
    expect(filtrarSugestoes("Queijo, minas, frescal", muitos)).toHaveLength(8);
  });

  it("CSV oficial: 605 medidas únicas, sem grama/quilo", () => {
    const { medidas, linhasDados, erros } = extrairMedidas(readFileSync("dados/ibge/tabela-medidas-referidas-pof2008.csv", "utf8"));
    expect(erros).toEqual([]);
    expect(linhasDados).toBe(11801);
    expect(medidas).toHaveLength(605);
    expect(medidas.find((m) => m.ref_alimento === "Pão francês" && m.medida === "unidade")?.gramas).toBe(50);
    expect(medidas.some((m) => /^(grama|quilo)/i.test(m.medida))).toBe(false);
  });

  it("validação: origem da medida só pode ser minha ou ibge", () => {
    const base = { data: "2026-01-10", refeicao: "almoco", tipo: "base", alimentoId: "0f8fad5b-d9cb-469f-a165-70867728950e" };
    const medida = { modo: "medida", medidaId: "0f8fad5b-d9cb-469f-a165-70867728950e", quantidade: "1" };
    expect(adicionarSchema.safeParse({ ...base, quantidade: { ...medida, origemMedida: "ibge" } }).success).toBe(true);
    expect(adicionarSchema.safeParse({ ...base, quantidade: { ...medida, origemMedida: "outra" } }).success).toBe(false);
  });
});
