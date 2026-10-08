import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const A = randomUUID();
const B = randomUUID();
const sessao = { userId: A, admin: null as null | { userId: string; __admin: true } };

vi.mock("@/lib/auth/sessao", () => ({ exigirUsuario: async () => sessao }));
vi.mock("next/cache", () => ({ revalidatePath: () => undefined }));
vi.mock("next/navigation", () => ({
  redirect: (destino: string) => {
    throw new Error(`REDIRECT:${destino}`);
  },
}));

import { db } from "@/lib/db";
import { exercicios, perfis, planosTreino, treinos } from "@/lib/db/schema";
import { garantirPerfil } from "@/lib/dal/perfil";
import { obterAceiteIa, usoDoDia } from "@/lib/dal/ia";
import { hojeSaoPaulo } from "@/lib/datas";
import { LIMITE_DIARIO } from "@/lib/ia/config";
import { ErroIa, type PedidoIa, type ProvedorIa } from "@/lib/ia/provedor";
import { definirProvedorDeTeste } from "@/lib/ia/provedor-ativo";
import type { Rascunho } from "@/lib/ia/rascunho";
import { aceitarUsoIa, gerarPlanoComIa, importarTreinoComIa, salvarRascunhoIa } from "@/app/(app)/treino/ia/actions";

const respostaBoa = {
  plano: { nome: "Plano falso" },
  treinos: [{ nome: "A", foco: "Peito", dia_sugerido: 1, exercicios: [{ nome_pt: "Supino reto", nome_en: "Barbell Bench Press - Medium Grip", reps_min: 8, reps_max: 12 }] }],
  alertas: [],
};

let chamadas: PedidoIa[] = [];
let comportamento: () => Promise<unknown> = async () => respostaBoa;
const falso: ProvedorIa = {
  async gerar(p) {
    chamadas.push(p);
    return comportamento();
  },
};

function formPlano(extra: Record<string, string | string[]> = {}) {
  const f = new FormData();
  const base: Record<string, string | string[]> = { objetivo: "hipertrofia", nivel: "iniciante", dias: "3", minutos: "60", equipamentos: ["academia"], limitacoes: "", ...extra };
  for (const [k, v] of Object.entries(base)) for (const x of Array.isArray(v) ? v : [v]) f.append(k, x);
  return f;
}
const aceite = () => {
  const f = new FormData();
  f.set("regiao", "on");
  f.set("dados", "on");
  return f;
};
const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0])], "treino.png", { type: "image/png" });

beforeAll(async () => {
  process.env.GEMINI_API_KEY = "chave-de-teste-nao-usada";
  delete process.env.IA_SOMENTE_ADMIN;
  await garantirPerfil(A);
  await garantirPerfil(B);
  definirProvedorDeTeste(falso);
}, 90_000);

afterAll(async () => {
  definirProvedorDeTeste(null);
  await db.delete(perfis).where(inArray(perfis.userId, [A, B]));
});

beforeEach(() => {
  sessao.userId = A;
  sessao.admin = null;
  chamadas = [];
  comportamento = async () => respostaBoa;
});

describe("aceite da IA", () => {
  it("sem aceite, nada é enviado à IA nem contado", async () => {
    const r = await gerarPlanoComIa({}, formPlano());
    expect(r.erro).toMatch(/aceite/i);
    expect(chamadas).toHaveLength(0);
    expect((await usoDoDia(A, hojeSaoPaulo(), "plano")).usadas).toBe(0);
  });

  it("exige as duas confirmações", async () => {
    const f = new FormData();
    f.set("regiao", "on");
    expect((await aceitarUsoIa({}, f)).erro).toMatch(/duas confirmações/);
    expect(await obterAceiteIa(A)).toBeNull();
  });

  it("registra o aceite e redireciona", async () => {
    await expect(aceitarUsoIa({}, aceite())).rejects.toThrow("REDIRECT:/treino/ia");
    expect((await obterAceiteIa(A))?.versao).toBe(1);
  });
});

describe("disponibilidade", () => {
  it("IA somente para o administrador bloqueia os demais, sem chamar o provedor", async () => {
    process.env.IA_SOMENTE_ADMIN = "true";
    try {
      const r = await gerarPlanoComIa({}, formPlano());
      expect(r.erro).toMatch(/administrador/);
      expect(chamadas).toHaveLength(0);
      sessao.admin = { userId: A, __admin: true };
      expect((await gerarPlanoComIa({}, formPlano())).rascunho).toBeTruthy();
    } finally {
      delete process.env.IA_SOMENTE_ADMIN;
    }
  });

  it("sem chave configurada a IA fica indisponível", async () => {
    const chave = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      expect((await gerarPlanoComIa({}, formPlano())).erro).toMatch(/não está disponível/);
    } finally {
      process.env.GEMINI_API_KEY = chave;
    }
  });
});

