import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { alimentosBase, alimentosUsuario, fontesAlimentos, medidas, perfis, refeicoesSalvasItens, registrosAlimentares } from "@/lib/db/schema";
import {
  atualizarAlimentoUsuario,
  buscarAlimentos,
  criarAlimentoUsuario,
  excluirAlimentoUsuario,
  listarFavoritos,
  listarMeusAlimentos,
  listarRecentes,
  obterAlimento,
} from "@/lib/dal/alimentos";
import { alternarFavorito, criarMedida, ehFavorito, excluirMedida, listarMedidas, obterMedida } from "@/lib/dal/medidas";
import { criarRefeicaoSalva, excluirRefeicaoSalva, itensDaRefeicaoSalva, listarRefeicoesSalvas } from "@/lib/dal/refeicoes-salvas";
import { atualizarRegistro, criarRegistros, excluirRegistro, listarDia, obterRegistro } from "@/lib/dal/registros";
import { garantirPerfil } from "@/lib/dal/perfil";
import { montarRegistros } from "@/lib/diario";

// Usuários fictícios, criados só durante o teste e apagados no final. Roda com o papel do app.
const A = randomUUID();
const B = randomUUID();
const DIA = "2026-01-15";

const rotulo = { nome: "Granola da casa", marca: "Teste", kcal: 450, proteinaG: 10, carboG: 60, gorduraG: 15, fibraG: 8, sodioMg: 20 };
const nutr = { kcal: 100, proteinaG: 5, carboG: 10, gorduraG: 2, fibraG: 1 };

let arroz: string; // alimento da TACO
let feijao: string;
let alimentoB: string;
let medidaB: string;
let registroB: string;
let refeicaoB: string;

beforeAll(async () => {
  await garantirPerfil(A);
  await garantirPerfil(B);
  const base = await db
    .select({ id: alimentosBase.id, nome: alimentosBase.nome })
    .from(alimentosBase)
    .where(inArray(alimentosBase.codigoFonte, ["3", "561"]));
  arroz = base.find((x) => x.nome.startsWith("Arroz"))!.id;
  feijao = base.find((x) => !x.nome.startsWith("Arroz"))!.id;

  alimentoB = await criarAlimentoUsuario(B, rotulo);
  await criarMedida(B, "usuario", alimentoB, "pote", 40);
  medidaB = (await listarMedidas(B, "usuario", alimentoB))[0].id;
  await alternarFavorito(B, "usuario", alimentoB);
  await criarRegistros(B, [
    { data: DIA, refeicao: "cafe", tipo: "usuario", alimentoId: alimentoB, nome: rotulo.nome, gramas: 40, medidaTexto: null, nutrientes: nutr },
  ]);
  registroB = (await listarDia(B, DIA))[0].id;
  refeicaoB = await criarRefeicaoSalva(B, "Café de B", [
    { alimentoBaseId: null, alimentoUsuarioId: alimentoB, gramas: 40, medidaTexto: null },
  ]);
}, 60_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B])); // cascata em tudo do usuário
});

describe("alimentos do usuário", () => {
  it("A não lê, não altera e não apaga o alimento de B", async () => {
    expect(await obterAlimento(A, "usuario", alimentoB)).toBeNull();
    expect(await atualizarAlimentoUsuario(A, alimentoB, { ...rotulo, nome: "invadido" })).toBe(false);
    expect(await excluirAlimentoUsuario(A, alimentoB)).toBe(false);
    expect((await obterAlimento(B, "usuario", alimentoB))?.nome).toBe(rotulo.nome);
  });

  it("A não vê o alimento de B na busca nem na lista", async () => {
    expect((await buscarAlimentos(A, "granola casa")).some((x) => x.id === alimentoB)).toBe(false);
    expect((await buscarAlimentos(B, "granola casa")).some((x) => x.id === alimentoB)).toBe(true);
    expect(await listarMeusAlimentos(A)).toHaveLength(0);
  });

  it("todos leem a TACO", async () => {
    expect((await obterAlimento(A, "base", arroz))?.nome).toMatch(/^Arroz/);
  });
});

