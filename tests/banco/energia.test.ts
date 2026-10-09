import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
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
import { metas, perfis, projecoesPeso } from "@/lib/db/schema";
import { salvarPesagem } from "@/lib/dal/corpo";
import { carregarEnergia, consumoPorDia, definirNivelAtividade, definirRitmoMax } from "@/lib/dal/energia";
import { criarAlimentoUsuario } from "@/lib/dal/alimentos";
import { registrarAceiteIa, usoDoDia } from "@/lib/dal/ia";
import { metaVigente, salvarMeta } from "@/lib/dal/metas";
import { garantirPerfil, atualizarPerfil } from "@/lib/dal/perfil";
import { criarRegistros } from "@/lib/dal/registros";
import { hojeSaoPaulo, somarDias } from "@/lib/datas";
import { LIMITE_DIARIO } from "@/lib/ia/config";
import { ErroIa, type PedidoIa, type ProvedorIa } from "@/lib/ia/provedor";
import { definirProvedorDeTeste } from "@/lib/ia/provedor-ativo";
import { aplicarOpcaoMeta, explicarOpcaoMeta, salvarPesoMeta, salvarRitmoMax } from "@/app/(app)/progresso/meta/actions";
import { confirmarAtividade, diagnosticarAtividade } from "@/app/(app)/ajustes/atividade/actions";

