import { describe, expect, it } from "vitest";
import { fimDaSemana, montarRelatorioSemanal, resumoFixo, semanaAnterior, semanaSeguinte, semanaValida, type EntradaRelatorio } from "@/lib/relatorio";

// Semana de 05/10/2026 (segunda) a 11/10/2026 (domingo).
const SEG = "2026-10-05";
const dia = (n: number) => new Date(Date.UTC(2026, 9, 5 + n)).toISOString().slice(0, 10);

const base = (extra: Partial<EntradaRelatorio> = {}): EntradaRelatorio => ({
  inicio: SEG,
  hoje: "2026-10-12",
  consumo: Array.from({ length: 7 }, (_, i) => ({ data: dia(i), kcal: 2000 + i * 50, proteinaG: 140 })),
  metaKcal: 2100,
  metaProteinaG: 150,
  pesagens: [
    { data: dia(-6), peso: 91 },
    { data: dia(-3), peso: 90.8 },
    { data: dia(0), peso: 90.6 },
    { data: dia(2), peso: 90.2 },
    { data: dia(4), peso: 90.0 },
    { data: dia(6), peso: 89.8 },
  ],
  sessoes: [
    { data: dia(0), status: "feito" },
    { data: dia(2), status: "feito" },
    { data: dia(4), status: "faltou" },
    { data: dia(9), status: "feito" }, // fora da semana
  ],
  treinosPlanejados: 3,
  passos: [{ data: dia(0), passos: 8000 }, { data: dia(1), passos: 10000 }],
  gasto: { valor: 2400, minimo: 2200, maximo: 2600, metodo: "adaptativo" },
  ...extra,
});

describe("datas da semana", () => {
  it("fim, anterior e seguinte", () => {
    expect(fimDaSemana(SEG)).toBe("2026-10-11");
    expect(semanaAnterior(SEG)).toBe("2026-09-28");
    expect(semanaSeguinte(SEG)).toBe("2026-10-12");
  });
  it("semana válida: segunda, não futura; o resto vira a atual", () => {
    expect(semanaValida("2026-10-05", "2026-10-09")).toBe("2026-10-05");
    expect(semanaValida("2026-10-07", "2026-10-09")).toBe("2026-10-05"); // quarta vira a segunda
    expect(semanaValida("2026-10-12", "2026-10-09")).toBe("2026-10-05"); // futura
    for (const ruim of [undefined, null, "lixo", "2026-13-40", "1999-01-01", 123]) expect(semanaValida(ruim, "2026-10-09")).toBe("2026-10-05");
  });
});

describe("relatório semanal", () => {
  it("calcula médias, treinos, peso e ritmos de uma semana completa", () => {
    const r = montarRelatorioSemanal(base());
    expect(r.parcial).toBe(false);
    expect(r.fim).toBe("2026-10-11");
    expect(r.calorias).toMatchObject({ media: 2150, dias: 7, meta: 2100, difMedia: 50 });
    expect(r.proteina).toEqual({ media: 140, meta: 150, difMedia: -10 });
    expect(r.treino).toEqual({ feitos: 2, faltas: 1, planejados: 3 });
    expect(r.peso.pesagens).toBe(4);
    expect(r.peso.variacaoKg).toBeLessThan(0);
    expect(r.ritmoRealKgSemana).toBeGreaterThan(0); // perdeu
    expect(r.ritmoPrevistoKgSemana).toBeCloseTo(((2400 - 2150) * 7) / 7700, 2);
    expect(r.passos).toEqual({ media: 9000, dias: 2 });
    expect(r.avisos).toEqual([]);
  });
  it("semana em andamento considera só os dias até hoje e avisa", () => {
    const r = montarRelatorioSemanal(base({ hoje: dia(2) }));
    expect(r.parcial).toBe(true);
    expect(r.calorias.dias).toBe(3);
    expect(r.treino.feitos).toBe(2);
    expect(r.avisos.join(" ")).toMatch(/ainda não terminou/);
  });
  it("dias abaixo de 800 kcal não contam como registro completo", () => {
    const r = montarRelatorioSemanal(base({ consumo: [{ data: dia(0), kcal: 300 }, { data: dia(1), kcal: 2000 }, { data: dia(2), kcal: null }] }));
    expect(r.calorias).toMatchObject({ media: 2000, dias: 1 });
    expect(r.avisos.join(" ")).toMatch(/Poucos dias com registro/);
  });
  it("sem pesagens suficientes não inventa variação", () => {
    const r = montarRelatorioSemanal(base({ pesagens: [{ data: dia(1), peso: 90 }] }));
    expect(r.peso.variacaoKg).toBeNull();
    expect(r.ritmoRealKgSemana).toBeNull();
    expect(r.avisos.join(" ")).toMatch(/Poucas pesagens/);
  });
  it("sem dados nenhum: tudo nulo e explicado", () => {
    const r = montarRelatorioSemanal(base({ consumo: [], pesagens: [], sessoes: [], passos: [], gasto: null, metaKcal: null, metaProteinaG: null }));
    expect(r.calorias.media).toBeNull();
    expect(r.proteina.media).toBeNull();
    expect(r.ritmoPrevistoKgSemana).toBeNull();
    expect(r.passos.media).toBeNull();
    expect(r.treino).toEqual({ feitos: 0, faltas: 0, planejados: 3 });
    expect(r.avisos.length).toBeGreaterThanOrEqual(2);
  });
  it("o texto fixo usa só números do relatório e avisa que é estimativa", () => {
    const f = resumoFixo(montarRelatorioSemanal(base()));
    expect(f).toMatch(/2\.150 kcal/);
    expect(f).toMatch(/meta 2\.100 kcal/);
    expect(f).toMatch(/Treinos: 2 feitos e 1 falta/);
    expect(f).toMatch(/estimativas/);
    expect(resumoFixo(montarRelatorioSemanal(base({ consumo: [] })))).toMatch(/Não há dias com registro/);
  });
});
