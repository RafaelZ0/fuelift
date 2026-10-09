import { describe, expect, it } from "vitest";
import { ADAPTATIVO, FATORES_ATIVIDADE, gastoAdaptativo, gastoParaExibir, gastoPorFormula, massaMagraValida, tmbKatch, tmbMifflin, type DiaConsumo, type PesagemDia } from "@/lib/energia";
import {
  avisoDeMetaDigitada,
  dividirMacros,
  gastoNoPeso,
  imc,
  marcos,
  planejarMeta,
  projetarPeso,
  RITMO_MAX_PADRAO_PCT,
  ritmoSemanalKg,
  type EntradaPlano,
} from "@/lib/projecao";

describe("gasto por fórmula", () => {
  it("Mifflin-St Jeor para homem e mulher", () => {
    expect(tmbMifflin({ sexo: "masculino", pesoKg: 80, alturaCm: 175, idadeAnos: 30 })).toBeCloseTo(1748.75, 2);
    expect(tmbMifflin({ sexo: "feminino", pesoKg: 60, alturaCm: 165, idadeAnos: 30 })).toBeCloseTo(1320.25, 2);
  });
  it("Katch-McArdle com massa magra", () => {
    expect(tmbKatch(60)).toBeCloseTo(1666, 5);
  });
  it("usa Katch com massa magra válida e Mifflin sem ela", () => {
    const base = { sexo: "masculino" as const, idadeAnos: 30, alturaCm: 175, pesoKg: 80, nivel: "moderado" as const };
    const k = gastoPorFormula({ ...base, massaMagraKg: 60 });
    expect(k).toMatchObject({ metodo: "katch_mcardle", tmb: 1666, fator: 1.55, gasto: Math.round(1666 * 1.55) });
    const m = gastoPorFormula({ ...base, massaMagraKg: null });
    expect(m).toMatchObject({ metodo: "mifflin_st_jeor", tmb: 1749, gasto: Math.round(1748.75 * 1.55) });
  });
  it("massa magra implausível é ignorada", () => {
    expect(massaMagraValida(4, 80)).toBe(false);
    expect(massaMagraValida(80, 80)).toBe(false);
    expect(massaMagraValida(null, 80)).toBe(false);
    expect(massaMagraValida(60, 80)).toBe(true);
  });
  it("fatores de atividade crescem", () => {
    const v = Object.values(FATORES_ATIVIDADE);
    expect([...v].sort((a, b) => a - b)).toEqual(v);
  });
});

const dia = (n: number) => new Date(Date.UTC(2026, 8, 1 + n)).toISOString().slice(0, 10); // 2026-09-01 + n
const HOJE = dia(27);
const consumo = (kcal: number | null, n = 28): DiaConsumo[] => Array.from({ length: n }, (_, i) => ({ data: dia(i), kcal }));
const pesagens = (f: (i: number) => number, passo = 2, n = 28): PesagemDia[] => Array.from({ length: Math.ceil(n / passo) }, (_, k) => ({ data: dia(k * passo), peso: f(k * passo) }));