describe("gerar plano", () => {
  it("devolve rascunho limpo, com o aviso fixo de limitação e foto ligada ao catálogo", async () => {
    const r = await gerarPlanoComIa({}, formPlano({ limitacoes: "dor no joelho" }));
    expect(r.rascunho?.treinos[0].exercicios[0]).toMatchObject({ nomePt: "Supino reto", fotoNome: "Barbell Bench Press - Medium Grip" });
    expect(r.rascunho?.alertas[0]).toMatch(/limitação/);
    expect(chamadas[0].texto).toContain("dor no joelho");
    expect(chamadas[0].texto).not.toMatch(/@|user_id/i);
  });

  it("pedido inválido não chega à IA", async () => {
    const r = await gerarPlanoComIa({}, formPlano({ dias: "9" }));
    expect(r.erros?.dias).toBeTruthy();
    expect(chamadas).toHaveLength(0);
  });

  it("dados do corpo só vão quando marcados e vêm do perfil, não do navegador", async () => {
    await db.update(perfis).set({ sexo: "feminino", alturaCm: 170 }).where(eq(perfis.userId, A));
    await gerarPlanoComIa({}, formPlano());
    expect(chamadas.at(-1)!.texto).not.toMatch(/feminino|170/);
    await gerarPlanoComIa({}, formPlano({ enviarAltura: "on", sexo: "masculino", alturaCm: "999" }));
    expect(chamadas.at(-1)!.texto).toContain("altura: 170 cm");
    expect(chamadas.at(-1)!.texto).not.toMatch(/999|masculino|sexo/);
  });

  it("falha do provedor devolve a chamada ao saldo; resposta inútil conta", async () => {
    const antes = (await usoDoDia(A, hojeSaoPaulo(), "plano")).usadas;
    comportamento = async () => {
      throw new ErroIa("indisponivel");
    };
    expect((await gerarPlanoComIa({}, formPlano())).erro).toMatch(/não respondeu/);
    expect((await usoDoDia(A, hojeSaoPaulo(), "plano")).usadas).toBe(antes);
    comportamento = async () => {
      throw new ErroIa("limite_provedor");
    };
    expect((await gerarPlanoComIa({}, formPlano())).erro).toMatch(/muitos pedidos/);
    expect((await usoDoDia(A, hojeSaoPaulo(), "plano")).usadas).toBe(antes);
    comportamento = async () => ({ plano: { nome: "x" }, treinos: [] });
    expect((await gerarPlanoComIa({}, formPlano())).erro).toMatch(/não conseguiu/);
    expect((await usoDoDia(A, hojeSaoPaulo(), "plano")).usadas).toBe(antes + 1);
  });

  it("respeita o limite diário e não chama a IA depois dele", async () => {
    sessao.userId = B;
    await aceitarUsoIa({}, aceite()).catch(() => undefined);
    for (let i = 0; i < LIMITE_DIARIO.plano; i++) expect((await gerarPlanoComIa({}, formPlano())).rascunho).toBeTruthy();
    const antes = chamadas.length;
    expect((await gerarPlanoComIa({}, formPlano())).erro).toMatch(/gerações de hoje/);
    expect(chamadas).toHaveLength(antes);
  });
});

