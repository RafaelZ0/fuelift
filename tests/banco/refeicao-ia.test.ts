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
import { alimentosBase, alimentosUsuario, medidas, perfis, registrosAlimentares } from "@/lib/db/schema";
import { criarAlimentoUsuario } from "@/lib/dal/alimentos";
import { registrarAceiteIa } from "@/lib/dal/ia";
import { garantirPerfil } from "@/lib/dal/perfil";
import { casarItens } from "@/lib/dal/refeicao-ia";
import { usoDoDia } from "@/lib/dal/ia";
import { hojeSaoPaulo } from "@/lib/datas";
import { LIMITE_DIARIO } from "@/lib/ia/config";
import { ErroIa, type PedidoIa, type ProvedorIa } from "@/lib/ia/provedor";
import { definirProvedorDeTeste } from "@/lib/ia/provedor-ativo";
import { confirmarEstimativa, estimarAlimento, interpretarRefeicao, salvarRefeicaoIa } from "@/app/(app)/comida/ia/actions";

let chamadas: PedidoIa[] = [];
let resposta: () => Promise<unknown> = async () => ({ itens: [] });
const falso: ProvedorIa = {
  async gerar(p) {
    chamadas.push(p);
    return resposta();
  },
};

const item = (extra: Record<string, unknown> = {}) => ({ nome: "arroz integral cozido", quantidade: 3, unidade: "colheres", gramas: 75, confianca: "media", ...extra });
const formTexto = (texto: string) => {
  const f = new FormData();
  f.set("texto", texto);
  return f;
};

let arrozTaco: string;
let meuAlimentoA: string;
let alimentoDeB: string;

beforeAll(async () => {
  process.env.GEMINI_API_KEY = "chave-de-teste-nao-usada";
  delete process.env.IA_SOMENTE_ADMIN;
  await garantirPerfil(A);
  await garantirPerfil(B);
  await registrarAceiteIa(A, 1);
  await registrarAceiteIa(B, 1);
  definirProvedorDeTeste(falso);
  const [a] = await db.select({ id: alimentosBase.id }).from(alimentosBase).where(eq(alimentosBase.nome, "Arroz, integral, cozido")).limit(1);
  arrozTaco = a.id;
  meuAlimentoA = await criarAlimentoUsuario(A, { nome: "Pão de queijo da vovó", marca: null, kcal: 330, proteinaG: 6, carboG: 45, gorduraG: 14, fibraG: 1, sodioMg: 600 });
  alimentoDeB = await criarAlimentoUsuario(B, { nome: "Bolo secreto do B", marca: null, kcal: 400, proteinaG: 5, carboG: 60, gorduraG: 15, fibraG: 1, sodioMg: 100 });
}, 90_000);

afterAll(async () => {
  definirProvedorDeTeste(null);
  await db.delete(perfis).where(inArray(perfis.userId, [A, B]));
});

beforeEach(() => {
  sessao.userId = A;
  chamadas = [];
  resposta = async () => ({ itens: [] });
});

describe("casamento com o banco", () => {
  it("acha TACO e alimentos do próprio usuário, com fallback de palavras", async () => {
    const [arroz, pao, nada] = await casarItens(A, [{ nome: "arroz integral cozido" }, { nome: "pão de queijo" }, { nome: "zzqqxx yyww" }]);
    expect(arroz[0].nome).toBe("Arroz, integral, cozido");
    expect(pao.some((c) => c.id === meuAlimentoA && c.tipo === "usuario")).toBe(true);
    expect(nada).toEqual([]);
    const [fallback] = await casarItens(A, [{ nome: "arroz branco cozido extra" }]);
    expect(fallback.length).toBeGreaterThan(0);
  });

  it("frango não vira carne bovina: o candidato principal tem a palavra frango", async () => {
    const [frango] = await casarItens(A, [{ nome: "filé de frango grelhado" }]);
    expect(frango.length).toBeGreaterThan(0);
    expect(frango[0].nome.toLowerCase()).toContain("frango");
    expect(frango[0].cobertura).toBe(1);
  });

  it("nunca mostra alimento de outro usuário", async () => {
    const [bolo] = await casarItens(A, [{ nome: "bolo secreto" }]);
    expect(bolo.some((c) => c.id === alimentoDeB)).toBe(false);
  });
});

