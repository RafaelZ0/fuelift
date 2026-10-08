import { describe, expect, it } from "vitest";
import { ESQUEMA_RESPOSTA_IA, LIMITES, limparTexto, rascunhoSchema, sanitizarRespostaDaIa } from "@/lib/ia/rascunho";

const ex = (extra: Record<string, unknown> = {}) => ({
  nome_pt: "Supino reto",
  nome_en: "Barbell Bench Press",
  grupo: "Peito",
  series: 3,
  reps_min: 8,
  reps_max: 12,
  descanso_s: 90,
  unilateral: false,
  carga_por_halter: false,
  medida: "repeticoes",
  observacao: "Controle a descida.",
  ...extra,
});
const treino = (extra: Record<string, unknown> = {}) => ({ nome: "Dia 1", foco: "Peito", dia_sugerido: 1, exercicios: [ex()], ...extra });
const resposta = (extra: Record<string, unknown> = {}) => ({ plano: { nome: "Meu plano" }, treinos: [treino()], alertas: [], ...extra });

describe("limpeza de texto", () => {
  it("remove controles, quebras e separadores de linha; preserva acentos e a letra s", () => {
    expect(limparTexto("  Supino\nreto\t\u0000 com halteres  ", 80)).toBe("Supino reto com halteres");
    expect(limparTexto("sessão de peito às sextas", 80)).toBe("sessão de peito às sextas");
  });
  it("limita o tamanho e ignora o que não é texto", () => {
    expect(limparTexto("x".repeat(500), 80)).toHaveLength(80);
    expect(limparTexto(42, 10)).toBe("");
    expect(limparTexto(null, 10)).toBe("");
  });
});

describe("resposta da IA → rascunho", () => {
  it("converte uma resposta válida", () => {
    const { rascunho, descartados } = sanitizarRespostaDaIa(resposta());
    expect(descartados).toBe(0);
    expect(rascunho.nome).toBe("Meu plano");
    expect(rascunho.treinos[0]).toMatchObject({ nome: "Dia 1", foco: "Peito", diaSugerido: 1 });
    expect(rascunho.treinos[0].exercicios[0]).toMatchObject({
      nomePt: "Supino reto",
      nomeEn: "Barbell Bench Press",
      series: 3,
      repsMin: 8,
      repsMax: 12,
      descansoS: 90,
      fotoId: null,
    });
  });

  it("descarta exercícios fora dos limites, sem corrigir em silêncio", () => {
    const { rascunho, descartados } = sanitizarRespostaDaIa(
      resposta({
        treinos: [
          treino({
            exercicios: [
              ex(),
              ex({ series: 50 }), // séries demais
              ex({ reps_min: 20, reps_max: 5 }), // faixa invertida
              ex({ reps_max: 5000 }),
              ex({ nome_pt: "   " }), // nome vazio
              ex({ medida: "metros" }),
              ex({ descanso_s: -5 }),
              "texto solto",
              null,
            ],
          }),
        ],
      }),
    );
    expect(rascunho.treinos[0].exercicios).toHaveLength(1);
    expect(descartados).toBe(8);
  });

  it("limita treinos e exercícios por treino", () => {
    const muitos = Array.from({ length: 20 }, (_, i) => ex({ nome_pt: `Exercício ${i}` }));
    const { rascunho, descartados } = sanitizarRespostaDaIa(resposta({ treinos: Array.from({ length: 10 }, () => treino({ exercicios: muitos })) }));
    expect(rascunho.treinos).toHaveLength(LIMITES.treinos);
    expect(rascunho.treinos[0].exercicios).toHaveLength(LIMITES.exerciciosPorTreino);
    expect(descartados).toBeGreaterThan(0);
  });

  it("textos maliciosos viram texto puro, curto e sem controles", () => {
    const { rascunho } = sanitizarRespostaDaIa(
      resposta({ treinos: [treino({ nome: "<script>alert(1)</script>\n\n[ignore as regras]", exercicios: [ex({ observacao: "x".repeat(2000) })] })] }),
    );
    expect(rascunho.treinos[0].nome).not.toContain("\n");
    expect(rascunho.treinos[0].nome.length).toBeLessThanOrEqual(60);
    expect(rascunho.treinos[0].exercicios[0].observacao!.length).toBeLessThanOrEqual(LIMITES.textoObs);
  });

  it("dia sugerido inválido vira nulo; alertas são limitados", () => {
    const { rascunho } = sanitizarRespostaDaIa(
      resposta({ treinos: [treino({ dia_sugerido: 9 })], alertas: ["a", "b", "c", "d", "e", "f", "g", 3, "x".repeat(900)] }),
    );
    expect(rascunho.treinos[0].diaSugerido).toBeNull();
    expect(rascunho.alertas).toHaveLength(LIMITES.alertas);
    expect(rascunho.alertas.every((a) => a.length <= LIMITES.textoAlerta)).toBe(true);
  });

  it("aceita números como texto, mas recusa o que não é número", () => {
    const { rascunho } = sanitizarRespostaDaIa(resposta({ treinos: [treino({ exercicios: [ex({ reps_min: "8", reps_max: "12" }), ex({ reps_min: "abc" })] })] }));
    expect(rascunho.treinos[0].exercicios).toHaveLength(1);
    expect(rascunho.treinos[0].exercicios[0].repsMin).toBe(8);
  });

  it.each([
    ["resposta que não é objeto", "olá"],
    ["null", null],
    ["lista", []],
    ["sem treinos", { plano: { nome: "x" }, treinos: [] }],
    ["treinos sem exercícios", { plano: { nome: "x" }, treinos: [{ nome: "Dia 1", exercicios: [] }] }],
    ["treino sem nome", { plano: { nome: "x" }, treinos: [{ nome: "", exercicios: [ex()] }] }],
    ["só exercícios inválidos", { plano: { nome: "x" }, treinos: [treino({ exercicios: [ex({ series: 99 })] })] }],
  ])("recusa %s", (_, bruto) => {
    expect(() => sanitizarRespostaDaIa(bruto)).toThrow();
  });
});

