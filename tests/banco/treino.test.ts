import { randomUUID } from "node:crypto";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { agua, agendaTreino, exercicios, perfis, pesagens, seriesTreino, sessoesTreino, treinos } from "@/lib/db/schema";
import { apagarAgua, desfazerUltimaAgua, listarAguaDoDia, registrarAgua, totalAguaDoDia } from "@/lib/dal/agua";
import { apagarPesagem, datasDeAplicacao, definirDiaAplicacao, listarPesagens, obterDiaAplicacao, registrarAplicacao, salvarPesagem } from "@/lib/dal/corpo";
import { garantirPerfil } from "@/lib/dal/perfil";
import {
  adicionarItem,
  adicionarSubstituto,
  apagarSerie,
  apagarSessao,
  atualizarExercicio,
  atualizarPlano,
  atualizarTreino,
  criarExercicio,
  criarPlano,
  criarTreino,
  definirAgenda,
  definirTroca,
  evolucaoDoExercicio,
  excluirExercicio,
  excluirTreino,
  listarExercicios,
  listarItensDoTreino,
  listarSeriesDoDia,
  listarTreinos,
  obterAgenda,
  obterExercicio,
  obterSessao,
  obterTreino,
  obterTrocas,
  planoAtivo,
  registrarFalta,
  removerItem,
  salvarSerie,
  ultimaSessaoDoExercicio,
} from "@/lib/dal/treino";

// Usuários fictícios, criados só durante o teste e apagados no final. Roda com o papel do app.
const A = randomUUID();
const B = randomUUID();
const DIA = "2026-02-10";

const ex = { nome: "Supino", grupo: "Peito", unilateral: false, cargaPorHalter: false, medida: "repeticoes" as const, fotoId: null };
const plano = { nome: "Plano B", inicio: "2026-02-02", seriesInicio: 2, seriesDepois: 3, semanasInicio: 3 };

let exB: string;
let exB2: string;
let planoB: string;
let treinoB: string;
let itemB: string;

beforeAll(async () => {
  await garantirPerfil(A);
  await garantirPerfil(B);
  exB = await criarExercicio(B, ex);
  exB2 = await criarExercicio(B, { ...ex, nome: "Crucifixo" });
  planoB = await criarPlano(B, plano);
  treinoB = await criarTreino(B, planoB, "Dia 1", "Peito");
  itemB = await adicionarItem(B, { treinoId: treinoB, exercicioId: exB, series: null, repsMin: 8, repsMax: 12, descansoS: 90, observacao: null });
  await definirAgenda(B, 2, treinoB);
  await salvarSerie(B, { data: DIA, treinoId: treinoB, exercicioId: exB, numero: 1, cargaKg: 40, repeticoes: 12, segundos: null, feito: true });
  await registrarAgua(B, DIA, 500);
  await salvarPesagem(B, DIA, { pesoKg: 90, massaMagraKg: 65, cinturaCm: 95 });
}, 90_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B])); // cascata em tudo do usuário
});

describe("exercícios", () => {
  it("A não lê, não altera e não apaga o exercício de B", async () => {
    expect(await obterExercicio(A, exB)).toBeNull();
    expect(await listarExercicios(A)).toHaveLength(0);
    expect(await atualizarExercicio(A, exB, { ...ex, nome: "invadido" })).toBe(false);
    expect(await excluirExercicio(A, exB)).toBe(false);
    expect((await obterExercicio(B, exB))?.nome).toBe("Supino");
  });
});

describe("plano, treinos e itens", () => {
  it("A não lê nem altera o plano e os treinos de B", async () => {
    expect(await planoAtivo(A)).toBeNull();
    expect(await listarTreinos(A, planoB)).toHaveLength(0);
    expect(await obterTreino(A, treinoB)).toBeNull();
    expect(await atualizarPlano(A, planoB, { ...plano, nome: "invadido" })).toBe(false);
    expect(await atualizarTreino(A, treinoB, "invadido", null)).toBe(false);
    expect(await excluirTreino(A, treinoB)).toBe(false);
    expect(await listarItensDoTreino(A, treinoB)).toHaveLength(0);
    expect(await removerItem(A, itemB)).toBe(false);
    expect((await obterTreino(B, treinoB))?.nome).toBe("Dia 1");
  });

  it("o banco recusa A criar treino no plano de B", async () => {
    await expect(criarTreino(A, planoB, "intruso", null)).rejects.toThrow();
  });

  it("o banco recusa A usar exercício e treino de B", async () => {
    const meuEx = await criarExercicio(A, ex);
    await expect(
      adicionarItem(A, { treinoId: treinoB, exercicioId: meuEx, series: null, repsMin: 8, repsMax: 12, descansoS: 60, observacao: null }),
    ).rejects.toThrow();
    const meuPlano = await criarPlano(A, plano);
    const meuTreino = await criarTreino(A, meuPlano, "Meu dia", null);
    await expect(
      adicionarItem(A, { treinoId: meuTreino, exercicioId: exB, series: null, repsMin: 8, repsMax: 12, descansoS: 60, observacao: null }),
    ).rejects.toThrow();
  });

  it("o banco recusa substituto de B no item de A, e a agenda e as trocas apontando para B", async () => {
    const meuEx = (await listarExercicios(A))[0].id;
    const meuTreino = (await listarTreinos(A, (await planoAtivo(A))!.id))[0].id;
    const meuItem = await adicionarItem(A, { treinoId: meuTreino, exercicioId: meuEx, series: 3, repsMin: 8, repsMax: 12, descansoS: 60, observacao: null });
    await expect(adicionarSubstituto(A, meuItem, exB2)).rejects.toThrow();
    await expect(adicionarSubstituto(A, itemB, meuEx)).rejects.toThrow();
    await expect(definirAgenda(A, 1, treinoB)).rejects.toThrow();
    await expect(definirTroca(A, DIA, treinoB)).rejects.toThrow();
  });

  it("agenda e trocas são por usuário", async () => {
    expect((await obterAgenda(B)).get(2)).toBe(treinoB);
    expect((await obterAgenda(A)).get(2)).toBeUndefined();
    await definirTroca(B, DIA, null);
    expect((await obterTrocas(B, "2026-02-01", "2026-02-28")).has(DIA)).toBe(true);
    expect((await obterTrocas(A, "2026-02-01", "2026-02-28")).size).toBe(0);
  });

  it("um plano ativo por usuário: criar outro desativa o anterior", async () => {
    const novo = await criarPlano(A, { ...plano, nome: "Plano novo" });
    expect((await planoAtivo(A))?.id).toBe(novo);
  });
});

