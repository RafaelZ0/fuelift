import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const A = randomUUID();
const B = randomUUID();
const sessao = { userId: A, admin: null };

vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: async () => sessao }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    const e = new Error(`REDIRECT:${destino}`) as Error & { digest: string };
    e.digest = "NEXT_REDIRECT;replace;" + destino;
    throw e;
  },
}));

import { db } from "@/lib/db";
import { alimentosBase, alimentosUsuario, medidas, perfis, receitaItens, receitas, registrosAlimentares } from "@/lib/db/schema";
import { criarAlimentoUsuario, excluirAlimentoUsuario } from "@/lib/dal/alimentos";
import { garantirPerfil } from "@/lib/dal/perfil";
import { excluirReceita, listarReceitas, obterReceita } from "@/lib/dal/receitas";
import { criarRegistros } from "@/lib/dal/registros";
import { excluirReceitaAcao, salvarReceita } from "@/app/(app)/comida/receitas/actions";

let arroz: string;
let farinha: string; // alimento do usuário
let alimentoDeB: string;

const corpo = (r: unknown, receitaId?: string) => {
  const f = new FormData();
  f.set("receita", typeof r === "string" ? r : JSON.stringify(r));
  if (receitaId) f.set("receitaId", receitaId);
  return f;
};
const salvar = async (r: unknown, receitaId?: string): Promise<string> => {
  try {
    const e = await salvarReceita({}, corpo(r, receitaId));
    throw new Error(`não redirecionou: ${e.erro}`);
  } catch (e) {
    const m = (e as Error).message;
    const x = /^REDIRECT:\/comida\/receitas\/([0-9a-f-]{36})/.exec(m);
    if (!x) throw e;
    return x[1];
  }
};
const base = () => ({
  nome: "Arroz com farinha",
  porcoes: 4,
  pesoFinalG: null as number | null,
  itens: [
    { tipo: "base", alimentoId: arroz, gramas: 400 },
    { tipo: "usuario", alimentoId: farinha, gramas: 100 },
  ],
});

beforeAll(async () => {
  await garantirPerfil(A);
  await garantirPerfil(B);
  const [a] = await db.select({ id: alimentosBase.id }).from(alimentosBase).where(eq(alimentosBase.nome, "Arroz, integral, cozido")).limit(1);
  arroz = a.id;
  farinha = await criarAlimentoUsuario(A, { nome: "Farinha de teste", marca: null, kcal: 360, proteinaG: 10, carboG: 75, gorduraG: 1.5, fibraG: 3, sodioMg: 2 });
  alimentoDeB = await criarAlimentoUsuario(B, { nome: "Segredo do B", marca: null, kcal: 300, proteinaG: 5, carboG: 50, gorduraG: 5, fibraG: 1, sodioMg: 1 });
}, 90_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B]));
});

beforeEach(() => {
  sessao.userId = A;
});