describe("importar arquivo", () => {
  const form = (arquivos: File[], nota = "") => {
    const f = new FormData();
    for (const a of arquivos) f.append("arquivos", a);
    f.set("nota", nota);
    return f;
  };

  it("aceita imagem de verdade e envia o tipo detectado pelo conteúdo", async () => {
    const r = await importarTreinoComIa({}, form([png()]));
    expect(r.rascunho).toBeTruthy();
    expect(chamadas[0].arquivos[0].mimeType).toBe("image/png");
  });

  it("recusa arquivo que finge ser imagem, sem chamar a IA nem contar uso", async () => {
    const falsa = new File([new TextEncoder().encode("<script>alert(1)</script> isto não é imagem")], "treino.png", { type: "image/png" });
    const antes = (await usoDoDia(A, hojeSaoPaulo(), "importacao")).usadas;
    expect((await importarTreinoComIa({}, form([falsa]))).erro).toMatch(/apenas imagens/);
    expect(chamadas).toHaveLength(0);
    expect((await usoDoDia(A, hojeSaoPaulo(), "importacao")).usadas).toBe(antes);
  });

  it("recusa sem arquivo, arquivos demais, arquivo grande e total grande", async () => {
    expect((await importarTreinoComIa({}, form([]))).erro).toMatch(/pelo menos um/);
    expect((await importarTreinoComIa({}, form(Array.from({ length: 5 }, png)))).erro).toMatch(/no máximo 4/);
    const grande = new File([new Uint8Array(4 * 1024 * 1024 + 1).fill(1)], "g.png");
    expect((await importarTreinoComIa({}, form([grande]))).erro).toMatch(/4 MB/);
    const quase = () => {
      const b = new Uint8Array(3 * 1024 * 1024 + 512 * 1024);
      b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
      return new File([b], "q.png");
    };
    expect((await importarTreinoComIa({}, form([quase(), quase()]))).erro).toMatch(/6 MB/);
    expect(chamadas).toHaveLength(0);
  });

  it("observação longa é recusada", async () => {
    expect((await importarTreinoComIa({}, form([png()], "x".repeat(301)))).erro).toMatch(/300/);
  });
});

describe("salvar rascunho", () => {
  const ok: Rascunho = {
    nome: "Plano salvo",
    alertas: [],
    treinos: [{ nome: "A", foco: null, diaSugerido: 2, exercicios: [{ nomePt: "Supino", nomeEn: "x", grupo: null, series: 3, repsMin: 8, repsMax: 12, descansoS: 60, unilateral: false, cargaPorHalter: false, medida: "repeticoes", observacao: null, fotoId: null, fotoNome: null }] }],
  };
  const form = (r: unknown) => {
    const f = new FormData();
    f.set("rascunho", typeof r === "string" ? r : JSON.stringify(r));
    return f;
  };

  it("grava o plano do próprio usuário e redireciona para o plano", async () => {
    await expect(salvarRascunhoIa({}, form(ok))).rejects.toThrow("REDIRECT:/treino/plano");
    const p = await db.select().from(planosTreino).where(eq(planosTreino.userId, A));
    expect(p.some((x) => x.nome === "Plano salvo" && x.ativo)).toBe(true);
  });

  it("rascunho adulterado é recusado e nada é gravado", async () => {
    const antes = (await db.select().from(treinos).where(eq(treinos.userId, A))).length;
    const ruins = [
      "{não é json",
      { ...ok, treinos: [] },
      { ...ok, nome: "   " },
      { ...ok, treinos: [{ ...ok.treinos[0], exercicios: [{ ...ok.treinos[0].exercicios[0], repsMin: 20, repsMax: 5 }] }] },
      { ...ok, treinos: [{ ...ok.treinos[0], exercicios: [{ ...ok.treinos[0].exercicios[0], fotoId: "../../etc/passwd" }] }] },
      { ...ok, usuarioId: B, treinos: ok.treinos.map((t) => ({ ...t, userId: B })) },
    ];
    for (const r of ruins.slice(0, 5)) expect((await salvarRascunhoIa({}, form(r))).erro).toBeTruthy();
    // Campos extras (como userId) são ignorados: o dono vem sempre da sessão.
    await expect(salvarRascunhoIa({}, form(ruins[5]))).rejects.toThrow("REDIRECT");
    expect((await db.select().from(treinos).where(eq(treinos.userId, B))).length).toBe(0);
    expect((await db.select().from(exercicios).where(eq(exercicios.userId, B))).length).toBe(0);
    expect((await db.select().from(treinos).where(eq(treinos.userId, A))).length).toBeGreaterThan(antes);
  });

  it("foto que não existe no catálogo é descartada ao salvar (o plano é gravado sem foto)", async () => {
    const r = structuredClone(ok);
    r.treinos[0].exercicios[0].nomePt = "Exercício com foto inventada";
    r.treinos[0].exercicios[0].fotoId = "Foto_Inventada_123";
    await expect(salvarRascunhoIa({}, form(r))).rejects.toThrow("REDIRECT");
    const [e] = await db.select().from(exercicios).where(eq(exercicios.nome, "Exercício com foto inventada"));
    expect(e.userId).toBe(A);
    expect(e.fotoId).toBeNull();
  });
});