describe("medidas", () => {
  it("A não lê, não usa e não apaga a medida de B", async () => {
    expect(await listarMedidas(A, "usuario", alimentoB)).toHaveLength(0);
    expect(await obterMedida(A, medidaB)).toBeNull();
    expect(await excluirMedida(A, medidaB)).toBe(false);
    expect(await obterMedida(B, medidaB)).not.toBeNull();
  });

  it("o banco recusa A criar medida no alimento de B", async () => {
    await expect(criarMedida(A, "usuario", alimentoB, "colher", 10)).rejects.toThrow();
  });

  it("medida da TACO é por usuário", async () => {
    await criarMedida(A, "base", arroz, "minha concha", 140);
    expect(await listarMedidas(A, "base", arroz)).toHaveLength(1);
    expect(await listarMedidas(B, "base", arroz)).toHaveLength(0);
    expect(await criarMedida(A, "base", arroz, "Minha Concha", 150)).toBe("duplicada");
  });
});

describe("favoritos", () => {
  it("o banco recusa A favoritar o alimento de B", async () => {
    await expect(alternarFavorito(A, "usuario", alimentoB)).rejects.toThrow();
  });

  it("favoritos são por usuário", async () => {
    expect(await alternarFavorito(A, "base", feijao)).toBe(true);
    expect(await ehFavorito(A, "base", feijao)).toBe(true);
    expect(await ehFavorito(B, "base", feijao)).toBe(false);
    expect((await listarFavoritos(A)).some((x) => x.id === alimentoB)).toBe(false);
    expect(await alternarFavorito(A, "base", feijao)).toBe(false);
  });
});

describe("registros alimentares", () => {
  it("A não lê, não altera e não apaga o registro de B", async () => {
    expect(await obterRegistro(A, registroB)).toBeNull();
    expect(await listarDia(A, DIA)).toHaveLength(0);
    expect(await atualizarRegistro(A, registroB, "jantar", 999)).toBe(false);
    expect(await excluirRegistro(A, registroB)).toBe(false);
    expect((await obterRegistro(B, registroB))?.gramas).toBe(40);
  });

  it("o banco recusa A registrar usando o alimento de B", async () => {
    await expect(
      criarRegistros(A, [
        { data: DIA, refeicao: "cafe", tipo: "usuario", alimentoId: alimentoB, nome: "x", gramas: 10, medidaTexto: null, nutrientes: nutr },
      ]),
    ).rejects.toThrow();
  });

  it("recentes de A não mostram alimentos de B", async () => {
    expect((await listarRecentes(A)).some((x) => x.id === alimentoB)).toBe(false);
  });

  it("copiar/recalcular pula alimento de outro usuário", async () => {
    const r = await montarRegistros(A, DIA, "almoco", [
      { alimentoBaseId: null, alimentoUsuarioId: alimentoB, gramas: 40, medidaTexto: null },
      { alimentoBaseId: arroz, alimentoUsuarioId: null, gramas: 150, medidaTexto: null },
    ]);
    expect(r.pulados).toBe(1);
    expect(r.registros).toHaveLength(1);
    expect(r.registros[0].alimentoId).toBe(arroz);
  });

  it("editar reescala o snapshot", async () => {
    await criarRegistros(A, [
      { data: DIA, refeicao: "almoco", tipo: "base", alimentoId: arroz, nome: "Arroz", gramas: 100, medidaTexto: null, nutrientes: nutr },
    ]);
    const id = (await listarDia(A, DIA))[0].id;
    expect(await atualizarRegistro(A, id, "jantar", 150)).toBe(true);
    const r = await obterRegistro(A, id);
    expect(r?.kcal).toBe(150);
    expect(r?.proteinaG).toBe(7.5);
    expect(r?.refeicao).toBe("jantar");
  });

  it("apagar o alimento mantém o registro (snapshot) e o dono", async () => {
    const meu = await criarAlimentoUsuario(A, { ...rotulo, nome: "Bolo de teste" });
    await criarRegistros(A, [
      { data: DIA, refeicao: "lanche", tipo: "usuario", alimentoId: meu, nome: "Bolo de teste", gramas: 80, medidaTexto: null, nutrientes: nutr },
    ]);
    expect(await excluirAlimentoUsuario(A, meu)).toBe(true);
    const r = (await listarDia(A, DIA)).find((x) => x.nome === "Bolo de teste");
    expect(r?.kcal).toBe(100);
    expect(r?.alimentoUsuarioId).toBeNull();
    expect(r?.userId).toBe(A);
  });
});