describe("sessões e séries", () => {
  it("A não lê, não altera e não apaga a sessão e as séries de B", async () => {
    expect(await obterSessao(A, DIA)).toBeNull();
    expect(await listarSeriesDoDia(A, DIA)).toHaveLength(0);
    expect(await apagarSerie(A, DIA, exB, 1)).toBe(false);
    expect(await apagarSessao(A, DIA)).toBe(false);
    expect(await ultimaSessaoDoExercicio(A, exB, "2026-03-01")).toHaveLength(0);
    expect(await evolucaoDoExercicio(A, exB)).toHaveLength(0);
    expect(await listarSeriesDoDia(B, DIA)).toHaveLength(1);
  });

  it("o banco recusa A registrar série com exercício ou treino de B", async () => {
    await expect(
      salvarSerie(A, { data: "2026-02-11", treinoId: null, exercicioId: exB, numero: 1, cargaKg: 10, repeticoes: 10, segundos: null, feito: true }),
    ).rejects.toThrow();
    await expect(
      salvarSerie(A, { data: "2026-02-12", treinoId: treinoB, exercicioId: (await listarExercicios(A))[0].id, numero: 1, cargaKg: 10, repeticoes: 10, segundos: null, feito: true }),
    ).rejects.toThrow();
  });

  it("registrar série conta como treino feito; corrigir não duplica; falta troca o status", async () => {
    const meuEx = (await listarExercicios(A))[0].id;
    await salvarSerie(A, { data: "2026-02-20", treinoId: null, exercicioId: meuEx, numero: 1, cargaKg: 20, repeticoes: 10, segundos: null, feito: true });
    await salvarSerie(A, { data: "2026-02-20", treinoId: null, exercicioId: meuEx, numero: 1, cargaKg: 25, repeticoes: 8, segundos: null, feito: true });
    const series = await listarSeriesDoDia(A, "2026-02-20");
    expect(series).toHaveLength(1);
    expect(series[0]).toMatchObject({ cargaKg: 25, repeticoes: 8 });
    expect((await obterSessao(A, "2026-02-20"))?.status).toBe("feito");

    await registrarFalta(A, "2026-02-21", null, "trabalho", "reunião");
    expect(await obterSessao(A, "2026-02-21")).toMatchObject({ status: "faltou", motivo: "trabalho" });
    await salvarSerie(A, { data: "2026-02-21", treinoId: null, exercicioId: meuEx, numero: 1, cargaKg: 20, repeticoes: 10, segundos: null, feito: true });
    expect(await obterSessao(A, "2026-02-21")).toMatchObject({ status: "feito", motivo: null });
  });

  it("última sessão e evolução usam só a data anterior pedida", async () => {
    const meuEx = (await listarExercicios(A))[0].id;
    expect(await ultimaSessaoDoExercicio(A, meuEx, "2026-02-21")).toHaveLength(1);
    const evolucao = await evolucaoDoExercicio(A, meuEx);
    expect(evolucao.map((e) => e.data)).toEqual(["2026-02-20", "2026-02-21"]);
    expect(evolucao[0].cargaMax).toBe(25);
  });

  it("apagar o treino mantém a sessão no histórico, sem o vínculo", async () => {
    const plano2 = await criarPlano(A, { ...plano, nome: "Plano 3" });
    const t = await criarTreino(A, plano2, "Para apagar", null);
    const meuEx = (await listarExercicios(A))[0].id;
    await salvarSerie(A, { data: "2026-02-22", treinoId: t, exercicioId: meuEx, numero: 1, cargaKg: 10, repeticoes: 10, segundos: null, feito: true });
    expect(await excluirTreino(A, t)).toBe(true);
    const s = await obterSessao(A, "2026-02-22");
    expect(s?.status).toBe("feito");
    expect(s?.treinoId).toBeNull();
    expect(s?.userId).toBe(A);
  });
});

