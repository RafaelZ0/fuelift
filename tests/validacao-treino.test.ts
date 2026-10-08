import { describe, expect, it } from "vitest";
import { hojeSaoPaulo, somarDias } from "@/lib/datas";
import {
  aguaSchema,
  agendaSchema,
  exercicioSchema,
  faltaSchema,
  pesagemSchema,
  planoSchema,
  serieSchema,
  treinoExercicioSchema,
  trocaSchema,
} from "@/lib/validacao/treino";

const UUID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const hoje = hojeSaoPaulo();

describe("série do treino", () => {
  const ok = { data: hoje, treinoId: UUID, exercicioId: UUID, numero: "1", cargaKg: "27,5", repeticoes: "10", segundos: "", feito: true };

  it("aceita valores nos limites", () => {
    expect(serieSchema.safeParse(ok).success).toBe(true);
    expect(serieSchema.safeParse({ ...ok, cargaKg: "0", repeticoes: "0" }).success).toBe(true);
    expect(serieSchema.safeParse({ ...ok, cargaKg: "1000", repeticoes: "1000" }).success).toBe(true);
    expect(serieSchema.safeParse({ ...ok, repeticoes: "", segundos: "7200" }).success).toBe(true);
    expect(serieSchema.safeParse({ ...ok, treinoId: "" }).success).toBe(true);
  });

  it.each([
    ["carga 1000,01", { cargaKg: "1000,01" }],
    ["carga 1001", { cargaKg: "1001" }],
    ["carga negativa", { cargaKg: "-5" }],
    ["carga com texto", { cargaKg: "dez" }],
    ["carga com notação científica", { cargaKg: "1e3" }],
    ["repetições 1001", { repeticoes: "1001" }],
    ["segundos 7201", { repeticoes: "", segundos: "7201" }],
    ["sem repetições nem segundos", { repeticoes: "", segundos: "" }],
    ["série 0", { numero: "0" }],
    ["série 31", { numero: "31" }],
    ["exercício inválido", { exercicioId: "1 or 1=1" }],
    ["treino inválido", { treinoId: "abc" }],
    ["dia futuro", { data: somarDias(hoje, 1) }],
    ["data antiga", { data: "1999-12-31" }],
  ])("recusa %s", (_, extra) => {
    expect(serieSchema.safeParse({ ...ok, ...extra }).success).toBe(false);
  });
});

describe("plano e treino", () => {
  const plano = { nome: "Plano", inicio: "2026-10-05", seriesInicio: "2", seriesDepois: "3", semanasInicio: "3" };
  it("plano: limites", () => {
    expect(planoSchema.safeParse(plano).success).toBe(true);
    expect(planoSchema.safeParse({ ...plano, semanasInicio: "0" }).success).toBe(true);
    for (const extra of [{ seriesInicio: "0" }, { seriesDepois: "21" }, { semanasInicio: "53" }, { nome: "" }, { nome: "x".repeat(81) }, { inicio: "amanhã" }]) {
      expect(planoSchema.safeParse({ ...plano, ...extra }).success).toBe(false);
    }
  });

  const item = { treinoId: UUID, exercicioId: UUID, series: "", repsMin: "8", repsMax: "12", descansoS: "90", observacao: "" };
  it("exercício do treino: limites", () => {
    expect(treinoExercicioSchema.safeParse(item).success).toBe(true);
    expect(treinoExercicioSchema.safeParse({ ...item, series: "20", descansoS: "600", repsMax: "1000" }).success).toBe(true);
    for (const extra of [
      { repsMin: "0" },
      { repsMin: "10", repsMax: "5" },
      { repsMax: "1001" },
      { series: "21" },
      { descansoS: "601" },
      { descansoS: "-1" },
      { observacao: "x".repeat(301) },
      { treinoId: "x" },
    ]) {
      expect(treinoExercicioSchema.safeParse({ ...item, ...extra }).success).toBe(false);
    }
  });

  it("exercício: nome, medida e foto", () => {
    const e = { nome: "Supino", grupo: "", unilateral: "on", cargaPorHalter: undefined, medida: "repeticoes", fotoId: "" };
    const r = exercicioSchema.parse(e);
    expect(r.unilateral).toBe(true);
    expect(r.cargaPorHalter).toBe(false);
    expect(r.fotoId).toBeNull();
    expect(exercicioSchema.safeParse({ ...e, fotoId: "Barbell_Squat" }).success).toBe(true);
    for (const extra of [{ nome: "" }, { nome: "x".repeat(81) }, { medida: "metros" }, { fotoId: "../x" }, { fotoId: "a/b" }, { grupo: "x".repeat(41) }]) {
      expect(exercicioSchema.safeParse({ ...e, ...extra }).success).toBe(false);
    }
  });

  it("agenda e troca", () => {
    expect(agendaSchema.safeParse({ diaSemana: "0", treinoId: UUID }).success).toBe(true);
    expect(agendaSchema.parse({ diaSemana: "6", treinoId: "" }).treinoId).toBeNull();
    expect(agendaSchema.safeParse({ diaSemana: "7", treinoId: UUID }).success).toBe(false);
    expect(trocaSchema.parse({ data: "2026-10-05", treinoId: "descanso" }).treinoId).toBeNull();
    expect(trocaSchema.safeParse({ data: "2026-10-05", treinoId: "qualquer" }).success).toBe(false);
  });
});

