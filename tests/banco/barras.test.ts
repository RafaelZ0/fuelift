import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { neon } from "@neondatabase/serverless";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const A = randomUUID();
const B = randomUUID();
const sessao = { userId: A, admin: null };
let limiteOk = true;
let respostaOff: () => Promise<unknown> = async () => ({ status: "nao_encontrado" });
let consultas = 0;

vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: async () => sessao }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    const e = new Error(`REDIRECT:${destino}`) as Error & { digest: string };
    e.digest = "NEXT_REDIRECT;replace;" + destino;
    throw e;
  },
}));
vi.mock("@/lib/limites", () => ({ dentroDoLimite: async () => limiteOk }));
vi.mock("@/lib/off", async () => {
  const real = await vi.importActual<typeof import("@/lib/off")>("@/lib/off");
  return {
    ErroOff: real.ErroOff,
    consultarOff: async () => {
      consultas++;
      return respostaOff();
    },
  };
});

import { db } from "@/lib/db";
import { alimentosUsuario, perfis, produtosBarras, registrosAlimentares } from "@/lib/db/schema";
import { alimentoDoCodigo, copiarProdutoParaUsuario, guardarProdutoEmCache, obterProdutoEmCache } from "@/lib/dal/produtos";
import { garantirPerfil } from "@/lib/dal/perfil";
import { extrairProdutoOff, type ProdutoExtraido } from "@/lib/barras";
import { ErroOff } from "@/lib/off";
import { lerCodigoDeBarras } from "@/app/(app)/comida/barras/actions";
import { adicionar, salvarAlimento } from "@/app/(app)/comida/actions";


function codigoValido(base12: string): string {
  let soma = 0;
  for (let i = 0; i < 12; i++) soma += Number(base12[11 - i]) * (i % 2 === 0 ? 3 : 1);
  return base12 + ((10 - (soma % 10)) % 10);
}
const COD = {
  ok: codigoValido("789100010010"),
  nao: codigoValido("789100010020"),
  incompleto: codigoValido("789100010030"),
  suspeito: codigoValido("789100010040"),
  falha: codigoValido("789100010050"),
  velho: codigoValido("789100010060"),
};

const off = (nm: Record<string, unknown>, nome = "Produto de teste") => extrairProdutoOff({ status: 1, product: { product_name: nome, brands: "Marca", serving_quantity: 30, nutriments: nm } });
const completo = { "energy-kcal_100g": 325, proteins_100g: 7, carbohydrates_100g: 55, fat_100g: 8, fiber_100g: 1, sodium_100g: 0.1 };

const limparCache = async () => {
  // O app não apaga do cache (REVOKE): a limpeza usa o papel dono, só neste teste.
  const dono = neon(process.env.DATABASE_URL_MIGRACOES!);
  await dono.query("delete from produtos_barras where codigo = any($1)", [Object.values(COD)]);
};

beforeAll(async () => {
  await limparCache();
  await garantirPerfil(A);
  await garantirPerfil(B);
}, 90_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B]));
  await limparCache();
});

beforeEach(() => {
  sessao.userId = A;
  limiteOk = true;
  consultas = 0;
  respostaOff = async () => ({ status: "nao_encontrado" });
});

const destinoDe = async (cod: string): Promise<string> => {
  try {
    await lerCodigoDeBarras(cod, "2026-02-10", "almoco");
  } catch (e) {
    const m = (e as Error).message;
    if (m.startsWith("REDIRECT:")) return m.slice(9);
    throw e;
  }
  return "SEM_REDIRECT";
};

describe("cache compartilhado de produtos", () => {
  it("guarda produto, 'não encontrado' e atualiza na renovação", async () => {
    await guardarProdutoEmCache(COD.ok, off(completo));
    const p = await obterProdutoEmCache(COD.ok);
    expect(p).toMatchObject({ status: "encontrado", nome: "Produto de teste", incompleto: false, suspeito: false });
    expect(Number(p!.kcal)).toBe(325);
    await guardarProdutoEmCache(COD.ok, off({ ...completo, "energy-kcal_100g": 330 }, "Nome novo"));
    expect((await obterProdutoEmCache(COD.ok))?.nome).toBe("Nome novo");
    await guardarProdutoEmCache(COD.nao, { status: "nao_encontrado" } as ProdutoExtraido);
    expect((await obterProdutoEmCache(COD.nao))?.status).toBe("nao_encontrado");
  });

  it("o banco recusa dado fora dos limites e código inválido", async () => {
    await expect(db.insert(produtosBarras).values({ codigo: "123", status: "encontrado", nome: "x", kcal: 100 })).rejects.toThrow();
    await expect(db.insert(produtosBarras).values({ codigo: codigoValido("789100010099"), status: "encontrado", nome: "x", kcal: 950 })).rejects.toThrow();
    await expect(db.insert(produtosBarras).values({ codigo: codigoValido("789100010098"), status: "encontrado", nome: null })).rejects.toThrow();
    await expect(db.insert(produtosBarras).values({ codigo: codigoValido("789100010097"), status: "talvez" })).rejects.toThrow();
  });

  it("o app não consegue apagar nem esvaziar o cache", async () => {
    await expect(db.delete(produtosBarras).where(eq(produtosBarras.codigo, COD.ok))).rejects.toThrow();
  });
});