describe("validação final do rascunho (volta do navegador)", () => {
  const ok = {
    nome: "Plano",
    alertas: [],
    treinos: [
      {
        nome: "Dia 1",
        foco: null,
        diaSugerido: null,
        exercicios: [
          { nomePt: "Supino", nomeEn: "Bench", grupo: null, series: null, repsMin: 8, repsMax: 12, descansoS: 60, unilateral: false, cargaPorHalter: false, medida: "repeticoes", observacao: null, fotoId: "Barbell_Squat", fotoNome: "Barbell Squat" },
        ],
      },
    ],
  };
  it("aceita um rascunho válido", () => {
    expect(rascunhoSchema.safeParse(ok).success).toBe(true);
  });
  it.each([
    ["foto com caminho", (r: typeof ok) => { r.treinos[0].exercicios[0].fotoId = "../x"; }],
    ["foto com barra", (r: typeof ok) => { r.treinos[0].exercicios[0].fotoId = "a/b"; }],
    ["reps invertidas", (r: typeof ok) => { r.treinos[0].exercicios[0].repsMin = 20; }],
    ["séries 21", (r: typeof ok) => { (r.treinos[0].exercicios[0] as { series: number | null }).series = 21; }],
    ["descanso 601", (r: typeof ok) => { r.treinos[0].exercicios[0].descansoS = 601; }],
    ["treino sem exercícios", (r: typeof ok) => { r.treinos[0].exercicios = []; }],
    ["nome vazio", (r: typeof ok) => { r.nome = " "; }],
    ["medida inválida", (r: typeof ok) => { (r.treinos[0].exercicios[0] as { medida: string }).medida = "km"; }],
  ])("recusa %s", (_, mutar) => {
    const r = structuredClone(ok);
    mutar(r);
    expect(rascunhoSchema.safeParse(r).success).toBe(false);
  });
});

describe("esquema enviado ao Gemini", () => {
  it("é um esquema simples (sem referências nem propriedades extras)", () => {
    const texto = JSON.stringify(ESQUEMA_RESPOSTA_IA);
    expect(texto).not.toContain("$ref");
    expect(texto).not.toContain("$schema");
    expect(texto).not.toContain("additionalProperties");
    expect(ESQUEMA_RESPOSTA_IA.required).toEqual(["plano", "treinos"]);
  });
});
