import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const A = randomUUID();
const B = randomUUID();
const sessao = { userId: A, admin: null };

vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: async () => sessao }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));

import { db } from "@/lib/db";
import { perfis, relatoriosSemanais } from "@/lib/db/schema";
import { salvarPesagem } from "@/lib/dal/corpo";
import { criarAlimentoUsuario } from "@/lib/dal/alimentos";
import { registrarAceiteIa, usoDoDia } from "@/lib/dal/ia";
import { garantirPerfil } from "@/lib/dal/perfil";
import { carregarRelatorio, guardarTextoIa } from "@/lib/dal/relatorio";
import { criarRegistros } from "@/lib/dal/registros";
import { hojeSaoPaulo } from "@/lib/datas";
import { LIMITE_DIARIO } from "@/lib/ia/config";
import { ErroIa, type PedidoIa, type ProvedorIa } from "@/lib/ia/provedor";
import { definirProvedorDeTeste } from "@/lib/ia/provedor-ativo";
import { inicioDaSemana } from "@/lib/progresso-graficos";
import { gerarResumoSemana } from "@/app/(app)/progresso/semana/actions";

const HOJE = hojeSaoPaulo();
const SEMANA = inicioDaSemana(HOJE);
let chamadas: PedidoIa[] = [];
let resposta: () => Promise<unknown> = async () => ({});
const falso: ProvedorIa = {
  async gerar(p) {
    chamadas.push(p);
    return resposta();
  },
};
const form = (campos: Record<string, string> = {}) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(campos)) f.set(k, v);
  return f;
};