describe("cópia do produto para os alimentos do usuário", () => {
  it("cria um alimento privado com origem codigo_barras, sem duplicar", async () => {
    const p = (await obterProdutoEmCache(COD.ok))!;
    const id1 = await copiarProdutoParaUsuario(A, p);
    const id2 = await copiarProdutoParaUsuario(A, p);
    expect(id1).toBeTruthy();
    expect(id2).toBe(id1);
    const [a] = await db.select().from(alimentosUsuario).where(eq(alimentosUsuario.id, id1!));
    expect(a).toMatchObject({ userId: A, origem: "codigo_barras", codigoBarras: COD.ok });
  });

  it("é isolada por usuário: B não enxerga a cópia de A e ganha a própria", async () => {
    expect(await alimentoDoCodigo(B, COD.ok)).toBeNull();
    const p = (await obterProdutoEmCache(COD.ok))!;
    const idB = await copiarProdutoParaUsuario(B, p);
    expect(idB).not.toBe(await alimentoDoCodigo(A, COD.ok));
    expect(await alimentoDoCodigo(B, COD.ok)).toBe(idB);
  });

  it("produto sem calorias ou não encontrado não vira alimento", async () => {
    const naoAchado = (await obterProdutoEmCache(COD.nao))!;
    expect(await copiarProdutoParaUsuario(A, naoAchado)).toBeNull();
  });

  it("o banco recusa dois alimentos do mesmo usuário com o mesmo código", async () => {
    await expect(
      db.insert(alimentosUsuario).values({ userId: A, nome: "Duplicado", nomeBusca: "duplicado", kcal: 10, origem: "codigo_barras", codigoBarras: COD.ok }),
    ).rejects.toThrow();
  });
});