describe("criar receita", () => {
  let id: string;
  it("grava receita, itens com snapshot, alimento do usuário e a medida porção", async () => {
    id = await salvar(base());
    const r = (await obterReceita(A, id))!;
    expect(r.receita).toMatchObject({ nome: "Arroz com farinha", porcoes: 4, pesoFinalG: 500 });
    expect(r.itens).toHaveLength(2);
    expect(r.itens[0].nome).toBe("Arroz, integral, cozido");
    expect(r.itens[1].kcal).toBeCloseTo(360, 1); // 100 g de farinha
    const [a] = await db.select().from(alimentosUsuario).where(eq(alimentosUsuario.id, r.receita.alimentoUsuarioId!));
    expect(a).toMatchObject({ userId: A, origem: "receita", nome: "Arroz com farinha" });
    const totalKcal = r.itens.reduce((s, i) => s + (i.kcal ?? 0), 0);
    expect(a.kcal).toBeCloseTo((totalKcal / 500) * 100, 1);
    const ms = await db.select().from(medidas).where(and(eq(medidas.userId, A), eq(medidas.alimentoUsuarioId, a.id)));
    expect(ms.map((m) => [m.nome, m.gramas])).toEqual([["porção", 125]]);
  });

  it("aparece na lista com as calorias por 100 g", async () => {
    const l = await listarReceitas(A);
    expect(l.find((x) => x.id === id)?.kcalPor100g).toBeGreaterThan(0);
    expect((await listarReceitas(B)).some((x) => x.id === id)).toBe(false);
  });

  it("editar mantém o mesmo alimento, troca os itens e deixa uma única medida porção", async () => {
    const antes = (await obterReceita(A, id))!.receita.alimentoUsuarioId;
    const id2 = await salvar({ ...base(), nome: "Arroz com farinha v2", porcoes: 2, pesoFinalG: 450, itens: [{ tipo: "base", alimentoId: arroz, gramas: 300 }] }, id);
    expect(id2).toBe(id);
    const r = (await obterReceita(A, id))!;
    expect(r.receita.alimentoUsuarioId).toBe(antes);
    expect(r.itens).toHaveLength(1);
    const ms = await db.select().from(medidas).where(and(eq(medidas.userId, A), eq(medidas.alimentoUsuarioId, antes!)));
    expect(ms.map((m) => [m.nome, m.gramas])).toEqual([["porção", 225]]);
    const [a] = await db.select().from(alimentosUsuario).where(eq(alimentosUsuario.id, antes!));
    expect(a.nome).toBe("Arroz com farinha v2");
  });

  it("receita pode usar outra receita como ingrediente, mas não a si mesma", async () => {
    const alimentoReceita = (await obterReceita(A, id))!.receita.alimentoUsuarioId!;
    const idComposta = await salvar({ nome: "Prato composto", porcoes: 1, pesoFinalG: null, itens: [{ tipo: "usuario", alimentoId: alimentoReceita, gramas: 200 }] });
    expect(idComposta).not.toBe(id);
    const e = await salvarReceita({}, corpo({ ...base(), itens: [{ tipo: "usuario", alimentoId: alimentoReceita, gramas: 100 }] }, id));
    expect(e.erro).toMatch(/ingrediente dela mesma/);
  });
});

describe("segurança e validação", () => {
  it("ingrediente de outro usuário é recusado e nada é gravado", async () => {
    const antes = (await listarReceitas(A)).length;
    const e = await salvarReceita({}, corpo({ ...base(), itens: [{ tipo: "usuario", alimentoId: alimentoDeB, gramas: 100 }] }));
    expect(e.erro).toMatch(/não foi encontrado/);
    expect((await listarReceitas(A)).length).toBe(antes);
  });
  it.each([
    ["JSON quebrado", "{não é json"],
    ["sem nome", { ...({} as object), nome: " ", porcoes: 2, pesoFinalG: null, itens: [{ tipo: "base", alimentoId: randomUUID(), gramas: 10 }] }],
    ["sem itens", { nome: "X", porcoes: 2, pesoFinalG: null, itens: [] }],
    ["porções zero", { nome: "X", porcoes: 0, pesoFinalG: null, itens: [{ tipo: "base", alimentoId: randomUUID(), gramas: 10 }] }],
    ["gramas zero", { nome: "X", porcoes: 2, pesoFinalG: null, itens: [{ tipo: "base", alimentoId: randomUUID(), gramas: 0 }] }],
    ["gramas enormes", { nome: "X", porcoes: 2, pesoFinalG: null, itens: [{ tipo: "base", alimentoId: randomUUID(), gramas: 99999 }] }],
    ["id inválido", { nome: "X", porcoes: 2, pesoFinalG: null, itens: [{ tipo: "base", alimentoId: "1; drop table x", gramas: 10 }] }],
    ["itens demais", { nome: "X", porcoes: 2, pesoFinalG: null, itens: Array.from({ length: 41 }, () => ({ tipo: "base", alimentoId: randomUUID(), gramas: 10 })) }],
  ])("recusa %s", async (_, r) => {
    expect((await salvarReceita({}, corpo(r))).erro).toBeTruthy();
  });
  it("peso final impossível é recusado", async () => {
    const e = await salvarReceita({}, corpo({ ...base(), pesoFinalG: 50 }));
    expect(e.erro).toBeTruthy();
  });
  it("editar ou apagar receita de outro usuário não funciona", async () => {
    const id = await salvar({ ...base(), nome: "Da A" });
    sessao.userId = B;
    expect(await obterReceita(B, id)).toBeNull();
    expect((await salvarReceita({}, corpo(base(), id))).erro).toMatch(/não encontrada/);
    expect(await excluirReceita(B, id)).toBe(false);
    // A ação redireciona mesmo sem apagar nada; o que importa é que a receita da A continua lá.
    await expect(excluirReceitaAcao((() => { const f = new FormData(); f.set("receitaId", id); return f; })())).rejects.toThrow("REDIRECT");
    expect(await obterReceita(A, id)).not.toBeNull();
  });
});

