import { describe, expect, it } from "vitest";
import { compararPlanoReal, inicioDaSemana, mediaPorSemana, perdaRealPelaTendencia, treinosPorSemana } from "@/lib/progresso-graficos";

describe("semanas", () => {
  it("início da semana é a segunda-feira", () => {
    expect(inicioDaSemana("2026-10-05")).toBe("2026-10-05"); // segunda
    expect(inicioDaSemana("2026-10-09")).toBe("2026-10-05"); // sexta
    expect(inicioDaSemana("2026-10-11")).toBe("2026-10-05"); // domingo
    expect(inicioDaSemana("2026-10-12")).toBe("2026-10-12");
  });
  it("média por semana ignora dias sem valor e semanas vazias", () => {
    const r = mediaPorSemana([
      { data: "2026-10-05", valor: 2000 },
      { data: "2026-10-06", valor: 2200 },
      { data: "2026-10-07", valor: null },
      { data: "2026-10-12", valor: null },
      { data: "2026-10-20", valor: 1800 },
    ]);
    expect(r).toEqual([
      { inicio: "2026-10-05", media: 2100, dias: 2 },
      { inicio: "2026-10-19", media: 1800, dias: 1 },
    ]);
  });
  it("treinos por semana preenche semanas sem treino com zero", () => {
    const r = treinosPorSemana(["2026-10-05", "2026-10-07", "2026-10-21"]);
    expect(r).toEqual([
      { inicio: "2026-10-05", total: 2 },
      { inicio: "2026-10-12", total: 0 },
      { inicio: "2026-10-19", total: 1 },
    ]);
    expect(treinosPorSemana([])).toEqual([]);
  });
});

describe("perda real", () => {
  it("é relativa ao primeiro ponto do período", () => {
    const t = [
      { data: "2026-09-01", tendencia: 92 },
      { data: "2026-10-01", tendencia: 90 },
      { data: "2026-10-08", tendencia: 89.4 },
    ];
    expect(perdaRealPelaTendencia(t, "2026-10-01")).toEqual([
      { data: "2026-10-01", perdaKg: 0 },
      { data: "2026-10-08", perdaKg: 0.6 },
    ]);
    expect(perdaRealPelaTendencia(t, "2027-01-01")).toEqual([]);
  });
});

describe("plano × real", () => {
  const pontos = [0, 1, 2, 3, 4].map((s) => ({ semana: s, peso: 90 - s * 0.5 }));
  const base = { projecaoCriadaEm: "2026-09-01", pontos, pesoMetaKg: 80 };
  it("no ritmo, adiantado e atrasado (perdendo)", () => {
    expect(compararPlanoReal({ ...base, hoje: "2026-09-15", tendenciaAtualKg: 89.1 })).toMatchObject({ situacao: "no_ritmo", previstoKg: 89, semana: 2 });
    expect(compararPlanoReal({ ...base, hoje: "2026-09-15", tendenciaAtualKg: 87.9 })).toMatchObject({ situacao: "adiantado", diferencaKg: -1.1 });
    expect(compararPlanoReal({ ...base, hoje: "2026-09-15", tendenciaAtualKg: 90.2 })).toMatchObject({ situacao: "atrasado" });
  });
  it("sem dados na primeira semana, sem tendência ou sem pontos", () => {
    expect(compararPlanoReal({ ...base, hoje: "2026-09-03", tendenciaAtualKg: 89 }).situacao).toBe("sem_dados");
    expect(compararPlanoReal({ ...base, hoje: "2026-09-15", tendenciaAtualKg: null }).situacao).toBe("sem_dados");
    expect(compararPlanoReal({ ...base, pontos: [], hoje: "2026-09-15", tendenciaAtualKg: 89 }).situacao).toBe("sem_dados");
  });
  it("depois do fim da projeção compara com o último ponto", () => {
    const r = compararPlanoReal({ ...base, hoje: "2026-12-01", tendenciaAtualKg: 88 });
    expect(r.previstoKg).toBe(88);
    expect(r.situacao).toBe("no_ritmo");
  });
});