describe("leitura do código (Server Action)", () => {
  it("código inválido não consulta nada", async () => {
    for (const c of ["123", "7891000100104", "abc", null, 7891000100103]) {
      const r = await lerCodigoDeBarras(c, null, null);
      expect(r.erro).toMatch(/não parece válido/);
    }
    expect(consultas).toBe(0);
  });

  it("limite de leituras por minuto", async () => {
    limiteOk = false;
    expect((await lerCodigoDeBarras(COD.ok, null, null)).erro).toMatch(/Muitas leituras/);
    expect(consultas).toBe(0);
  });

  it("produto completo: consulta o OFF, guarda no cache e leva direto para o alimento do usuário", async () => {
    respostaOff = async () => off(completo, "Bolacha completa");
    const destino = await destinoDe(COD.velho);
    const meu = await alimentoDoCodigo(A, COD.velho);
    expect(meu).toBeTruthy();
    expect(destino).toBe(`/comida/alimento/usuario/${meu}?data=2026-02-10&refeicao=almoco`);
    expect(consultas).toBe(1);
    expect((await obterProdutoEmCache(COD.velho))?.nome).toBe("Bolacha completa");
  });

  it("segunda leitura do mesmo código usa o alimento do usuário, sem consultar de novo", async () => {
    const antes = consultas;
    await destinoDe(COD.velho);
    expect(consultas).toBe(antes);
  });

  it("outro usuário usa o cache compartilhado, sem consultar o OFF", async () => {
    sessao.userId = B;
    const destino = await destinoDe(COD.velho);
    expect(consultas).toBe(0);
    expect(destino).toMatch(/^\/comida\/alimento\/usuario\//);
    expect(await alimentoDoCodigo(B, COD.velho)).toBeTruthy();
  });

  it("produto não encontrado vai para o cadastro pelo rótulo", async () => {
    respostaOff = async () => ({ status: "nao_encontrado" }) as ProdutoExtraido;
    expect(await destinoDe(COD.nao)).toBe(`/comida/meus-alimentos/novo?data=2026-02-10&refeicao=almoco&codigo=${COD.nao}&motivo=nao_encontrado`);
  });

  it("produto incompleto ou que não fecha vai para conferência, sem criar alimento", async () => {
    respostaOff = async () => off({ "energy-kcal_100g": 100, carbohydrates_100g: 20 });
    expect(await destinoDe(COD.incompleto)).toContain("motivo=conferir");
    respostaOff = async () => off({ "energy-kcal_100g": 200, proteins_100g: 1, carbohydrates_100g: 2, fat_100g: 0 });
    expect(await destinoDe(COD.suspeito)).toContain("motivo=conferir");
    expect(await alimentoDoCodigo(A, COD.incompleto)).toBeNull();
    expect(await alimentoDoCodigo(A, COD.suspeito)).toBeNull();
  });

  it("falha do OFF sem cache: erro amigável e nada é guardado", async () => {
    respostaOff = async () => {
      throw new ErroOff();
    };
    const r = await lerCodigoDeBarras(COD.falha, null, null);
    expect(r.erro).toMatch(/Não consegui consultar/);
    expect(await obterProdutoEmCache(COD.falha)).toBeNull();
  });

  it("cache vencido e OFF fora do ar: usa o que já tinha", async () => {
    await guardarProdutoEmCache(COD.falha, off(completo, "Do cache velho"));
    await db.update(produtosBarras).set({ consultadoEm: new Date(Date.now() - 40 * 86_400_000) }).where(eq(produtosBarras.codigo, COD.falha));
    respostaOff = async () => {
      throw new ErroOff();
    };
    const destino = await destinoDe(COD.falha);
    expect(destino).toMatch(/^\/comida\/alimento\/usuario\//);
  });
});

describe("cadastro pelo rótulo com código e conta do rótulo (salvarAlimento)", () => {
  const form = (extra: Record<string, string> = {}) => {
    const f = new FormData();
    const base: Record<string, string> = { nome: "Biscoito teste", marca: "", porcaoG: "100", kcal: "450", proteinaG: "6", carboG: "70", gorduraG: "16", fibraG: "2", sodioMg: "", ...extra };
    for (const [k, v] of Object.entries(base)) f.set(k, v);
    return f;
  };

  it("calorias que não fecham com os macros pedem confirmação", async () => {
    const r = await salvarAlimento({}, form({ kcal: "45" })); // 200 em vez de 20: digitou 45 em vez de 450
    expect(r.divergencia).toBe(true);
    expect(r.erro).toMatch(/não batem/);
    expect((await db.select().from(alimentosUsuario).where(and(eq(alimentosUsuario.userId, A), eq(alimentosUsuario.nome, "Biscoito teste")))).length).toBe(0);
  });

  it("com a confirmação o alimento é salvo", async () => {
    await expect(salvarAlimento({}, form({ kcal: "45", confirmarDivergencia: "on", nome: "Biscoito confirmado" }))).rejects.toThrow("REDIRECT:/comida/alimento/usuario/");
    expect((await db.select().from(alimentosUsuario).where(eq(alimentosUsuario.nome, "Biscoito confirmado"))).length).toBe(1);
  });

  it("conta que fecha salva direto; com código vira alimento ligado ao código", async () => {
    const cod = codigoValido("789100010111");
    await expect(salvarAlimento({}, form({ nome: "Biscoito do código", codigo: cod }))).rejects.toThrow("REDIRECT:/comida/alimento/usuario/");
    const [a] = await db.select().from(alimentosUsuario).where(eq(alimentosUsuario.nome, "Biscoito do código"));
    expect(a).toMatchObject({ origem: "codigo_barras", codigoBarras: cod, userId: A });
    // Cadastrar de novo o mesmo código reaproveita o alimento.
    await expect(salvarAlimento({}, form({ nome: "Outro nome", codigo: cod }))).rejects.toThrow(`REDIRECT:/comida/alimento/usuario/${a.id}`);
    expect((await db.select().from(alimentosUsuario).where(and(eq(alimentosUsuario.userId, A), eq(alimentosUsuario.codigoBarras, cod)))).length).toBe(1);
  });

  it("código inválido no formulário é recusado", async () => {
    const r = await salvarAlimento({}, form({ nome: "Com código ruim", codigo: "123" }));
    expect(r.erro).toMatch(/Código de barras inválido/);
  });

  it("registrar um alimento de código de barras grava origem codigo_barras", async () => {
    const meu = (await alimentoDoCodigo(A, COD.velho))!;
    const f = new FormData();
    for (const [k, v] of Object.entries({ data: "2026-02-10", refeicao: "lanche", tipo: "usuario", alimentoId: meu, modo: "gramas", gramas: "30" })) f.set(k, v);
    await expect(adicionar({}, f)).rejects.toThrow("REDIRECT");
    const [r] = await db.select().from(registrosAlimentares).where(and(eq(registrosAlimentares.userId, A), eq(registrosAlimentares.alimentoUsuarioId, meu)));
    expect(r.origem).toBe("codigo_barras");
  });
});
