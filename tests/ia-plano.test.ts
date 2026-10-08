import { describe, expect, it } from "vitest";
import { montarPlanoParaGravar } from "@/lib/ia/plano";
import { escolherLigacao, termoParaCatalogo } from "@/lib/ia/catalogo";
import type { ExercicioRascunho, Rascunho } from "@/lib/ia/rascunho";

const ex = (extra: Partial<ExercicioRascunho> = {}): ExercicioRascunho => ({
  nomePt: "Supino reto", nomeEn: "Barbell Bench Press", grupo: "Peito", series: 3, repsMin: 8, repsMax: 12, descansoS: 90,
  unilateral: false, cargaPorHalter: false, medida: "repeticoes", observacao: null, fotoId: null, fotoNome: null, ...extra,
});
const rascunho = (treinos: Rascunho["treinos"]): Rascunho => ({ nome: "Plano IA", treinos, alertas: [] });
let n = 0;
const id = () => `id-${++n}`;

describe("montar plano para gravar", () => {
  it("cria plano, treinos, exercícios novos, itens e agenda", () => {
    n = 0;
    const r = rascunho([
      { nome: "A", foco: "Peito", diaSugerido: 1, exercicios: [ex(), ex({ nomePt: "Remada", fotoId: "Barbell_Row" })] },
      { nome: "B", foco: null, diaSugerido: 3, exercicios: [ex({ nomePt: "Agachamento" })] },
    ]);
    const p = montarPlanoParaGravar(r, new Map(), new Set(["Barbell_Row"]), "2026-10-08", id);
    expect(p.plano).toMatchObject({ nome: "Plano IA", inicio: "2026-10-08" });
    expect(p.treinos.map((t) => t.ordem)).toEqual([0, 1]);
    expect(p.exerciciosNovos).toHaveLength(3);
    expect(p.exerciciosNovos.find((e) => e.nome === "Remada")?.fotoId).toBe("Barbell_Row");
    expect(p.itens).toHaveLength(3);
    expect(p.agenda.map((a) => a.diaSemana)).toEqual([1, 3]);
  });

  it("reaproveita exercício existente pelo nome, sem acento ou maiúscula", () => {
    n = 0;
    const p = montarPlanoParaGravar(rascunho([{ nome: "A", foco: null, diaSugerido: null, exercicios: [ex({ nomePt: "SUPINO  Reto" })] }]), new Map([["supino reto", "ex-antigo"]]), new Set(), "2026-10-08", id);
    expect(p.exerciciosNovos).toHaveLength(0);
    expect(p.itens[0].exercicioId).toBe("ex-antigo");
  });

  it("o mesmo exercício em dois treinos é criado uma vez; repetido no mesmo treino é ignorado", () => {
    n = 0;
    const p = montarPlanoParaGravar(rascunho([
      { nome: "A", foco: null, diaSugerido: null, exercicios: [ex(), ex()] },
      { nome: "B", foco: null, diaSugerido: null, exercicios: [ex()] },
    ]), new Map(), new Set(), "2026-10-08", id);
    expect(p.exerciciosNovos).toHaveLength(1);
    expect(p.itens).toHaveLength(2);
  });

  it("dois treinos no mesmo dia: só o primeiro entra na agenda", () => {
    n = 0;
    const p = montarPlanoParaGravar(rascunho([
      { nome: "A", foco: null, diaSugerido: 2, exercicios: [ex()] },
      { nome: "B", foco: null, diaSugerido: 2, exercicios: [ex({ nomePt: "Remada" })] },
    ]), new Map(), new Set(), "2026-10-08", id);
    expect(p.agenda).toHaveLength(1);
    expect(p.agenda[0].treinoId).toBe(p.treinos[0].id);
  });

  it("foto que não está no catálogo é descartada", () => {
    n = 0;
    const p = montarPlanoParaGravar(rascunho([{ nome: "A", foco: null, diaSugerido: null, exercicios: [ex({ fotoId: "Inventada" })] }]), new Map(), new Set(["Outra"]), "2026-10-08", id);
    expect(p.exerciciosNovos[0].fotoId).toBeNull();
  });
});

describe("busca no catálogo", () => {
  it("traduz termos comuns do português", () => {
    expect(termoParaCatalogo("Supino inclinado com halteres")).toEqual(["bench", "press", "incline", "dumbbell"]);
    expect(termoParaCatalogo("barra fixa")).toEqual(["pull", "up"]);
    expect(termoParaCatalogo("Agachamento")).toEqual(["squat"]);
  });
  it("termo desconhecido é buscado como veio; vazio vira lista vazia", () => {
    expect(termoParaCatalogo("Bench Press")).toEqual(["bench", "press"]);
    expect(termoParaCatalogo("  ")).toEqual([]);
  });
  it("só liga sozinho com semelhança alta", () => {
    expect(escolherLigacao({ id: "a", nomeEn: "x", similaridade: 0.9 })?.id).toBe("a");
    expect(escolherLigacao({ id: "a", nomeEn: "x", similaridade: 0.4 })).toBeNull();
    expect(escolherLigacao(undefined)).toBeNull();
  });
});
