import { describe, expect, it } from "vitest";
import {
  adicionarSegundos,
  aplicacaoPendente,
  calendarioDoMes,
  dicaDeProgressao,
  diaDaSemana,
  estatisticasDoMes,
  fimDoDescanso,
  formatarTempo,
  massaGorda,
  segundosRestantes,
  semanaDoPlano,
  seriesDaFase,
  seriesDoExercicio,
  sequenciaAtual,
  tendenciaDoPeso,
  totalAgua,
  treinoDoDia,
  type SerieFeita,
  type SessaoResumo,
} from "@/lib/treino";

const plano = { inicio: "2026-10-05", seriesInicio: 2, seriesDepois: 3, semanasInicio: 3 };

describe("readaptação", () => {
  it("semana do plano", () => {
    expect(semanaDoPlano("2026-10-05", "2026-10-04")).toBe(0);
    expect(semanaDoPlano("2026-10-05", "2026-10-05")).toBe(1);
    expect(semanaDoPlano("2026-10-05", "2026-10-11")).toBe(1);
    expect(semanaDoPlano("2026-10-05", "2026-10-12")).toBe(2);
    expect(semanaDoPlano("2026-10-05", "2026-10-26")).toBe(4);
  });

  it("2 séries nas semanas 1 a 3 e 3 a partir da 4", () => {
    expect(seriesDaFase(plano, "2026-10-05")).toBe(2);
    expect(seriesDaFase(plano, "2026-10-25")).toBe(2); // fim da semana 3
    expect(seriesDaFase(plano, "2026-10-26")).toBe(3); // início da semana 4
  });

  it("exercício com séries próprias ignora a fase", () => {
    expect(seriesDoExercicio(4, plano, "2026-10-05")).toBe(4);
    expect(seriesDoExercicio(null, plano, "2026-10-05")).toBe(2);
  });
});

describe("treino do dia", () => {
  const agenda = new Map([[1, "t1"], [3, "t2"]]);
  it("usa a agenda semanal", () => {
    expect(diaDaSemana("2026-10-05")).toBe(1); // segunda
    expect(treinoDoDia("2026-10-05", agenda, new Map())).toBe("t1");
    expect(treinoDoDia("2026-10-06", agenda, new Map())).toBeNull();
  });
  it("a troca do dia vale mais que a agenda", () => {
    expect(treinoDoDia("2026-10-05", agenda, new Map([["2026-10-05", "t2"]]))).toBe("t2");
    expect(treinoDoDia("2026-10-05", agenda, new Map([["2026-10-05", null]]))).toBeNull(); // descanso
  });
});

describe("dica de progressão", () => {
  const serie = (numero: number, reps: number, feito = true): SerieFeita => ({ numero, cargaKg: 20, repeticoes: reps, segundos: null, feito });
  it("sugere subir quando todas as séries chegaram ao topo", () => {
    expect(dicaDeProgressao([serie(1, 12), serie(2, 12), serie(3, 12)], 3, 12)?.subirCarga).toBe(true);
  });
  it("não sugere se uma série ficou abaixo do topo", () => {
    expect(dicaDeProgressao([serie(1, 12), serie(2, 11), serie(3, 12)], 3, 12)?.subirCarga).toBe(false);
  });
  it("não sugere se faltou série ou alguma não foi feita", () => {
    expect(dicaDeProgressao([serie(1, 12), serie(2, 12)], 3, 12)?.subirCarga).toBe(false);
    expect(dicaDeProgressao([serie(1, 12), serie(2, 12), serie(3, 12, false)], 3, 12)?.subirCarga).toBe(false);
  });
  it("sem histórico não há dica; ordena as séries", () => {
    expect(dicaDeProgressao([], 3, 12)).toBeNull();
    expect(dicaDeProgressao([serie(3, 10), serie(1, 10)], 3, 12)?.ultima.map((s) => s.numero)).toEqual([1, 3]);
  });
  it("exercício por segundos usa o tempo", () => {
    const s = (n: number, seg: number): SerieFeita => ({ numero: n, cargaKg: 0, repeticoes: null, segundos: seg, feito: true });
    expect(dicaDeProgressao([s(1, 60), s(2, 60)], 2, 60, true)?.subirCarga).toBe(true);
    expect(dicaDeProgressao([s(1, 60), s(2, 45)], 2, 60, true)?.subirCarga).toBe(false);
  });
});