describe("interpretar o texto", () => {
  it("devolve itens com candidatos do banco; só o texto digitado vai à IA", async () => {
    resposta = async () => ({ itens: [item(), item({ nome: "pão de queijo", gramas: 50 })] });
    const r = await interpretarRefeicao({}, formTexto("almocei 3 colheres de arroz integral e um pão de queijo"));
    expect(r.erro).toBeUndefined();
    expect(r.itens).toHaveLength(2);
    expect(r.itens![0].candidatos[0].id).toBe(arrozTaco);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].texto).toContain("almocei 3 colheres");
    expect(chamadas[0].texto).not.toMatch(/@|user_id|uuid/i);
    expect(chamadas[0].arquivos).toEqual([]);
  });

  it("sem aceite, a IA não é chamada nem o uso é contado", async () => {
    sessao.userId = randomUUID();
    await db.insert(perfis).values({ userId: sessao.userId });
    try {
      const r = await interpretarRefeicao({}, formTexto("comi arroz"));
      expect(r.precisaAceite).toBe(true);
      expect(chamadas).toHaveLength(0);
    } finally {
      await db.delete(perfis).where(eq(perfis.userId, sessao.userId));
    }
  });

  it("texto curto, sem itens e resposta inválida", async () => {
    expect((await interpretarRefeicao({}, formTexto("a"))).erro).toMatch(/Escreva/);
    expect(chamadas).toHaveLength(0);
    resposta = async () => ({ itens: [] });
    expect((await interpretarRefeicao({}, formTexto("fui ao cinema ontem"))).erro).toMatch(/Não encontrei comida/);
    resposta = async () => "lixo";
    expect((await interpretarRefeicao({}, formTexto("comi arroz"))).erro).toMatch(/não conseguiu entender/);
  });

  it("falha do provedor devolve a chamada ao saldo", async () => {
    const antes = (await usoDoDia(A, hojeSaoPaulo(), "texto")).usadas;
    resposta = async () => {
      throw new ErroIa("indisponivel");
    };
    expect((await interpretarRefeicao({}, formTexto("comi arroz"))).erro).toMatch(/não respondeu/);
    resposta = async () => {
      throw new ErroIa("limite_provedor");
    };
    expect((await interpretarRefeicao({}, formTexto("comi arroz"))).erro).toMatch(/muitos pedidos/);
    expect((await usoDoDia(A, hojeSaoPaulo(), "texto")).usadas).toBe(antes);
  });

  it("limite diário de interpretações", async () => {
    sessao.userId = B;
    resposta = async () => ({ itens: [item()] });
    for (let i = 0; i < LIMITE_DIARIO.texto; i++) expect((await interpretarRefeicao({}, formTexto("comi arroz integral"))).itens).toBeTruthy();
    const antes = chamadas.length;
    expect((await interpretarRefeicao({}, formTexto("comi arroz integral"))).erro).toMatch(/Você já usou/);
    expect(chamadas).toHaveLength(antes);
  });
});

describe("estimativa de alimento fora do banco", () => {
  const boa = { nome: "Pastel de feira", kcal: 330, proteina_g: 6, carbo_g: 40, gordura_g: 16, fibra_g: 1, sodio_mg: 400, medidas: [{ nome: "unidade", gramas: 120 }] };

  it("estima sob demanda e não grava nada", async () => {
    resposta = async () => boa;
    const antes = await db.select().from(alimentosUsuario).where(eq(alimentosUsuario.userId, A));
    const r = await estimarAlimento({}, (() => { const f = new FormData(); f.set("nome", "pastel de feira"); return f; })());
    expect(r.estimativa).toMatchObject({ nome: "Pastel de feira", inconsistente: false });
    expect((await db.select().from(alimentosUsuario).where(eq(alimentosUsuario.userId, A))).length).toBe(antes.length);
    expect(chamadas[0].texto).toContain("pastel de feira");
  });

  it("estimativa fora dos limites é recusada", async () => {
    resposta = async () => ({ nome: "x", kcal: 5000 });
    const f = new FormData();
    f.set("nome", "alimento estranho");
    expect((await estimarAlimento({}, f)).erro).toMatch(/não conseguiu estimar/);
  });

  it("confirmar cria um alimento do usuário com origem ia_estimativa e as medidas", async () => {
    const r = await confirmarEstimativa({ nome: "Pastel de feira", kcal: 330, proteinaG: 6, carboG: 40, gorduraG: 16, fibraG: 1, sodioMg: 400, medidas: [{ nome: "unidade", gramas: 120 }], confirmarDivergencia: false });
    expect(r.candidato).toMatchObject({ tipo: "usuario", nome: "Pastel de feira" });
    const [a] = await db.select().from(alimentosUsuario).where(eq(alimentosUsuario.id, r.candidato!.id));
    expect(a).toMatchObject({ userId: A, origem: "ia_estimativa" });
    const ms = await db.select().from(medidas).where(and(eq(medidas.userId, A), eq(medidas.alimentoUsuarioId, a.id)));
    expect(ms.map((m) => m.nome)).toEqual(["unidade"]);
  });

  it("conta que não fecha pede confirmação; valores absurdos são recusados", async () => {
    const base = { nome: "Alimento duvidoso", kcal: 50, proteinaG: 10, carboG: 40, gorduraG: 20, fibraG: null, sodioMg: null, medidas: [], confirmarDivergencia: false };
    expect((await confirmarEstimativa(base)).erro).toMatch(/não batem/);
    expect((await confirmarEstimativa({ ...base, confirmarDivergencia: true })).candidato).toBeTruthy();
    expect((await confirmarEstimativa({ ...base, kcal: 950 })).erro).toBeTruthy();
    expect((await confirmarEstimativa({ ...base, proteinaG: 80, carboG: 80, kcal: 500, confirmarDivergencia: true })).erro).toMatch(/passam de 100/);
    expect((await confirmarEstimativa({ nome: "", kcal: 1 })).erro).toBeTruthy();
    expect((await confirmarEstimativa("lixo")).erro).toBeTruthy();
  });
});

