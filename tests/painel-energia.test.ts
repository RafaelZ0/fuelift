import { describe, expect, it } from "vitest";
import { deficitAcumulado, montarPainelEnergia, periodoValido, type EntradaPainel } from "@/lib/painel-energia";

const dia = (n: number) => new Date(Date.UTC(2026, 8, 1 + n)).toISOString().slice(0, 10);
const HOJE = dia(27);
const perfil = { sexo: "masculino" as const, idadeAnos: 35, alturaCm: 178, nivel: "moderado" as const, ritmoMaxPct: 1 };
const pesagens = (peso: (i: number) => number) => Array.from({ length: 14 }, (_, k) => ({ data: dia(k * 2), peso: peso(k * 2), massaMagraKg: null }));
const consumo = (kcal: number) => Array.from({ length: 28 }, (_, i) => ({ data: dia(i), kcal }));

const base = (extra: Partial<EntradaPainel> = {}): EntradaPainel => ({
  hoje: HOJE,
  perfil,
  pesagens: pesagens(() => 90),
  consumo: consumo(2300),
  meta: { kcal: 2100, pesoMetaKg: 80, dataMeta: null },
  ...extra,
});

describe("painel de energia", () => {
  it("sem dados do perfil, diz o que falta e não inventa números", () => {
    const p = montarPainelEnergia(base({ perfil: { ...perfil, sexo: null, alturaCm: null, nivel: null, idadeAnos: null } }));
    expect(p.faltam).toEqual(["sexo", "nascimento", "altura", "atividade"]);
    expect(p.gasto).toBeNull();
    expect(p.planejamento).toBeNull();
  });
  it("sem pesagem, pede o peso", () => {
    const p = montarPainelEnergia(base({ pesagens: [] }));
    expect(p.faltam).toContain("peso");
    expect(p.gasto).toBeNull();
  });
  it("com dados completos mostra gasto adaptativo, previsão da meta e opções", () => {
    const p = montarPainelEnergia(base());
    expect(p.faltam).toEqual([]);
    expect(p.gasto?.metodo).toBe("adaptativo");
    expect(p.gasto!.minimo).toBeLessThan(p.gasto!.maximo);
    expect(p.consumoMedio7d).toEqual({ kcal: 2300, dias: 7 });
    expect(p.previsaoDaMeta?.texto).toMatch(/2\.100 kcal/);
    expect(p.planejamento?.opcoes.length).toBeGreaterThan(0);
    expect(p.macrosSugeridos).not.toBeNull();
    expect(p.projecaoReal).not.toBeNull();
  });
  it("previsão da meta: perder, manter e ganhar", () => {
    const base2 = montarPainelEnergia(base());
    const gasto = base2.gasto!.valor;
    const perde = montarPainelEnergia(base({ meta: { kcal: gasto - 500, pesoMetaKg: 80, dataMeta: null } }));
    expect(perde.previsaoDaMeta?.texto).toMatch(/perder cerca de/);
    const mantem = montarPainelEnergia(base({ meta: { kcal: gasto, pesoMetaKg: null, dataMeta: null } }));
    expect(mantem.previsaoDaMeta?.texto).toMatch(/manter o peso/);
    const ganha = montarPainelEnergia(base({ meta: { kcal: gasto + 500, pesoMetaKg: null, dataMeta: null } }));
    expect(ganha.previsaoDaMeta?.texto).toMatch(/ganhar cerca de/);
  });
  it("poucos dias de registro: usa fórmula e explica", () => {
    const p = montarPainelEnergia(base({ consumo: consumo(2300).slice(-5) }));
    expect(p.gasto?.metodo).toBe("mifflin_st_jeor");
    expect(p.gasto?.explicacao).toMatch(/Faltam registros/);
    expect(p.consumoMedio7d?.dias).toBe(5);
  });
  it("sem meta de peso não há planejamento", () => {
    const p = montarPainelEnergia(base({ meta: { kcal: 2000, pesoMetaKg: null, dataMeta: null } }));
    expect(p.planejamento).toBeNull();
    expect(p.previsaoDaMeta).not.toBeNull();
  });
  it("meta abaixo do IMC saudável bloqueia as sugestões", () => {
    const p = montarPainelEnergia(base({ meta: { kcal: 2000, pesoMetaKg: 50, dataMeta: null } }));
    expect(p.planejamento?.opcoes).toEqual([]);
    expect(p.planejamento?.avisos.some((a) => a.nivel === "bloqueio")).toBe(true);
    expect(p.macrosSugeridos).toBeNull();
  });
});

describe("gráficos: período e déficit", () => {
  it("período inválido volta para 3 meses", () => {
    expect(periodoValido("4s")).toBe("4s");
    expect(periodoValido("tudo")).toBe("tudo");
    expect(periodoValido("1ano")).toBe("3m");
    expect(periodoValido(undefined)).toBe("3m");
  });
  it("déficit acumulado soma gasto − consumo e ignora dias sem registro completo", () => {
    const r = deficitAcumulado(
      [
        { data: "2026-10-01", kcal: 2000 },
        { data: "2026-10-02", kcal: null },
        { data: "2026-10-03", kcal: 300 },
        { data: "2026-10-04", kcal: 2200 },
      ],
      2500,
    );
    expect(r.map((x) => x.deficit)).toEqual([500, 800]);
    expect(r[1].perdaEsperadaKg).toBeCloseTo(800 / 7700, 2);
  });
});