describe("água", () => {
  it("A não vê, não desfaz e não apaga a água de B", async () => {
    expect(await totalAguaDoDia(A, DIA)).toBe(0);
    expect(await desfazerUltimaAgua(A, DIA)).toBe(false);
    const [reg] = await listarAguaDoDia(B, DIA);
    expect(await apagarAgua(A, reg.id)).toBe(false);
    expect(await totalAguaDoDia(B, DIA)).toBe(500);
  });

  it("soma e desfaz só o último registro do próprio usuário", async () => {
    await registrarAgua(A, DIA, 300);
    await registrarAgua(A, DIA, 200);
    expect(await totalAguaDoDia(A, DIA)).toBe(500);
    expect(await desfazerUltimaAgua(A, DIA)).toBe(true);
    expect(await totalAguaDoDia(A, DIA)).toBe(300);
  });
});

describe("pesagens e aplicação", () => {
  it("A não lê nem apaga as pesagens de B", async () => {
    expect(await listarPesagens(A)).toHaveLength(0);
    const [p] = await listarPesagens(B);
    expect(await apagarPesagem(A, p.id)).toBe(false);
    expect(await listarPesagens(B)).toHaveLength(1);
  });

  it("uma pesagem por dia: salvar de novo atualiza", async () => {
    await salvarPesagem(A, DIA, { pesoKg: 80, massaMagraKg: null, cinturaCm: null });
    await salvarPesagem(A, DIA, { pesoKg: 79.5, massaMagraKg: 60, cinturaCm: 90 });
    const l = await listarPesagens(A);
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ pesoKg: 79.5, massaMagraKg: 60 });
  });

  it("aplicação e dia do lembrete são por usuário", async () => {
    await registrarAplicacao(A, DIA);
    await registrarAplicacao(A, DIA);
    expect(await datasDeAplicacao(A, "2026-01-01")).toEqual([DIA]);
    expect(await datasDeAplicacao(B, "2026-01-01")).toEqual([]);
    await definirDiaAplicacao(A, 3);
    expect(await obterDiaAplicacao(A)).toBe(3);
    expect(await obterDiaAplicacao(B)).toBeNull();
  });
});

describe("CHECKs do banco (fase 3A)", () => {
  const casos: Array<[string, () => Promise<unknown>]> = [
    ["carga 1001", () => db.insert(seriesTreino).values({ userId: B, sessaoId: randomUUID(), exercicioId: exB, numero: 1, cargaKg: 1001, repeticoes: 1 })],
    ["água 5001", () => db.insert(agua).values({ userId: A, data: DIA, ml: 5001 })],
    ["água 0", () => db.insert(agua).values({ userId: A, data: DIA, ml: 0 })],
    ["peso 19", () => db.insert(pesagens).values({ userId: A, data: "2026-03-01", pesoKg: 19 })],
    ["peso 401", () => db.insert(pesagens).values({ userId: A, data: "2026-03-02", pesoKg: 401 })],
    ["massa magra maior que o peso", () => db.insert(pesagens).values({ userId: A, data: "2026-03-03", pesoKg: 80, massaMagraKg: 90 })],
    ["cintura 29", () => db.insert(pesagens).values({ userId: A, data: "2026-03-04", pesoKg: 80, cinturaCm: 29 })],
    ["dia da semana 7", () => db.insert(agendaTreino).values({ userId: A, diaSemana: 7, treinoId: randomUUID() })],
    ["exercício com medida inválida", () => db.insert(exercicios).values({ userId: A, nome: "x", medida: "metros" })],
    ["foto com caracteres inválidos", () => db.insert(exercicios).values({ userId: A, nome: "x", fotoId: "../etc/passwd" })],
    ["falta com status inválido", () => db.insert(sessoesTreino).values({ userId: A, data: "2026-03-05", status: "talvez" })],
    ["motivo fora da lista", () => db.insert(sessoesTreino).values({ userId: A, data: "2026-03-06", status: "faltou", motivo: "preguiça" })],
    ["motivo em treino feito", () => db.insert(sessoesTreino).values({ userId: A, data: "2026-03-07", status: "feito", motivo: "trabalho" })],
    ["reps máximas menores que as mínimas", async () => {
      const id = (await listarTreinos(A, (await planoAtivo(A))!.id))[0]?.id ?? (await criarTreino(A, (await planoAtivo(A))!.id, "t", null));
      return adicionarItem(A, { treinoId: id, exercicioId: (await listarExercicios(A))[0].id, series: null, repsMin: 10, repsMax: 5, descansoS: 60, observacao: null });
    }],
    ["treino com ordem 31", async () => db.insert(treinos).values({ userId: A, planoId: (await planoAtivo(A))!.id, ordem: 31, nome: "x" })],
  ];
  it.each(casos)("recusa %s", async (_, inserir) => {
    await expect(inserir()).rejects.toThrow();
  });
});