beforeAll(async () => {
  process.env.GEMINI_API_KEY = "chave-de-teste-nao-usada";
  delete process.env.IA_SOMENTE_ADMIN;
  await garantirPerfil(A);
  await garantirPerfil(B);
  await registrarAceiteIa(A, 1);
  const alimento = await criarAlimentoUsuario(A, { nome: "Refeição de teste", marca: null, kcal: 100, proteinaG: 10, carboG: 10, gorduraG: 2, fibraG: 0, sodioMg: 0 });
  await criarRegistros(A, [
    { data: SEMANA, refeicao: "almoco", tipo: "usuario", alimentoId: alimento, nome: "Refeição de teste", gramas: 2000, medidaTexto: null, nutrientes: { kcal: 2000, proteinaG: 150, carboG: 200, gorduraG: 60, fibraG: 10 } },
  ]);
  await salvarPesagem(A, SEMANA, { pesoKg: 90, massaMagraKg: null, cinturaCm: null });
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

describe("relatório semanal (dados)", () => {
  it("calcula só com os dados do próprio usuário e guarda um por semana", async () => {
    const { relatorio } = await carregarRelatorio(A, SEMANA, HOJE);
    expect(relatorio.calorias.media).toBe(2000);
    expect(relatorio.calorias.dias).toBe(1);
    const outro = await carregarRelatorio(B, SEMANA, HOJE);
    expect(outro.relatorio.calorias.media).toBeNull();
    const linhas = await db.select().from(relatoriosSemanais).where(eq(relatoriosSemanais.userId, A));
    expect(linhas).toHaveLength(1);
    await carregarRelatorio(A, SEMANA, HOJE);
    expect(await db.select().from(relatoriosSemanais).where(eq(relatoriosSemanais.userId, A))).toHaveLength(1);
  });
  it("o texto da IA só aparece enquanto os números não mudaram", async () => {
    const { relatorio } = await carregarRelatorio(A, SEMANA, HOJE);
    await guardarTextoIa(A, SEMANA, "Texto de teste da semana.", relatorio);
    expect((await carregarRelatorio(A, SEMANA, HOJE)).textoIa).toBe("Texto de teste da semana.");
    await db.update(relatoriosSemanais).set({ textoHash: "0".repeat(64) }).where(and(eq(relatoriosSemanais.userId, A), eq(relatoriosSemanais.inicio, SEMANA)));
    expect((await carregarRelatorio(A, SEMANA, HOJE)).textoIa).toBeNull();
  });
  it("o banco recusa semana que não começa na segunda e hash fora do formato", async () => {
    await expect(db.insert(relatoriosSemanais).values({ userId: A, inicio: "2026-10-07", dados: {} })).rejects.toThrow();
    await expect(db.insert(relatoriosSemanais).values({ userId: A, inicio: "2026-09-28", dados: {}, textoIa: "x", textoHash: "abc" })).rejects.toThrow();
    await expect(db.insert(relatoriosSemanais).values({ userId: A, inicio: "2026-09-21", dados: {}, textoIa: "x".repeat(2001) })).rejects.toThrow();
  });
});

describe("gerar resumo com a IA (a IA só escreve; números do app)", () => {
  it("guarda o texto quando só cita números do relatório", async () => {
    resposta = async () => ({ explicacao: "Você registrou 2000 kcal em 1 dia e a proteína foi de 150 g. Continue registrando para o resumo ficar mais completo.", dicas: ["Registre também os outros dias da semana."] });
    const r = await gerarResumoSemana({}, form({ inicio: SEMANA }));
    expect(r.ok).toBe(true);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].texto).toContain("calorias médias por dia: 2.000 kcal");
    expect(chamadas[0].texto).not.toMatch(/@|user_id|uuid/i);
    expect((await carregarRelatorio(A, SEMANA, HOJE)).textoIa).toMatch(/2000 kcal/);
  });
  it("descarta texto com número inventado e não guarda", async () => {
    await db.update(relatoriosSemanais).set({ textoIa: null, textoHash: null }).where(eq(relatoriosSemanais.userId, A));
    resposta = async () => ({ explicacao: "Você deveria comer 1500 kcal por dia para perder 4 kg neste mês com facilidade." });
    const r = await gerarResumoSemana({}, form({ inicio: SEMANA }));
    expect(r.erro).toMatch(/número que não é do seu relatório/);
    expect((await carregarRelatorio(A, SEMANA, HOJE)).textoIa).toBeNull();
  });
  it("semana inválida ou futura vira a semana atual; sem dados não chama a IA", async () => {
    resposta = async () => ({ explicacao: "Resumo curto que usa só os números 2000 kcal e 150 g do relatório da semana." });
    expect((await gerarResumoSemana({}, form({ inicio: "2099-01-05" }))).ok).toBe(true);
    chamadas = [];
    sessao.userId = B;
    await registrarAceiteIa(B, 1);
    expect((await gerarResumoSemana({}, form({ inicio: "lixo" }))).erro).toMatch(/dados suficientes/);
    expect(chamadas).toHaveLength(0);
  });
  it("sem aceite nada é enviado; falha do provedor devolve a chamada; há limite diário", async () => {
    sessao.userId = randomUUID();
    await db.insert(perfis).values({ userId: sessao.userId });
    try {
      expect((await gerarResumoSemana({}, form({ inicio: SEMANA }))).precisaAceite).toBe(true);
      expect(chamadas).toHaveLength(0);
    } finally {
      await db.delete(perfis).where(eq(perfis.userId, sessao.userId));
    }
    sessao.userId = A;
    const antes = (await usoDoDia(A, HOJE, "relatorio")).usadas;
    resposta = async () => {
      throw new ErroIa("indisponivel");
    };
    expect((await gerarResumoSemana({}, form({ inicio: SEMANA }))).erro).toMatch(/não respondeu/);
    expect((await usoDoDia(A, HOJE, "relatorio")).usadas).toBe(antes);

    resposta = async () => ({ explicacao: "Resumo curto que usa só os números 2000 kcal e 150 g do relatório da semana." });
    for (let i = antes; i < LIMITE_DIARIO.relatorio; i++) await gerarResumoSemana({}, form({ inicio: SEMANA }));
    const n = chamadas.length;
    expect((await gerarResumoSemana({}, form({ inicio: SEMANA }))).erro).toMatch(/Você já usou/);
    expect(chamadas).toHaveLength(n);
  });
});