const HOJE = hojeSaoPaulo();
let chamadas: PedidoIa[] = [];
let resposta: () => Promise<unknown> = async () => ({});
const falso: ProvedorIa = {
  async gerar(p) {
    chamadas.push(p);
    return resposta();
  },
};
const form = (campos: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

let alimentoA: string;

beforeAll(async () => {
  process.env.GEMINI_API_KEY = "chave-de-teste-nao-usada";
  delete process.env.IA_SOMENTE_ADMIN;
  await garantirPerfil(A);
  await garantirPerfil(B);
  await registrarAceiteIa(A, 1);
  await atualizarPerfil(A, { nome: "A", dataNascimento: "1990-05-10", sexo: "masculino", alturaCm: 178, nivelAtividade: "moderado", inicioPlano: null });
  alimentoA = await criarAlimentoUsuario(A, { nome: "Refeição de teste", marca: null, kcal: 100, proteinaG: 10, carboG: 10, gorduraG: 2, fibraG: 0, sodioMg: 0 });
  // 20 dias com registro (2.300 kcal) e pesagens a cada 2 dias, peso estável em 90 kg.
  const itens = [];
  for (let i = 0; i < 20; i++) {
    const data = somarDias(HOJE, -i);
    itens.push({ data, refeicao: "almoco" as const, tipo: "usuario" as const, alimentoId: alimentoA, nome: "Refeição de teste", gramas: 2300, medidaTexto: null, nutrientes: { kcal: 2300, proteinaG: 230, carboG: 230, gorduraG: 46, fibraG: 0 } });
  }
  await criarRegistros(A, itens);
  for (let i = 0; i < 20; i += 2) await salvarPesagem(A, somarDias(HOJE, -i), { pesoKg: 90, massaMagraKg: null, cinturaCm: null });
  await salvarMeta(A, { kcal: 2100, proteinaG: null, carboG: null, gorduraG: null, aguaMl: null, pesoMetaKg: 80, dataMeta: null, observacao: null }, HOJE);
  definirProvedorDeTeste(falso);
}, 120_000);

afterAll(async () => {
  definirProvedorDeTeste(null);
  await db.delete(perfis).where(inArray(perfis.userId, [A, B]));
});

beforeEach(() => {
  sessao.userId = A;
  chamadas = [];
  resposta = async () => ({});
});

describe("dados de energia (isolamento e cálculo)", () => {
  it("consumo por dia soma só os registros do próprio usuário", async () => {
    const meu = await consumoPorDia(A, somarDias(HOJE, -30), HOJE);
    expect(meu).toHaveLength(20);
    expect(Number(meu[0].kcal)).toBe(2300);
    expect(await consumoPorDia(B, somarDias(HOJE, -30), HOJE)).toEqual([]);
  });
  it("sem dados do perfil, o painel diz o que falta e não inventa gasto", async () => {
    const d = await carregarEnergia(B, HOJE);
    expect(d.painel.faltam).toEqual(expect.arrayContaining(["sexo", "nascimento", "altura", "atividade", "peso"]));
    expect(d.painel.gasto).toBeNull();
  });
  it("com perfil, pesagens e comida calcula o gasto adaptativo e as opções de meta", async () => {
    const d = await carregarEnergia(A, HOJE);
    expect(d.painel.faltam).toEqual([]);
    expect(d.painel.gasto?.metodo).toBe("adaptativo");
    expect(d.painel.gasto?.valor).toBe(2300); // peso estável: gasto ≈ consumo médio
    // Opções que cairiam na mesma meta (travadas na TMB) são unificadas: sem repetição.
    const kcals = d.painel.planejamento!.opcoes.map((o) => o.kcal);
    expect(kcals.length).toBeGreaterThanOrEqual(2);
    expect(new Set(kcals).size).toBe(kcals.length);
    expect(d.painel.previsaoDaMeta?.texto).toMatch(/2\.100 kcal/);
  });
  it("o banco recusa ritmo máximo acima de 1% e abaixo de 0,25%, e nível de atividade inválido", async () => {
    await expect(db.update(perfis).set({ ritmoMaxPct: 1.5 }).where(eq(perfis.userId, A))).rejects.toThrow();
    await expect(db.update(perfis).set({ ritmoMaxPct: 0.1 }).where(eq(perfis.userId, A))).rejects.toThrow();
    await expect(db.update(perfis).set({ nivelAtividade: "extremo" }).where(eq(perfis.userId, A))).rejects.toThrow();
    expect(await definirRitmoMax(A, 0.75)).toBe(true);
    expect(await definirRitmoMax(A, 1)).toBe(true);
    expect(await definirNivelAtividade(A, "alto")).toBe(true);
    await definirNivelAtividade(A, "moderado");
  });
});

describe("ritmo máximo e peso desejado", () => {
  it("ritmo só aceita os valores da lista (nunca acima de 1%)", async () => {
    for (const ruim of ["2", "1.5", "0.1", "abc", ""]) expect((await salvarRitmoMax({}, form({ ritmo: ruim }))).erro).toBeTruthy();
    expect((await salvarRitmoMax({}, form({ ritmo: "0.5" }))).ok).toBeTruthy();
    expect((await carregarEnergia(A, HOJE)).perfil.ritmoMaxPct).toBe(0.5);
    await salvarRitmoMax({}, form({ ritmo: "1" }));
  });
  it("salva o peso desejado sem apagar as outras metas", async () => {
    const r = await salvarPesoMeta({}, form({ pesoMetaKg: "82,5", dataMeta: somarDias(HOJE, 120) }));
    expect(r.ok).toBeTruthy();
    const m = await metaVigente(A, HOJE);
    expect(m).toMatchObject({ pesoMetaKg: 82.5, kcal: 2100 });
    await salvarPesoMeta({}, form({ pesoMetaKg: "80", dataMeta: "" }));
  });
  it("recusa data no passado, peso absurdo e data sem peso", async () => {
    expect((await salvarPesoMeta({}, form({ pesoMetaKg: "80", dataMeta: somarDias(HOJE, -3) }))).erros?.dataMeta).toBeTruthy();
    expect((await salvarPesoMeta({}, form({ pesoMetaKg: "5", dataMeta: "" }))).erros?.pesoMetaKg).toBeTruthy();
    expect((await salvarPesoMeta({}, form({ pesoMetaKg: "", dataMeta: somarDias(HOJE, 60) }))).erros?.pesoMetaKg).toBeTruthy();
  });
});

describe("explicar a opção de meta (a IA nunca produz os números)", () => {
  it("usa a explicação da IA quando ela só cita números do app", async () => {
    resposta = async () => ({ explicacao: "Sua meta é de menos calorias que o seu gasto estimado, o que cria um déficit moderado. Olhe a tendência de várias semanas, não um dia.", dicas: ["Olhe a média da semana."] });
    const r = await explicarOpcaoMeta({}, form({ opcao: "moderado" }));
    expect(r.viaIa).toBe(true);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].texto).toMatch(/meta de calorias: \d+ kcal por dia/);
    expect(chamadas[0].texto).not.toMatch(/@|user_id/i);
  });
  it("descarta a explicação que inventa um número e mostra a do app", async () => {
    resposta = async () => ({ explicacao: "O ideal seria comer apenas 1200 kcal por dia para acelerar bastante o seu resultado." });
    const r = await explicarOpcaoMeta({}, form({ opcao: "moderado" }));
    expect(r.viaIa).toBe(false);
    expect(r.explicacao?.explicacao).toMatch(/estimativas/);
    expect(r.explicacao?.explicacao).not.toMatch(/1200/);
  });
  it("falha do provedor: explicação do app e a chamada volta ao saldo", async () => {
    const antes = (await usoDoDia(A, HOJE, "metas")).usadas;
    resposta = async () => {
      throw new ErroIa("indisponivel");
    };
    const r = await explicarOpcaoMeta({}, form({ opcao: "leve" }));
    expect(r.explicacao).toBeTruthy();
    expect((await usoDoDia(A, HOJE, "metas")).usadas).toBe(antes);
  });
  it("opção inventada é recusada e nada é chamado", async () => {
    expect((await explicarOpcaoMeta({}, form({ opcao: "agressiva" }))).erro).toMatch(/inválida/);
    expect(chamadas).toHaveLength(0);
  });
  it("limite diário: depois dele, a explicação do app, sem chamar a IA", async () => {
    sessao.userId = B;
    await registrarAceiteIa(B, 1);
    await atualizarPerfil(B, { nome: "B", dataNascimento: "1992-01-01", sexo: "feminino", alturaCm: 165, nivelAtividade: "leve", inicioPlano: null });
    await salvarPesagem(B, HOJE, { pesoKg: 75, massaMagraKg: null, cinturaCm: null });
    await salvarMeta(B, { kcal: null, proteinaG: null, carboG: null, gorduraG: null, aguaMl: null, pesoMetaKg: 65, dataMeta: null, observacao: null }, HOJE);
    resposta = async () => ({ explicacao: "Uma explicação simples que usa só os números do aplicativo e o bom senso do dia a dia." });
    for (let i = 0; i < LIMITE_DIARIO.metas; i++) expect((await explicarOpcaoMeta({}, form({ opcao: "leve" }))).viaIa).toBe(true);
    const antes = chamadas.length;
    const r = await explicarOpcaoMeta({}, form({ opcao: "leve" }));
    expect(r.viaIa).toBe(false);
    expect(r.erro).toMatch(/Você já usou/);
    expect(chamadas).toHaveLength(antes);
  });
});

