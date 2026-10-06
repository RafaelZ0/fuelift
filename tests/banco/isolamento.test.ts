import { randomUUID } from "node:crypto";
import { inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { acessos, metas, perfis } from "@/lib/db/schema";
import {
  decidirAcesso,
  encerrarSessoesPorEmail,
  listarPendentes,
  registrarAcesso,
  sessoesValidasDesde,
  type Administrador,
} from "@/lib/dal/acessos";
import { sessaoAindaValida } from "@/lib/regras-sessao";
import { excluirMeta, historicoMetas, metaVigente, obterMeta, salvarMeta } from "@/lib/dal/metas";
import { atualizarPerfil, garantirPerfil, obterPerfil } from "@/lib/dal/perfil";
import type { DadosMeta } from "@/lib/validacao/metas";
import type { DadosPerfil } from "@/lib/validacao/perfil";

// Usuários fictícios criados só durante o teste e apagados no final.
const A = `teste-${randomUUID()}`;
const B = `teste-${randomUUID()}`;

const perfilBase: DadosPerfil = {
  nome: null,
  dataNascimento: null,
  sexo: null,
  alturaCm: null,
  nivelAtividade: null,
  inicioPlano: null,
};
const metaBase: DadosMeta = {
  kcal: null,
  proteinaG: null,
  carboG: null,
  gorduraG: null,
  aguaMl: null,
  pesoMetaKg: null,
  dataMeta: null,
  observacao: null,
};

let metaDeB: string;

beforeAll(async () => {
  await garantirPerfil(A);
  await garantirPerfil(B);
  await atualizarPerfil(A, { ...perfilBase, nome: "Usuário A", alturaCm: 170 });
  await atualizarPerfil(B, { ...perfilBase, nome: "Usuário B", alturaCm: 180.5 });
  await salvarMeta(A, { ...metaBase, kcal: 1800 }, "2026-01-01");
  metaDeB = (await salvarMeta(B, { ...metaBase, kcal: 2500, proteinaG: 160 }, "2026-01-01")).id;
});

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B])); // apaga metas em cascata
  await db.delete(acessos).where(inArray(acessos.userId, [A, B]));
});

describe("isolamento entre usuários: A não lê dados de B", () => {
  it("perfil: cada um lê só o próprio", async () => {
    expect((await obterPerfil(A))?.nome).toBe("Usuário A");
    expect((await obterPerfil(B))?.nome).toBe("Usuário B");
  });

  it("metas: A não obtém a meta de B pelo id", async () => {
    expect(await obterMeta(A, metaDeB)).toBeNull();
    expect((await obterMeta(B, metaDeB))?.kcal).toBe(2500);
  });

  it("metas: histórico e meta vigente de A não trazem linhas de B", async () => {
    const hist = await historicoMetas(A);
    expect(hist.length).toBeGreaterThan(0);
    expect(hist.every((m) => m.userId === A)).toBe(true);
    expect((await metaVigente(A, "2026-06-01"))?.kcal).toBe(1800);
  });
});

describe("isolamento entre usuários: A não altera dados de B", () => {
  it("perfil: atualizar A não muda B", async () => {
    await atualizarPerfil(A, { ...perfilBase, nome: "A editado" });
    expect((await obterPerfil(B))?.nome).toBe("Usuário B");
    expect((await obterPerfil(B))?.alturaCm).toBe(180.5);
  });

  it("metas: salvar meta de A na mesma data não sobrescreve a de B", async () => {
    await salvarMeta(A, { ...metaBase, kcal: 1900 }, "2026-01-01");
    expect((await obterMeta(B, metaDeB))?.kcal).toBe(2500);
  });

  it("acessos: administrador não altera o próprio acesso", async () => {
    await registrarAcesso(A, "a@teste.invalid", true);
    const adminA: Administrador = { userId: A, __admin: true };
    expect(await decidirAcesso(adminA, A, "recusado")).toBe(false);
  });

  it("acessos: novo registro não desfaz uma decisão já tomada", async () => {
    await registrarAcesso(B, "b@teste.invalid", false);
    const adminA: Administrador = { userId: A, __admin: true };
    expect(await decidirAcesso(adminA, B, "recusado")).toBe(true);
    expect((await registrarAcesso(B, "b@teste.invalid", false)).status).toBe("recusado");
    expect((await listarPendentes(adminA)).some((p) => p.userId === B)).toBe(false);
  });
});

