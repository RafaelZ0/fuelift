import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

let limiteOk = true;
vi.mock("@/lib/limites", () => ({ dentroDoLimite: async () => limiteOk, ipDaRequisicao: async () => "203.0.113.7" }));

import { db } from "@/lib/db";
import { passosDia, perfis, tokensApi } from "@/lib/db/schema";
import { garantirPerfil } from "@/lib/dal/perfil";
import { criarTokenApi, listarTokens, MAX_TOKENS_ATIVOS, passosDoPeriodo, revogarTokenApi, usuarioDoToken } from "@/lib/dal/passos";
import { hojeSaoPaulo, somarDias } from "@/lib/datas";
import { gerarToken, hashDoToken } from "@/lib/token-api";
import { POST } from "@/app/api/passos/route";

const A = randomUUID();
const B = randomUUID();
const tokenA = gerarToken();
const tokenB = gerarToken();
const HOJE = hojeSaoPaulo();

const req = (corpo: unknown, token: string | null = tokenA, tipo = "application/json") =>
  new Request("http://localhost/api/passos", {
    method: "POST",
    headers: { "content-type": tipo, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: typeof corpo === "string" ? corpo : JSON.stringify(corpo),
  });

beforeAll(async () => {
  await garantirPerfil(A);
  await garantirPerfil(B);
  await criarTokenApi(A, "iPhone", hashDoToken(tokenA));
  await criarTokenApi(B, "iPhone do B", hashDoToken(tokenB));
}, 90_000);

afterAll(async () => {
  await db.delete(perfis).where(inArray(perfis.userId, [A, B]));
});

beforeEach(() => {
  limiteOk = true;
});

describe("API de passos", () => {
  it("grava os passos do dia do dono do token", async () => {
    const r = await POST(req({ passos: 8234 }));
    expect(r.status).toBe(200);
    expect(await r.json()).toMatchObject({ ok: true, data: HOJE, passos: 8234 });
    expect(r.headers.get("cache-control")).toBe("no-store");
    expect((await passosDoPeriodo(A, HOJE, HOJE))[0].passos).toBe(8234);
    expect(await passosDoPeriodo(B, HOJE, HOJE)).toEqual([]);
  });

  it("o último envio do dia vale, e aceita texto numérico com decimais", async () => {
    await POST(req({ passos: 9000 }));
    const r = await POST(req({ passos: "10250,6" }));
    expect(r.status).toBe(200);
    expect((await passosDoPeriodo(A, HOJE, HOJE))[0].passos).toBe(10251);
  });

  it("aceita dias passados (até 7), recusa futuro, muito antigo e texto", async () => {
    expect((await POST(req({ passos: 5000, data: somarDias(HOJE, -3) }))).status).toBe(200);
    expect((await POST(req({ passos: 5000, data: somarDias(HOJE, 1) }))).status).toBe(400);
    expect((await POST(req({ passos: 5000, data: somarDias(HOJE, -8) }))).status).toBe(400);
    expect((await POST(req({ passos: 5000, data: "ontem" }))).status).toBe(400);
  });

  it("recusa sem token, token desconhecido, formato errado e token revogado", async () => {
    expect((await POST(req({ passos: 1 }, null))).status).toBe(401);
    expect((await POST(req({ passos: 1 }, gerarToken()))).status).toBe(401);
    expect((await POST(req({ passos: 1 }, "kly_curto"))).status).toBe(401);
    const efemero = gerarToken();
    await criarTokenApi(A, "temporário", hashDoToken(efemero));
    const [t] = (await listarTokens(A)).filter((x) => x.nome === "temporário");
    expect((await POST(req({ passos: 7 }, efemero))).status).toBe(200);
    expect(await revogarTokenApi(A, t.id)).toBe(true);
    expect((await POST(req({ passos: 7 }, efemero))).status).toBe(401);
  });

  it("valida o corpo: negativo, enorme, texto, JSON quebrado, tipo errado e tamanho", async () => {
    for (const ruim of [{ passos: -1 }, { passos: 999999 }, { passos: "muitos" }, { passos: null }, {}, [], "{quebrado"]) {
      expect((await POST(req(ruim))).status).toBe(400);
    }
    expect((await POST(req({ passos: 1, lixo: "x".repeat(2000) }))).status).toBe(413);
    expect((await POST(req("1", tokenA, "text/plain"))).status).toBe(415);
  });

  it("limite de requisições", async () => {
    limiteOk = false;
    expect((await POST(req({ passos: 1 }))).status).toBe(429);
  });

  it("o token de um usuário nunca grava para outro", async () => {
    await POST(req({ passos: 4321 }, tokenB));
    expect((await passosDoPeriodo(B, HOJE, HOJE))[0].passos).toBe(4321);
    expect((await passosDoPeriodo(A, HOJE, HOJE))[0].passos).not.toBe(4321);
  });
});

describe("tokens", () => {
  it("o banco guarda só o hash e o token em claro não aparece em lugar nenhum", async () => {
    const todos = await db.select().from(tokensApi).where(eq(tokensApi.userId, A));
    expect(JSON.stringify(todos)).not.toContain(tokenA);
    expect(todos.every((t) => /^[0-9a-f]{64}$/.test(t.hash))).toBe(true);
  });
  it("revogar token de outro usuário não funciona", async () => {
    const [tb] = await listarTokens(B);
    expect(await revogarTokenApi(A, tb.id)).toBe(false);
    expect(await usuarioDoToken(hashDoToken(tokenB))).not.toBeNull();
  });
  it("limite de tokens ativos", async () => {
    const ativos = (await listarTokens(A)).filter((t) => !t.revogadoEm).length;
    let criados = 0;
    for (let i = ativos; i < MAX_TOKENS_ATIVOS + 2; i++) if (await criarTokenApi(A, `extra ${i}`, hashDoToken(gerarToken()))) criados++;
    expect(criados).toBe(MAX_TOKENS_ATIVOS - ativos);
  });
  it("o banco recusa hash fora do formato e passos fora da faixa", async () => {
    await expect(db.insert(tokensApi).values({ userId: A, nome: "ruim", hash: "abc" })).rejects.toThrow();
    await expect(db.insert(passosDia).values({ userId: A, data: "2026-01-01", passos: 999999 })).rejects.toThrow();
    await expect(db.insert(passosDia).values({ userId: A, data: "2026-01-02", passos: -5 })).rejects.toThrow();
  });
});