describe("falta", () => {
  it("só aceita os motivos da lista", () => {
    expect(faltaSchema.safeParse({ data: hoje, treinoId: "", motivo: "dor_lesao", observacao: "" }).success).toBe(true);
    expect(faltaSchema.safeParse({ data: hoje, treinoId: "", motivo: "preguiça", observacao: "" }).success).toBe(false);
    expect(faltaSchema.safeParse({ data: hoje, treinoId: "", motivo: "outro", observacao: "x".repeat(501) }).success).toBe(false);
  });
});

describe("água", () => {
  it("1 a 5000 ml", () => {
    expect(aguaSchema.safeParse({ data: hoje, ml: "200" }).success).toBe(true);
    expect(aguaSchema.safeParse({ data: hoje, ml: "5000" }).success).toBe(true);
    for (const ml of ["0", "5001", "-200", "200,5", "abc", ""]) expect(aguaSchema.safeParse({ data: hoje, ml }).success).toBe(false);
    expect(aguaSchema.safeParse({ data: somarDias(hoje, 1), ml: "200" }).success).toBe(false);
  });
});

describe("pesagem", () => {
  const p = { data: hoje, pesoKg: "90,5", massaMagraKg: "", cinturaCm: "" };
  it("aceita pesos nos limites (20 a 400 kg)", () => {
    expect(pesagemSchema.parse(p).pesoKg).toBe(90.5);
    expect(pesagemSchema.safeParse({ ...p, pesoKg: "20" }).success).toBe(true);
    expect(pesagemSchema.safeParse({ ...p, pesoKg: "400" }).success).toBe(true);
  });
  it.each([
    ["peso 19,9", { pesoKg: "19,9" }],
    ["peso 400,1", { pesoKg: "400,1" }],
    ["peso com 2 casas", { pesoKg: "90,55" }],
    ["peso vazio", { pesoKg: "" }],
    ["massa magra 4,9", { massaMagraKg: "4,9" }],
    ["massa magra 300,1", { pesoKg: "400", massaMagraKg: "300,1" }],
    ["massa magra maior que o peso", { pesoKg: "80", massaMagraKg: "85" }],
    ["cintura 29,9", { cinturaCm: "29,9" }],
    ["cintura 300,1", { cinturaCm: "300,1" }],
    ["dia futuro", { data: somarDias(hoje, 1) }],
  ])("recusa %s", (_, extra) => {
    expect(pesagemSchema.safeParse({ ...p, ...extra }).success).toBe(false);
  });
});