describe("salvar a refeição confirmada", () => {
  const form = (itens: unknown, extra: Record<string, string> = {}) => {
    const f = new FormData();
    f.set("data", "2026-01-15");
    f.set("refeicao", "almoco");
    f.set("itens", typeof itens === "string" ? itens : JSON.stringify(itens));
    for (const [k, v] of Object.entries(extra)) f.set(k, v);
    return f;
  };
  const registros = (uid: string) => db.select().from(registrosAlimentares).where(and(eq(registrosAlimentares.userId, uid), eq(registrosAlimentares.data, "2026-01-15")));

  it("grava com snapshot calculado pelo banco e origem ia_texto, e redireciona ao diário", async () => {
    await expect(salvarRefeicaoIa({}, form([{ tipo: "base", alimentoId: arrozTaco, gramas: 150 }, { tipo: "usuario", alimentoId: meuAlimentoA, gramas: 50 }]))).rejects.toThrow("REDIRECT:/comida?data=2026-01-15");
    const rs = await registros(A);
    expect(rs).toHaveLength(2);
    expect(rs.every((r) => r.origem === "ia_texto")).toBe(true);
    const pao = rs.find((r) => r.alimentoUsuarioId === meuAlimentoA)!;
    expect(Number(pao.kcal)).toBeCloseTo(165, 0); // 330 kcal/100 g × 50 g, calculado no servidor
    expect(Number(pao.gramas)).toBe(50);
  });

  it("alimento de outro usuário é recusado e nada é gravado", async () => {
    const antes = (await registros(A)).length;
    const r = await salvarRefeicaoIa({}, form([{ tipo: "base", alimentoId: arrozTaco, gramas: 100 }, { tipo: "usuario", alimentoId: alimentoDeB, gramas: 100 }]));
    expect(r.erro).toMatch(/não foi encontrado/);
    expect((await registros(A)).length).toBe(antes); // nem o primeiro item foi gravado
    expect((await registros(B)).length).toBe(0);
  });

  it.each([
    ["sem itens", []],
    ["gramas zero", [{ tipo: "base", alimentoId: randomUUID(), gramas: 0 }]],
    ["gramas acima de 5 kg", [{ tipo: "base", alimentoId: randomUUID(), gramas: 6000 }]],
    ["id que não é uuid", [{ tipo: "base", alimentoId: "1; drop table x", gramas: 10 }]],
    ["tipo inventado", [{ tipo: "outro", alimentoId: randomUUID(), gramas: 10 }]],
    ["itens demais", Array.from({ length: 21 }, () => ({ tipo: "base", alimentoId: randomUUID(), gramas: 10 }))],
    ["JSON quebrado", "{não é json"],
  ])("rascunho adulterado: %s", async (_, itens) => {
    const r = await salvarRefeicaoIa({}, form(itens));
    expect(r.erro).toBeTruthy();
  });

  it("data futura, refeição inválida e alimento inexistente são recusados", async () => {
    const amanha = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
    expect((await salvarRefeicaoIa({}, form([{ tipo: "base", alimentoId: arrozTaco, gramas: 10 }], { data: amanha }))).erro).toMatch(/futuros/);
    expect((await salvarRefeicaoIa({}, form([{ tipo: "base", alimentoId: arrozTaco, gramas: 10 }], { refeicao: "madrugada" }))).erro).toBeTruthy();
    expect((await salvarRefeicaoIa({}, form([{ tipo: "base", alimentoId: randomUUID(), gramas: 10 }]))).erro).toMatch(/não foi encontrado/);
  });
});