describe("refeições salvas", () => {
  it("A não lê, não usa e não apaga a refeição de B", async () => {
    expect(await itensDaRefeicaoSalva(A, refeicaoB)).toBeNull();
    expect(await listarRefeicoesSalvas(A)).toHaveLength(0);
    expect(await excluirRefeicaoSalva(A, refeicaoB)).toBe(false);
    expect(await itensDaRefeicaoSalva(B, refeicaoB)).toHaveLength(1);
  });

  it("o banco recusa A salvar refeição com alimento de B", async () => {
    await expect(
      criarRefeicaoSalva(A, "roubada", [{ alimentoBaseId: null, alimentoUsuarioId: alimentoB, gramas: 10, medidaTexto: null }]),
    ).rejects.toThrow();
  });

  it("o banco recusa item de A dentro da refeição de B", async () => {
    await expect(
      db.insert(refeicoesSalvasItens).values({ refeicaoSalvaId: refeicaoB, userId: A, alimentoBaseId: arroz, gramas: 10 }),
    ).rejects.toThrow();
  });
});

describe("TACO é só leitura para o papel do app", () => {
  it("não insere, não altera e não apaga", async () => {
    await expect(
      db.insert(alimentosBase).values({ fonte: "taco", edicao: "4a-2011", codigoFonte: "9999", nome: "x", nomeBusca: "x" }),
    ).rejects.toThrow();
    await expect(db.update(alimentosBase).set({ kcal: 1 }).where(eq(alimentosBase.id, arroz))).rejects.toThrow();
    await expect(db.delete(alimentosBase).where(eq(alimentosBase.id, arroz))).rejects.toThrow();
    await expect(db.delete(fontesAlimentos)).rejects.toThrow();
  });
});

describe("CHECKs do banco nas tabelas novas", () => {
  it.each([
    ["kcal 901", { kcal: 901 }],
    ["proteína 101", { proteinaG: 101 }],
    ["macros somando mais de 100 g", { proteinaG: 50, carboG: 40, gorduraG: 20 }],
    ["nome vazio", { nome: "" }],
    ["sódio 40001", { sodioMg: 40001 }],
  ])("alimento do usuário: %s", async (_, extra) => {
    await expect(
      db.insert(alimentosUsuario).values({ ...rotulo, userId: A, nomeBusca: "x", ...extra }),
    ).rejects.toThrow();
  });

  it.each([
    ["gramas 0", { gramas: 0 }],
    ["gramas 2001", { gramas: 2001 }],
    ["nome com 41", { nome: "x".repeat(41) }],
  ])("medida: %s", async (_, extra) => {
    await expect(db.insert(medidas).values({ userId: A, alimentoBaseId: arroz, nome: "m", gramas: 10, ...extra })).rejects.toThrow();
  });

  it.each([
    ["kcal 10001", { kcal: 10001 }],
    ["gramas 5001", { gramas: 5001 }],
    ["data antes de 2000", { data: "1999-12-31" }],
    ["refeição inválida", { refeicao: "brunch" }],
    ["origem inválida", { origem: "outra" }],
  ])("registro: %s", async (_, extra) => {
    await expect(
      db.insert(registrosAlimentares).values({
        userId: A,
        data: DIA,
        refeicao: "cafe",
        alimentoBaseId: arroz,
        nome: "x",
        gramas: 10,
        kcal: 10,
        ...extra,
      }),
    ).rejects.toThrow();
  });

  it("medida precisa de exatamente um alimento", async () => {
    await expect(db.insert(medidas).values({ userId: A, nome: "m", gramas: 10 })).rejects.toThrow();
  });

  it("a busca usa o índice de trigramas", async () => {
    const plano = await db.execute(sql`select indexname from pg_indexes where indexname = 'alimentos_base_nome_busca_trgm'`);
    expect(plano.rows).toHaveLength(1);
  });
});