describe("exclusões", () => {
  it("apagar um alimento usado como ingrediente funciona e o item mantém o snapshot", async () => {
    const f2 = await criarAlimentoUsuario(A, { nome: "Ingrediente temporário", marca: null, kcal: 200, proteinaG: 5, carboG: 30, gorduraG: 5, fibraG: 1, sodioMg: 0 });
    const id = await salvar({ nome: "Com temporário", porcoes: 2, pesoFinalG: null, itens: [{ tipo: "usuario", alimentoId: f2, gramas: 100 }] });
    expect(await excluirAlimentoUsuario(A, f2)).toBe(true);
    const r = (await obterReceita(A, id))!;
    expect(r.itens[0]).toMatchObject({ alimentoUsuarioId: null, nome: "Ingrediente temporário" });
    expect(r.itens[0].kcal).toBeCloseTo(200, 1);
  });
  it("apagar o alimento gerado deixa a receita sem vínculo, e salvar de novo recria", async () => {
    const id = await salvar({ ...base(), nome: "Receita sem alimento" });
    const alimento = (await obterReceita(A, id))!.receita.alimentoUsuarioId!;
    expect(await excluirAlimentoUsuario(A, alimento)).toBe(true);
    expect((await obterReceita(A, id))!.receita.alimentoUsuarioId).toBeNull();
    await salvar(base(), id);
    expect((await obterReceita(A, id))!.receita.alimentoUsuarioId).not.toBeNull();
  });
  it("apagar a receita apaga o alimento gerado, mas os registros antigos ficam", async () => {
    const id = await salvar({ ...base(), nome: "Receita para apagar" });
    const alimento = (await obterReceita(A, id))!.receita.alimentoUsuarioId!;
    await criarRegistros(A, [{ data: "2026-01-15", refeicao: "almoco", tipo: "usuario", alimentoId: alimento, nome: "Receita para apagar", gramas: 125, medidaTexto: "1 × porção", nutrientes: { kcal: 180, proteinaG: 6, carboG: 30, gorduraG: 3, fibraG: 2 } }]);
    await expect(excluirReceitaAcao((() => { const f = new FormData(); f.set("receitaId", id); return f; })())).rejects.toThrow("REDIRECT:/comida/receitas");
    expect(await obterReceita(A, id)).toBeNull();
    expect((await db.select().from(alimentosUsuario).where(eq(alimentosUsuario.id, alimento))).length).toBe(0);
    const regs = await db.select().from(registrosAlimentares).where(and(eq(registrosAlimentares.userId, A), eq(registrosAlimentares.nome, "Receita para apagar")));
    expect(regs).toHaveLength(1);
    expect(Number(regs[0].kcal)).toBe(180);
    expect((await db.select().from(receitaItens).where(eq(receitaItens.receitaId, id))).length).toBe(0);
    expect((await db.select().from(receitas).where(eq(receitas.id, id))).length).toBe(0);
  });
});