describe("usar a opção como meta (números sempre recalculados no servidor)", () => {
  it("grava calorias e macros do servidor, ignorando qualquer número vindo do formulário", async () => {
    const f = form({ opcao: "moderado", kcal: "800", proteinaG: "999", carboG: "1", gorduraG: "1" });
    await expect(aplicarOpcaoMeta(f)).rejects.toThrow("REDIRECT:/progresso/meta?salva=1");
    const m = (await metaVigente(A, HOJE))!;
    const plano = (await carregarEnergia(A, HOJE)).painel.planejamento!;
    const esperado = plano.opcoes.find((o) => o.id === "moderado")!;
    expect(m.kcal).toBe(esperado.kcal);
    expect(m.kcal).not.toBe(800);
    expect(m.proteinaG).toBeGreaterThan(100);
    expect(m.proteinaG).not.toBe(999);
    expect(m.pesoMetaKg).toBe(80); // mantém o peso desejado
    expect(m.observacao).toMatch(/sugerida pelo app/);
    expect(m.kcal!).toBeGreaterThanOrEqual((await carregarEnergia(A, HOJE)).painel.tmb!);
  });
  it("guarda a versão da projeção", async () => {
    const p = await db.select().from(projecoesPeso).where(eq(projecoesPeso.userId, A));
    expect(p.length).toBeGreaterThanOrEqual(1);
    expect(p[0].pontos.length).toBeGreaterThan(1);
  });
  it("opção inventada não muda nada", async () => {
    const antes = await metaVigente(A, HOJE);
    await aplicarOpcaoMeta(form({ opcao: "extrema" }));
    expect((await metaVigente(A, HOJE))?.kcal).toBe(antes?.kcal);
  });
  it("meta que deixa o IMC abaixo de 18,5 não gera opções, então nada é aplicado", async () => {
    await salvarMeta(A, { kcal: 2100, proteinaG: null, carboG: null, gorduraG: null, aguaMl: null, pesoMetaKg: 50, dataMeta: null, observacao: null }, HOJE);
    await aplicarOpcaoMeta(form({ opcao: "moderado" }));
    const m = await metaVigente(A, HOJE);
    expect(m?.kcal).toBe(2100);
    expect(m?.pesoMetaKg).toBe(50);
    await db.update(metas).set({ pesoMetaKg: 80 }).where(eq(metas.userId, A));
  });
  it("outro usuário não vê nem altera a meta de A", async () => {
    sessao.userId = B;
    const mb = await metaVigente(B, HOJE);
    expect(mb?.kcal ?? null).toBeNull();
  });
});