describe("isolamento entre usuários: A não apaga dados de B", () => {
  it("metas: excluir com o id de B não apaga nada", async () => {
    expect(await excluirMeta(A, metaDeB)).toBe(false);
    expect(await obterMeta(B, metaDeB)).not.toBeNull();
  });

  it("ids inválidos são recusados sem consultar", async () => {
    expect(await obterMeta(A, "1 or 1=1")).toBeNull();
    expect(await excluirMeta(A, "' ; drop table metas; --")).toBe(false);
  });

  it("chamadas sem user_id são barradas", async () => {
    await expect(obterPerfil("")).rejects.toThrow();
    await expect(historicoMetas("")).rejects.toThrow();
  });
});

describe("histórico de metas", () => {
  it("nova meta vale a partir da data dela; a anterior continua no passado", async () => {
    await salvarMeta(A, { ...metaBase, kcal: 1700 }, "2026-03-01");
    expect((await metaVigente(A, "2026-02-15"))?.kcal).toBe(1900);
    expect((await metaVigente(A, "2026-03-01"))?.kcal).toBe(1700);
    expect(await metaVigente(A, "2025-12-31")).toBeNull();
  });

  it("salvar duas vezes no mesmo dia mantém uma linha só", async () => {
    await salvarMeta(A, { ...metaBase, kcal: 1750 }, "2026-03-01");
    const doDia = (await historicoMetas(A)).filter((m) => m.vigenteDesde === "2026-03-01");
    expect(doDia).toHaveLength(1);
    expect(doDia[0].kcal).toBe(1750);
  });
});

describe("CHECKs do banco recusam valores fora dos limites", () => {
  const casos: Array<[string, Partial<typeof metas.$inferInsert>]> = [
    ["kcal 499", { kcal: 499 }],
    ["kcal 10001", { kcal: 10001 }],
    ["proteína 501", { proteinaG: 501 }],
    ["carboidrato 1501", { carboG: 1501 }],
    ["gordura -1", { gorduraG: -1 }],
    ["água 10001", { aguaMl: 10001 }],
    ["peso-meta 19.9", { pesoMetaKg: 19.9 }],
    ["peso-meta 400.1", { pesoMetaKg: 400.1 }],
    ["observação 501", { observacao: "x".repeat(501) }],
  ];
  it.each(casos)("metas: %s", async (_, valores) => {
    await expect(
      db.insert(metas).values({ userId: A, vigenteDesde: "2030-01-01", ...valores }),
    ).rejects.toThrow();
  });

  it("perfis: altura e sexo fora dos limites", async () => {
    await expect(db.update(perfis).set({ alturaCm: 99 }).where(sql`${perfis.userId} = ${A}`)).rejects.toThrow();
    await expect(db.update(perfis).set({ sexo: "outro" }).where(sql`${perfis.userId} = ${A}`)).rejects.toThrow();
    await expect(
      db.update(perfis).set({ dataNascimento: "1899-12-31" }).where(sql`${perfis.userId} = ${A}`),
    ).rejects.toThrow();
  });
});

describe("troca de senha encerra as sessões só do próprio usuário", () => {
  it("marca A e não mexe em B", async () => {
    await registrarAcesso(A, "a@teste.invalid", true);
    await registrarAcesso(B, "b@teste.invalid", false);
    const sessaoAntiga = new Date(Date.now() - 60 * 60 * 1000);

    expect(await encerrarSessoesPorEmail("A@Teste.invalid")).toBe(1);

    const desdeA = await sessoesValidasDesde(A);
    expect(desdeA).not.toBeNull();
    expect(sessaoAindaValida(sessaoAntiga, desdeA)).toBe(false);
    expect(sessaoAindaValida(new Date(), desdeA)).toBe(true);

    expect(await sessoesValidasDesde(B)).toBeNull();
    expect(sessaoAindaValida(sessaoAntiga, await sessoesValidasDesde(B))).toBe(true);
  });

  it("e-mail sem conta não altera nada", async () => {
    expect(await encerrarSessoesPorEmail("ninguem@teste.invalid")).toBe(0);
  });
});