describe("gasto adaptativo", () => {
  it("peso estável: o gasto fica perto do consumo médio", () => {
    const r = gastoAdaptativo({ consumo: consumo(2200), pesagens: pesagens(() => 80), hoje: HOJE, gastoFormula: 2400 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.gasto.valor).toBe(2200);
      expect(r.gasto.minimo).toBeLessThan(r.gasto.valor);
      expect(r.gasto.maximo).toBeGreaterThan(r.gasto.valor);
      expect(r.gasto.diasUsados).toBe(28);
    }
  });
  it("perdendo peso com o mesmo consumo, o gasto estimado é maior que o consumo", () => {
    const r = gastoAdaptativo({ consumo: consumo(2000), pesagens: pesagens((i) => 80 - i * 0.05), hoje: HOJE, gastoFormula: 2500 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.gasto.valor).toBeGreaterThan(2000);
  });
  it("ganhando peso, o gasto estimado é menor que o consumo", () => {
    const r = gastoAdaptativo({ consumo: consumo(2500), pesagens: pesagens((i) => 80 + i * 0.05), hoje: HOJE, gastoFormula: 2400 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.gasto.valor).toBeLessThan(2500);
  });
  it("poucos dias de registro: explica o motivo", () => {
    const poucos = consumo(2000, 28).map((d, i) => (i < 10 ? d : { ...d, kcal: null }));
    const r = gastoAdaptativo({ consumo: poucos, pesagens: pesagens(() => 80), hoje: HOJE, gastoFormula: 2400 });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.motivo).toMatch(/Faltam registros/);
  });
  it("dias com menos de 800 kcal não contam como registro completo", () => {
    const r = gastoAdaptativo({ consumo: consumo(ADAPTATIVO.kcalMinimaDoDia - 1), pesagens: pesagens(() => 80), hoje: HOJE, gastoFormula: 2400 });
    expect(r.ok).toBe(false);
  });
  it("poucas pesagens ou muito curtas", () => {
    const poucas = gastoAdaptativo({ consumo: consumo(2000), pesagens: pesagens(() => 80, 7), hoje: HOJE, gastoFormula: 2400 });
    expect(poucas.ok).toBe(false);
    const curtas = gastoAdaptativo({ consumo: consumo(2000), pesagens: Array.from({ length: 7 }, (_, i) => ({ data: dia(20 + i), peso: 80 })), hoje: HOJE, gastoFormula: 2400 });
    expect(curtas.ok).toBe(false);
  });
  it("resultado muito fora da fórmula é recusado (registro incompleto)", () => {
    const r = gastoAdaptativo({ consumo: consumo(900), pesagens: pesagens(() => 80), hoje: HOJE, gastoFormula: 2800 });
    expect(r.ok).toBe(false);
  });
  it("exibe a fórmula com o motivo quando não há dados, e o adaptativo quando há", () => {
    const formula = gastoPorFormula({ sexo: "feminino", idadeAnos: 30, alturaCm: 165, pesoKg: 70, massaMagraKg: null, nivel: "leve" });
    const sem = gastoParaExibir(formula, { ok: false, motivo: "Faltam registros de comida." });
    expect(sem.metodo).toBe("mifflin_st_jeor");
    expect(sem.explicacao).toMatch(/Faltam registros/);
    expect(sem.minimo).toBeLessThan(sem.valor);
    const ok = gastoAdaptativo({ consumo: consumo(2000), pesagens: pesagens(() => 70), hoje: HOJE, gastoFormula: formula.gasto });
    const com = gastoParaExibir(formula, ok);
    expect(com.metodo).toBe("adaptativo");
    expect(com.explicacao).toMatch(/Estimativa/);
  });
});

describe("projeção de peso", () => {
  it("ritmo semanal pelo déficit", () => {
    expect(ritmoSemanalKg(2500, 2000)).toBeCloseTo((500 * 7) / 7700, 5);
    expect(ritmoSemanalKg(2000, 2200)).toBeLessThan(0);
  });
  it("o gasto cai quando o peso cai", () => {
    expect(gastoNoPeso(2400, 80, 70, 1.5)).toBeCloseTo(2250, 5);
    expect(gastoNoPeso(2400, 80, 80, 1.5)).toBe(2400);
  });
  it("com déficit chega à meta e leva mais tempo que uma linha reta", () => {
    const p = projetarPeso({ pesoInicial: 90, gastoInicial: 2600, consumoDiario: 2100, fatorAtividade: 1.5, pesoMeta: 80 });
    expect(p.semanasParaMeta).not.toBeNull();
    const reta = Math.ceil(10 / ritmoSemanalKg(2600, 2100));
    expect(p.semanasParaMeta!).toBeGreaterThan(reta);
    expect(p.pontos[0].peso).toBe(90);
    expect(p.pontos.at(-1)!.peso).toBeLessThanOrEqual(80);
  });
  it("consumo igual ao gasto: não chega à meta e mostra o peso de equilíbrio", () => {
    const p = projetarPeso({ pesoInicial: 90, gastoInicial: 2600, consumoDiario: 2600, fatorAtividade: 1.5, pesoMeta: 80 });
    expect(p.semanasParaMeta).toBeNull();
    expect(p.pesoDeEquilibrio).toBe(90);
  });
  it("déficit pequeno estabiliza antes da meta", () => {
    const p = projetarPeso({ pesoInicial: 90, gastoInicial: 2600, consumoDiario: 2450, fatorAtividade: 1.5, pesoMeta: 70 });
    expect(p.semanasParaMeta).toBeNull();
    expect(p.pesoDeEquilibrio).toBeLessThan(90);
    expect(p.pesoDeEquilibrio).toBeGreaterThan(70);
  });
  it("marcos de 5 em 5 kg até a meta", () => {
    expect(marcos(100, 82, 5)).toEqual([95, 90, 85, 82]);
    expect(marcos(70, 72, 5)).toEqual([72]);
    expect(marcos(60, 70, 5)).toEqual([65, 70]);
  });
});

const base: EntradaPlano = { pesoAtual: 90, pesoMeta: 80, alturaCm: 175, dataAlvo: null, hoje: "2026-10-09", gasto: 2600, tmb: 1800, fatorAtividade: 1.45, ritmoMaxPct: RITMO_MAX_PADRAO_PCT };

describe("meta sugerida e travas de segurança", () => {
  it("oferece opções leve, moderada e firme, nunca acima do ritmo máximo, e recomenda a moderada", () => {
    const p = planejarMeta(base);
    expect(p.tipo).toBe("perder");
    expect(p.opcoes.map((o) => o.id)).toEqual(["leve", "moderado", "firme"]);
    for (const o of p.opcoes) {
      expect(o.pctSemana).toBeLessThanOrEqual(RITMO_MAX_PADRAO_PCT);
      expect(o.kcal).toBeGreaterThanOrEqual(base.tmb);
      expect(o.kcal).toBeLessThan(base.gasto);
    }
    expect(p.opcoes.find((o) => o.recomendada)?.id).toBe("moderado");
  });
  it("ritmo máximo menor que o padrão corta as opções mais rápidas", () => {
    const p = planejarMeta({ ...base, ritmoMaxPct: 0.4 });
    expect(p.opcoes.map((o) => o.id)).toEqual(["leve"]);
    expect(p.opcoes[0].recomendada).toBe(true);
  });
  it("nunca passa do teto de 1% mesmo que o usuário configure mais", () => {
    const p = planejarMeta({ ...base, ritmoMaxPct: 3 });
    expect(Math.max(...p.opcoes.map((o) => o.pctSemana))).toBeLessThanOrEqual(1);
  });
  it("calorias nunca ficam abaixo da taxa metabólica basal", () => {
    const p = planejarMeta({ ...base, gasto: 1900, tmb: 1800 });
    for (const o of p.opcoes) expect(o.kcal).toBeGreaterThanOrEqual(1800);
    expect(p.opcoes.some((o) => o.limitadaPorTmb)).toBe(true);
  });
  it("data desejada: ritmo viável, acima do máximo e abaixo da TMB", () => {
    const viavel = planejarMeta({ ...base, dataAlvo: "2027-02-01" });
    expect(viavel.paraData?.viavel).toBe(true);
    const curta = planejarMeta({ ...base, dataAlvo: "2026-11-09" });
    expect(curta.paraData?.viavel).toBe(false);
    expect(curta.avisos.some((a) => /máximo/.test(a.texto))).toBe(true);
    const imediata = planejarMeta({ ...base, dataAlvo: "2026-10-12" });
    expect(imediata.paraData).toBeNull();
    expect(imediata.avisos.some((a) => /uma semana/.test(a.texto))).toBe(true);
  });
  it("meta que deixa o IMC abaixo de 18,5 bloqueia as sugestões", () => {
    const p = planejarMeta({ ...base, pesoAtual: 60, pesoMeta: 50, alturaCm: 175 });
    expect(p.avisos.some((a) => a.nivel === "bloqueio")).toBe(true);
    expect(p.opcoes).toEqual([]);
    expect(imc(50, 175)).toBeLessThan(18.5);
  });
  it("já abaixo do peso saudável: não sugere perder", () => {
    const p = planejarMeta({ ...base, pesoAtual: 54, pesoMeta: 53.5, alturaCm: 175 });
    expect(p.opcoes).toEqual([]);
    expect(p.avisos.some((a) => a.nivel === "bloqueio")).toBe(true);
  });
  it("gasto perto da TMB: não repete opções iguais e explica", () => {
    const p = planejarMeta({ ...base, gasto: 1950, tmb: 1850 });
    const kcals = p.opcoes.map((o) => o.kcal);
    expect(new Set(kcals).size).toBe(kcals.length);
    expect(p.opcoes.length).toBeLessThan(3);
    expect(p.opcoes.filter((o) => o.recomendada)).toHaveLength(1);
    expect(p.avisos.some((a) => /perto da sua taxa metabólica basal/.test(a.texto))).toBe(true);
  });
  it("manter e ganhar", () => {
    const manter = planejarMeta({ ...base, pesoMeta: 90 });
    expect(manter.tipo).toBe("manter");
    expect(manter.opcoes[0].kcal).toBe(2600);
    const ganhar = planejarMeta({ ...base, pesoMeta: 95 });
    expect(ganhar.tipo).toBe("ganhar");
    for (const o of ganhar.opcoes) expect(o.kcal).toBeGreaterThan(2600);
  });
  it("aviso para meta digitada: abaixo da TMB e ritmo alto", () => {
    expect(avisoDeMetaDigitada({ kcal: 1500, tmb: 1800, gasto: 2600, pesoAtual: 90, ritmoMaxPct: 1 })).toMatch(/taxa metabólica basal/);
    expect(avisoDeMetaDigitada({ kcal: 1850, tmb: 1800, gasto: 3300, pesoAtual: 80, ritmoMaxPct: 1 })).toMatch(/por semana/);
    expect(avisoDeMetaDigitada({ kcal: 2200, tmb: 1800, gasto: 2600, pesoAtual: 90, ritmoMaxPct: 1 })).toBeNull();
    expect(avisoDeMetaDigitada({ kcal: 2200, tmb: null, gasto: null, pesoAtual: null, ritmoMaxPct: 1 })).toBeNull();
  });
});

describe("divisão de macros", () => {
  it("proteína entre 1,6 e 2,2 g/kg, gordura mínima e carboidrato o restante", () => {
    const m = dividirMacros({ kcal: 2100, pesoKg: 80, emDeficit: true });
    expect(m.proteinaG).toBe(160);
    expect(m.proteinaG / 80).toBeLessThanOrEqual(2.2);
    expect(m.gorduraG).toBeGreaterThanOrEqual(56);
    expect(Math.abs(m.kcal - 2100)).toBeLessThan(30);
  });
  it("calorias baixas: proteína limitada a 35% e carboidrato mínimo de 50 g", () => {
    const m = dividirMacros({ kcal: 1200, pesoKg: 110, emDeficit: true });
    expect(m.proteinaG * 4).toBeLessThanOrEqual(0.35 * 1200 + 4);
    expect(m.carboG).toBeGreaterThanOrEqual(50);
  });
});