describe("nível de atividade com IA", () => {
  it("só envia o texto digitado e o número de treinos; o nível volta validado", async () => {
    resposta = async () => ({ nivel: "leve", justificativa: "Trabalha sentado e treina poucas vezes." });
    const r = await diagnosticarAtividade({}, form({ texto: "Trabalho sentado em escritório e corro duas vezes por semana" }));
    expect(r.resultado).toMatchObject({ nivel: "leve", fator: 1.375 });
    expect(chamadas[0].texto).not.toMatch(/@|user_id|uuid/i);
    expect(chamadas[0].arquivos).toEqual([]);
  });
  it("nível inventado, texto curto e falha do provedor", async () => {
    resposta = async () => ({ nivel: "super", justificativa: "x" });
    expect((await diagnosticarAtividade({}, form({ texto: "Faço muito exercício todos os dias da semana" }))).erro).toBeTruthy();
    expect((await diagnosticarAtividade({}, form({ texto: "oi" }))).erro).toMatch(/Descreva/);
    const antes = (await usoDoDia(A, HOJE, "atividade")).usadas;
    resposta = async () => {
      throw new ErroIa("indisponivel");
    };
    expect((await diagnosticarAtividade({}, form({ texto: "Trabalho em pé e treino todos os dias" }))).erro).toMatch(/não respondeu/);
    expect((await usoDoDia(A, HOJE, "atividade")).usadas).toBe(antes);
  });
  it("sem aceite da IA nada é enviado", async () => {
    sessao.userId = randomUUID();
    await db.insert(perfis).values({ userId: sessao.userId });
    try {
      const r = await diagnosticarAtividade({}, form({ texto: "Trabalho sentado e caminho pouco durante a semana" }));
      expect(r.precisaAceite).toBe(true);
      expect(chamadas).toHaveLength(0);
    } finally {
      await db.delete(perfis).where(eq(perfis.userId, sessao.userId));
    }
  });
  it("confirmar só aceita níveis do app e grava no próprio perfil", async () => {
    await expect(confirmarAtividade(form({ nivel: "alto" }))).rejects.toThrow("REDIRECT:/ajustes/atividade?salvo=1");
    expect((await carregarEnergia(A, HOJE)).perfil.nivel).toBe("alto");
    await confirmarAtividade(form({ nivel: "extremo" })); // ignorado
    expect((await carregarEnergia(A, HOJE)).perfil.nivel).toBe("alto");
    sessao.userId = B;
    await expect(confirmarAtividade(form({ nivel: "muito_alto" }))).rejects.toThrow("REDIRECT");
    expect((await carregarEnergia(A, HOJE)).perfil.nivel).toBe("alto");
  });
});
