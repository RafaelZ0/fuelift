import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { alimentosBase, medidasIbge, perfis } from "@/lib/db/schema";
import { criarAlimentoUsuario } from "@/lib/dal/alimentos";
import { criarMedida, listarMedidas } from "@/lib/dal/medidas";
import { sugestaoIbgeDoAlimento, sugestoesIbge } from "@/lib/dal/medidas-ibge";
import { garantirPerfil } from "@/lib/dal/perfil";

// Usuários fictícios, criados só durante o teste. Roda com o papel do app.
const A = randomUUID();
const B = randomUUID();
let paoFrances: string;
let arroz: string;
let alimentoB: string;

beforeAll(async () => {
  await garantirPerfil(A);
  await garantirPerfil(B);
  const base = await db
    .select({ id: alimentosBase.id, nome: alimentosBase.nome })
    .from(alimentosBase)
    .where(inArray(alimentosBase.nome, ["Pão, trigo, francês", "Arroz, tipo 1, cozido"]));
  paoFrances = base.find((x) => x.nome.startsWith("Pão"))!.id;
  arroz = base.find((x) => x.nome.startsWith("Arroz"))!.id;
  alimentoB = await criarAlimentoUsuario(B, {
    nome: "Pão caseiro da vó",
    marca: null,
    kcal: 280,
    proteinaG: 8,
    carboG: 55,
    gorduraG: 3,
    fibraG: 2,
    sodioMg: 400,
  });
}, 60_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B]));
});

describe("sugestões do IBGE", () => {
  it("pão francês sugere 1 unidade = 50 g", async () => {
    const s = await sugestoesIbge("Pão, trigo, francês");
    expect(s.find((x) => x.medida === "unidade")?.gramas).toBe(50);
  });

  it("a sugestão só vale para o alimento em que foi mostrada", async () => {
    const unidadePao = (await sugestoesIbge("Pão, trigo, francês")).find((x) => x.medida === "unidade")!;
    expect(await sugestaoIbgeDoAlimento(A, "base", paoFrances, unidadePao.id)).not.toBeNull();
    // Mesma medida pedida para outro alimento (arroz): recusada.
    expect(await sugestaoIbgeDoAlimento(A, "base", arroz, unidadePao.id)).toBeNull();
    // Id qualquer: recusado.
    expect(await sugestaoIbgeDoAlimento(A, "base", paoFrances, randomUUID())).toBeNull();
  });

  it("A não obtém sugestão para o alimento de B", async () => {
    const s = await sugestoesIbge("Pão caseiro da vó");
    if (s.length > 0) expect(await sugestaoIbgeDoAlimento(A, "usuario", alimentoB, s[0].id)).toBeNull();
    expect(await sugestaoIbgeDoAlimento(A, "usuario", alimentoB, randomUUID())).toBeNull();
  });

  it("fixar cria medida só do próprio usuário, marcada como IBGE", async () => {
    expect(await criarMedida(A, "base", paoFrances, "unidade", 50, "ibge")).toBe("ok");
    expect((await listarMedidas(A, "base", paoFrances))[0]).toMatchObject({ nome: "unidade", gramas: 50, origem: "ibge" });
    expect(await listarMedidas(B, "base", paoFrances)).toHaveLength(0);
  });
});

describe("medidas do IBGE são só leitura para o papel do app", () => {
  it("não insere, não altera e não apaga", async () => {
    const [m] = await db.select({ id: medidasIbge.id }).from(medidasIbge).limit(1);
    await expect(
      db.insert(medidasIbge).values({ codigoPof: "1", descricaoPof: "x", refAlimento: "x", medida: "x", gramas: 1, nomeBusca: "x" }),
    ).rejects.toThrow();
    await expect(db.update(medidasIbge).set({ gramas: 1 }).where(eq(medidasIbge.id, m.id))).rejects.toThrow();
    await expect(db.delete(medidasIbge).where(eq(medidasIbge.id, m.id))).rejects.toThrow();
  });
});