describe("estatísticas e calendário", () => {
  const sessoes: SessaoResumo[] = [
    { data: "2026-10-01", status: "feito", motivo: null },
    { data: "2026-10-02", status: "faltou", motivo: "trabalho" },
    { data: "2026-10-05", status: "faltou", motivo: "trabalho" },
    { data: "2026-10-06", status: "faltou", motivo: "doente" },
    { data: "2026-10-07", status: "feito", motivo: null },
    { data: "2026-09-30", status: "feito", motivo: null },
  ];

  it("conta o mês e ordena os motivos", () => {
    const e = estatisticasDoMes(sessoes, 2026, 10);
    expect(e.feitos).toBe(2);
    expect(e.faltas).toBe(3);
    expect(e.motivos).toEqual([{ motivo: "trabalho", n: 2 }, { motivo: "doente", n: 1 }]);
  });

  it("sequência atual para na primeira falta", () => {
    expect(sequenciaAtual(sessoes)).toBe(1);
    expect(sequenciaAtual([{ data: "2026-10-01", status: "feito", motivo: null }, { data: "2026-10-02", status: "feito", motivo: null }])).toBe(2);
    expect(sequenciaAtual([])).toBe(0);
  });

  it("calendário: feito, faltou, planejado, sem registro e livre", () => {
    const dias = calendarioDoMes(2026, 10, "2026-10-10", sessoes, (d) => [1, 3, 5].includes(diaDaSemana(d)));
    const st = (d: string) => dias.find((x) => x.data === d)!.status;
    expect(dias).toHaveLength(31);
    expect(st("2026-10-01")).toBe("feito");
    expect(st("2026-10-02")).toBe("faltou");
    expect(st("2026-10-09")).toBe("sem_registro"); // sexta passada, planejada, sem registro
    expect(st("2026-10-10")).toBe("livre"); // sábado, não planejado
    expect(st("2026-10-12")).toBe("planejado"); // segunda futura
    expect(st("2026-10-13")).toBe("livre");
  });
});

describe("água", () => {
  it("soma o dia", () => {
    expect(totalAgua([{ ml: 200 }, { ml: 500 }, { ml: 300 }])).toBe(1000);
    expect(totalAgua([])).toBe(0);
  });
});

describe("tendência do peso", () => {
  it("começa no primeiro peso e suaviza as oscilações", () => {
    const t = tendenciaDoPeso([
      { data: "2026-10-01", peso: 100 },
      { data: "2026-10-02", peso: 102 },
      { data: "2026-10-03", peso: 99 },
    ]);
    expect(t[0].tendencia).toBe(100);
    expect(t[1].tendencia).toBeCloseTo(100.2, 2);
    expect(t[2].tendencia).toBeCloseTo(100.08, 2);
    expect(Math.max(...t.map((p) => p.tendencia))).toBeLessThan(102);
  });

  it("dias sem pesagem dão mais peso à pesagem seguinte", () => {
    const seguido = tendenciaDoPeso([{ data: "2026-10-01", peso: 100 }, { data: "2026-10-02", peso: 90 }])[1].tendencia;
    const apos10dias = tendenciaDoPeso([{ data: "2026-10-01", peso: 100 }, { data: "2026-10-11", peso: 90 }])[1].tendencia;
    expect(apos10dias).toBeLessThan(seguido);
  });

  it("ordena por data e aceita lista vazia", () => {
    expect(tendenciaDoPeso([{ data: "2026-10-02", peso: 80 }, { data: "2026-10-01", peso: 82 }])[0].data).toBe("2026-10-01");
    expect(tendenciaDoPeso([])).toEqual([]);
  });

  it("massa gorda = peso − massa magra", () => {
    expect(massaGorda(90, 65.5)).toBe(24.5);
    expect(massaGorda(90, null)).toBeNull();
  });
});

describe("aplicação semanal", () => {
  it("lembra só no dia escolhido e sem registro recente", () => {
    expect(aplicacaoPendente("2026-10-07", 3, [])).toBe(true); // quarta
    expect(aplicacaoPendente("2026-10-07", 4, [])).toBe(false);
    expect(aplicacaoPendente("2026-10-07", null, [])).toBe(false);
    expect(aplicacaoPendente("2026-10-07", 3, ["2026-10-07"])).toBe(false);
    expect(aplicacaoPendente("2026-10-07", 3, ["2026-09-30"])).toBe(true); // 7 dias atrás não conta
  });
});

describe("cronômetro de descanso", () => {
  it("usa a hora do fim, não contagem por segundo", () => {
    const fim = fimDoDescanso(1_000_000, 90);
    expect(fim).toBe(1_090_000);
    expect(segundosRestantes(fim, 1_000_000)).toBe(90);
    expect(segundosRestantes(fim, 1_030_500)).toBe(60); // 59,5 s restantes → 60
    expect(segundosRestantes(fim, 5_000_000)).toBe(0); // voltou depois da tela apagada
  });

  it("+15 s soma ao fim; se já acabou, soma a partir de agora", () => {
    expect(adicionarSegundos(1_090_000, 1_000_000, 15)).toBe(1_105_000);
    expect(adicionarSegundos(1_090_000, 2_000_000, 15)).toBe(2_015_000);
  });

  it("formata mm:ss", () => {
    expect(formatarTempo(90)).toBe("1:30");
    expect(formatarTempo(5)).toBe("0:05");
    expect(formatarTempo(-3)).toBe("0:00");
  });
});

describe("fotos dos exercícios", () => {
  it("monta a URL só para ids válidos", async () => {
    const { urlFoto, fotoIdValido } = await import("@/lib/fotos");
    expect(urlFoto("Barbell_Squat", 0)).toBe("https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/Barbell_Squat/0.jpg");
    expect(urlFoto("Barbell_Bench_Press_-_Medium_Grip", 1)).toContain("/Barbell_Bench_Press_-_Medium_Grip/1.jpg");
    expect(urlFoto("../etc/passwd")).toBeNull();
    expect(urlFoto("a/b")).toBeNull();
    expect(urlFoto("https://evil.com/x")).toBeNull();
    expect(urlFoto(null)).toBeNull();
    expect(fotoIdValido("x".repeat(121))).toBe(false);
  });
});
