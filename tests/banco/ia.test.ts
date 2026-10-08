import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { agendaTreino, catalogoExercicios, exercicios, perfis, planosTreino, treinoExercicios, treinos, usoIa } from "@/lib/db/schema";
import { buscarNoCatalogo, idsComFoto, ligarAoCatalogo, nomeDoCatalogo } from "@/lib/dal/catalogo";
import { consumirUsoIa, devolverUsoIa, obterAceiteIa, registrarAceiteIa, usoDoDia } from "@/lib/dal/ia";
import { garantirPerfil } from "@/lib/dal/perfil";
import { criarExercicio, listarExercicios, listarItensDoTreino, listarTreinos, obterAgenda, planoAtivo } from "@/lib/dal/treino";
import { exerciciosPorNome, gravarPlanoCompleto } from "@/lib/dal/treino-ia";
import { LIMITE_DIARIO } from "@/lib/ia/config";
import { montarPlanoParaGravar } from "@/lib/ia/plano";
import type { ExercicioRascunho, Rascunho } from "@/lib/ia/rascunho";

// Usuários fictícios, criados só durante o teste e apagados no final. Roda com o papel do app.
const A = randomUUID();
const B = randomUUID();
const DIA = "2026-02-10";

const ex = (extra: Partial<ExercicioRascunho> = {}): ExercicioRascunho => ({
  nomePt: "Supino reto", nomeEn: "Barbell Bench Press", grupo: "Peito", series: 3, repsMin: 8, repsMax: 12, descansoS: 90,
  unilateral: false, cargaPorHalter: false, medida: "repeticoes", observacao: null, fotoId: null, fotoNome: null, ...extra,
});
const rascunho = (nome: string, treinosR: Rascunho["treinos"]): Rascunho => ({ nome, treinos: treinosR, alertas: [] });

beforeAll(async () => {
  await garantirPerfil(A);
  await garantirPerfil(B);
}, 90_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B])); // cascata em tudo do usuário
});

describe("aceite da IA", () => {
  it("começa sem aceite, registra a versão e isola por usuário", async () => {
    expect(await obterAceiteIa(A)).toBeNull();
    await registrarAceiteIa(A, 1);
    expect((await obterAceiteIa(A))?.versao).toBe(1);
    expect(await obterAceiteIa(B)).toBeNull();
  });
});

describe("limite diário de uso da IA", () => {
  it("conta até o limite e recusa depois, sem passar dele", async () => {
    for (let i = 0; i < LIMITE_DIARIO.plano; i++) expect(await consumirUsoIa(A, DIA, "plano")).toBe(true);
    expect(await consumirUsoIa(A, DIA, "plano")).toBe(false);
    expect((await usoDoDia(A, DIA, "plano")).usadas).toBe(LIMITE_DIARIO.plano);
  });

  it("é independente por usuário, por tipo e por dia", async () => {
    expect(await consumirUsoIa(B, DIA, "plano")).toBe(true);
    expect(await consumirUsoIa(A, DIA, "importacao")).toBe(true);
    expect(await consumirUsoIa(A, "2026-02-11", "plano")).toBe(true);
  });

  it("chamadas simultâneas nunca ultrapassam o limite", async () => {
    const r = await Promise.all(Array.from({ length: 10 }, () => consumirUsoIa(B, "2026-02-12", "importacao")));
    expect(r.filter(Boolean)).toHaveLength(LIMITE_DIARIO.importacao);
    expect((await usoDoDia(B, "2026-02-12", "importacao")).usadas).toBe(LIMITE_DIARIO.importacao);
  });

  it("devolver libera uma chamada e nunca fica negativo", async () => {
    await devolverUsoIa(A, DIA, "plano");
    expect(await consumirUsoIa(A, DIA, "plano")).toBe(true);
    await devolverUsoIa(A, "2026-03-01", "plano");
    expect((await usoDoDia(A, "2026-03-01", "plano")).usadas).toBe(0);
  });

  it("o banco recusa tipo inválido", async () => {
    await expect(db.insert(usoIa).values({ userId: A, data: DIA, tipo: "outro", chamadas: 1 })).rejects.toThrow();
  });
});

describe("catálogo de exercícios (só leitura para o app)", () => {
  it("busca em português e em inglês", async () => {
    const pt = await buscarNoCatalogo("supino");
    expect(pt.length).toBeGreaterThan(0);
    expect(pt.every((r) => /bench/i.test(r.nomeEn))).toBe(true);
    expect((await buscarNoCatalogo("Bench Press")).length).toBeGreaterThan(0);
    expect(await buscarNoCatalogo("   ")).toEqual([]);
  });

  it("coringas do LIKE no texto do usuário são literais", async () => {
    expect(await buscarNoCatalogo("%")).toEqual([]);
    expect(await buscarNoCatalogo("_____")).toEqual([]);
  });

  it("liga nomes em inglês ao catálogo; nomes sem semelhança ficam sem ligação", async () => {
    const [achou, nao] = await ligarAoCatalogo(["Barbell Bench Press - Medium Grip", "zzzz qqqq xxxx"]);
    expect(achou?.id).toBeTruthy();
    expect(nao).toBeNull();
    const id = achou!.id;
    expect(await nomeDoCatalogo(id)).toBeTruthy();
    expect((await idsComFoto([id, "Inventado_123"])).has("Inventado_123")).toBe(false);
    expect((await idsComFoto([id])).has(id)).toBe(true);
  });

  it("o app não consegue escrever no catálogo", async () => {
    await expect(db.insert(catalogoExercicios).values({ id: "Teste_X", nomeEn: "x", nomeBusca: "x" })).rejects.toThrow();
    await expect(db.update(catalogoExercicios).set({ nomeEn: "hack" }).where(eq(catalogoExercicios.id, "qualquer"))).rejects.toThrow();
    await expect(db.delete(catalogoExercicios).where(eq(catalogoExercicios.id, "qualquer"))).rejects.toThrow();
  });
});

describe("plano criado pela IA", () => {
  it("grava plano, treinos, exercícios, itens e agenda; o anterior fica inativo", async () => {
    const antigoExB = await criarExercicio(B, { nome: "Supino reto", grupo: null, unilateral: false, cargaPorHalter: false, medida: "repeticoes", fotoId: null });
    const existentes = await exerciciosPorNome(B);
    const p1 = montarPlanoParaGravar(rascunho("Plano 1", [{ nome: "A", foco: null, diaSugerido: 1, exercicios: [ex(), ex({ nomePt: "Remada" })] }]), existentes, new Set(), DIA);
    const id1 = await gravarPlanoCompleto(B, p1);
    expect((await planoAtivo(B))?.id).toBe(id1);
    const t = await listarTreinos(B, id1);
    expect(t).toHaveLength(1);
    const itens = await listarItensDoTreino(B, t[0].id);
    expect(itens.map((i) => i.exercicio.nome)).toEqual(["Supino reto", "Remada"]);
    expect(itens[0].exercicio.id).toBe(antigoExB); // reaproveitou o existente
    expect([...(await obterAgenda(B)).keys()]).toEqual([1]);

    const p2 = montarPlanoParaGravar(rascunho("Plano 2", [{ nome: "B", foco: null, diaSugerido: 4, exercicios: [ex({ nomePt: "Agachamento" })] }]), await exerciciosPorNome(B), new Set(), DIA);
    const id2 = await gravarPlanoCompleto(B, p2);
    expect((await planoAtivo(B))?.id).toBe(id2);
    expect([...(await obterAgenda(B)).keys()]).toEqual([4]); // agenda recriada, não misturada
    const inativos = await db.select().from(planosTreino).where(eq(planosTreino.userId, B));
    expect(inativos.filter((x) => x.ativo)).toHaveLength(1);
    expect(inativos).toHaveLength(2);
  });

  it("não afeta o plano nem a agenda de outro usuário", async () => {
    const pA = montarPlanoParaGravar(rascunho("Plano A", [{ nome: "A", foco: null, diaSugerido: 2, exercicios: [ex()] }]), new Map(), new Set(), DIA);
    const idA = await gravarPlanoCompleto(A, pA);
    await gravarPlanoCompleto(B, montarPlanoParaGravar(rascunho("Outro B", [{ nome: "X", foco: null, diaSugerido: 5, exercicios: [ex()] }]), await exerciciosPorNome(B), new Set(), DIA));
    expect((await planoAtivo(A))?.id).toBe(idA);
    expect([...(await obterAgenda(A)).keys()]).toEqual([2]);
  });

  it("é tudo ou nada: um item inválido não deixa plano pela metade", async () => {
    const antes = await db.select({ id: planosTreino.id }).from(planosTreino).where(eq(planosTreino.userId, A));
    const p = montarPlanoParaGravar(rascunho("Quebrado", [{ nome: "Q", foco: null, diaSugerido: null, exercicios: [ex({ nomePt: "Novo ruim" })] }]), new Map(), new Set(), DIA);
    p.itens[0].repsMax = 2; // viola reps_max >= reps_min (repsMin 8)
    await expect(gravarPlanoCompleto(A, p)).rejects.toThrow();
    const depois = await db.select({ id: planosTreino.id }).from(planosTreino).where(eq(planosTreino.userId, A));
    expect(depois).toHaveLength(antes.length);
    expect((await planoAtivo(A))?.nome).toBe("Plano A"); // o plano ativo anterior continua ativo
    expect((await listarExercicios(A)).some((e) => e.nome === "Novo ruim")).toBe(false);
    expect((await db.select().from(treinos).where(eq(treinos.userId, A))).some((t) => t.nome === "Q")).toBe(false);
  });

  it("o banco recusa ligar um exercício de outro usuário", async () => {
    const [exOutro] = await listarExercicios(B);
    const p = montarPlanoParaGravar(rascunho("Invasor", [{ nome: "I", foco: null, diaSugerido: null, exercicios: [ex({ nomePt: "Qualquer coisa" })] }]), new Map(), new Set(), DIA);
    p.itens[0].exercicioId = exOutro.id; // pertence a B, o plano é de A
    await expect(gravarPlanoCompleto(A, p)).rejects.toThrow();
    expect((await db.select().from(treinoExercicios).where(eq(treinoExercicios.userId, A))).every((i) => i.exercicioId !== exOutro.id)).toBe(true);
    expect((await db.select().from(agendaTreino).where(eq(agendaTreino.userId, A))).length).toBe(1);
    expect((await db.select().from(exercicios).where(eq(exercicios.userId, A))).length).toBeGreaterThan(0);
  });
});
