"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/sessao";
import { consumirUsoIa, devolverUsoIa } from "@/lib/dal/ia";
import { carregarEnergia, definirRitmoMax, guardarProjecao } from "@/lib/dal/energia";
import { salvarMeta } from "@/lib/dal/metas";
import { hojeSaoPaulo } from "@/lib/datas";
import { verificarAcessoIa } from "@/lib/ia/acesso";
import { LIMITE_DIARIO } from "@/lib/ia/config";
import { ESQUEMA_META, explicacaoFixa, INSTRUCAO_SISTEMA_META, montarEntradaMeta, numerosPermitidos, sanitizarExplicacao, type DadosExplicacao, type ExplicacaoMeta } from "@/lib/ia/metas";
import { ErroIa } from "@/lib/ia/provedor";
import { obterProvedor } from "@/lib/ia/provedor-ativo";
import { registrarErro } from "@/lib/log";
import { dividirMacros, projetarPeso, type OpcaoRitmo } from "@/lib/projecao";
import { errosPorCampo, formParaObjeto, type ErrosCampos } from "@/lib/validacao/comum";
import { dataOpcional, decimalOpcional } from "@/lib/validacao/comum";

// Server Actions são endpoints públicos: sessão, Zod e user_id da sessão. Os números da meta são SEMPRE
// recalculados aqui no servidor a partir do banco; o navegador só diz QUAL opção (leve, moderado ou firme).

const FALHA = "Não foi possível salvar agora. Tente de novo.";

export type EstadoMeta = { ok?: string; erro?: string; erros?: ErrosCampos };
export type EstadoExplicacao = { erro?: string; explicacao?: ExplicacaoMeta; viaIa?: boolean };

// ─── Peso desejado e data ───

// Montado a cada chamada: a data mínima é "hoje" de verdade (o servidor pode ficar dias no ar).
const pesoMetaSchema = () =>
  z.object({
    pesoMetaKg: decimalOpcional(20, 400, "Peso desejado"),
    dataMeta: dataOpcional("Data desejada", { min: hojeSaoPaulo() }),
  });

export async function salvarPesoMeta(_: EstadoMeta, form: FormData): Promise<EstadoMeta> {
  const { userId } = await exigirUsuario();
  const r = pesoMetaSchema().safeParse(formParaObjeto(form, ["pesoMetaKg", "dataMeta"]));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  if (r.data.dataMeta && r.data.pesoMetaKg === null) return { erros: { pesoMetaKg: "Informe o peso desejado para usar uma data." } };
  try {
    const hoje = hojeSaoPaulo();
    const { meta } = await carregarEnergia(userId, hoje);
    await salvarMeta(
      userId,
      {
        kcal: meta?.kcal ?? null,
        proteinaG: meta?.proteinaG ?? null,
        carboG: meta?.carboG ?? null,
        gorduraG: meta?.gorduraG ?? null,
        aguaMl: meta?.aguaMl ?? null,
        pesoMetaKg: r.data.pesoMetaKg,
        dataMeta: r.data.dataMeta,
        observacao: meta?.observacao ?? null,
      },
      hoje,
    );
  } catch (e) {
    registrarErro("salvarPesoMeta", e);
    return { erro: FALHA };
  }
  revalidatePath("/progresso/meta");
  return { ok: "Salvo." };
}

// ─── Ritmo máximo (só para MENOS: o teto de 1% por semana não muda) ───

const ritmoSchema = z.object({ ritmo: z.enum(["0.25", "0.5", "0.75", "1"]).transform(Number) });

export async function salvarRitmoMax(_: EstadoMeta, form: FormData): Promise<EstadoMeta> {
  const { userId } = await exigirUsuario();
  const r = ritmoSchema.safeParse({ ritmo: form.get("ritmo") });
  if (!r.success) return { erro: "Escolha um ritmo da lista." };
  try {
    await definirRitmoMax(userId, r.data.ritmo);
  } catch (e) {
    registrarErro("salvarRitmoMax", e);
    return { erro: FALHA };
  }
  revalidatePath("/progresso/meta");
  return { ok: "Ritmo máximo salvo." };
}

// ─── Opções recalculadas no servidor ───

const opcaoSchema = z.enum(["leve", "moderado", "firme"]);

async function opcaoDoServidor(userId: string, id: z.infer<typeof opcaoSchema>) {
  const hoje = hojeSaoPaulo();
  const dados = await carregarEnergia(userId, hoje);
  const p = dados.painel;
  if (!p.gasto || !p.planejamento || p.pesoAtualKg === null || p.tmb === null || p.fatorAtividade === null) return { erro: "Complete o perfil e defina o peso desejado primeiro." } as const;
  const opcao = p.planejamento.opcoes.find((o) => o.id === id);
  if (!opcao) return { erro: "Essa opção não está disponível para a sua meta." } as const;
  const macros = dividirMacros({ kcal: opcao.kcal, pesoKg: p.pesoAtualKg, emDeficit: p.planejamento.tipo === "perder" });
  return { dados, painel: p, opcao, macros, hoje } as const;
}

// ─── Explicar a opção (IA só explica; números fixos do app) ───

export async function explicarOpcaoMeta(_: EstadoExplicacao, form: FormData): Promise<EstadoExplicacao> {
  const { userId, admin } = await exigirUsuario();
  const id = opcaoSchema.safeParse(form.get("opcao"));
  if (!id.success) return { erro: "Opção inválida." };
  const o = await opcaoDoServidor(userId, id.data);
  if ("erro" in o) return { erro: o.erro };
  const { painel, opcao, macros } = o;
  const dados: DadosExplicacao = {
    tipo: painel.planejamento!.tipo,
    pesoAtualKg: painel.pesoAtualKg!,
    pesoMetaKg: o.dados.meta?.pesoMetaKg ?? painel.pesoAtualKg!,
    gastoKcal: painel.gasto!.valor,
    gastoMinimo: painel.gasto!.minimo,
    gastoMaximo: painel.gasto!.maximo,
    gastoMetodo: painel.gasto!.metodo === "adaptativo" ? "calculado com seus dados reais" : "fórmula",
    tmbKcal: painel.tmb!,
    opcao: pick(opcao),
    macros,
    avisos: painel.planejamento!.avisos.map((a) => a.texto),
  };
  const fixa = explicacaoFixa(dados);

  // Sem IA disponível ou sem aceite: a explicação fixa do app já responde (não é erro).
  const acesso = await verificarAcessoIa(userId, admin !== null);
  if (!acesso.ok) return { explicacao: fixa, viaIa: false };
  const dia = hojeSaoPaulo();
  if (!(await consumirUsoIa(userId, dia, "metas"))) {
    return { explicacao: fixa, viaIa: false, erro: `Você já usou as ${LIMITE_DIARIO.metas} explicações de hoje; mostrando a explicação do app.` };
  }
  try {
    const bruto = await obterProvedor().gerar({ sistema: INSTRUCAO_SISTEMA_META, texto: montarEntradaMeta(dados), arquivos: [], esquema: ESQUEMA_META });
    const limpa = sanitizarExplicacao(bruto, numerosPermitidos(dados));
    return limpa ? { explicacao: limpa, viaIa: true } : { explicacao: fixa, viaIa: false };
  } catch (e) {
    const motivo = e instanceof ErroIa ? e.motivo : null;
    if (!motivo) registrarErro("explicarOpcaoMeta", e);
    if (motivo !== "bloqueada" && motivo !== "formato") await devolverUsoIa(userId, dia, "metas");
    return { explicacao: fixa, viaIa: false };
  }
}

function pick(o: OpcaoRitmo): DadosExplicacao["opcao"] {
  return { rotulo: o.rotulo, kcal: o.kcal, kgSemana: o.kgSemana, pctSemana: o.pctSemana, deficitDia: o.deficitDia, semanasParaMeta: o.semanasParaMeta, limitadaPorTmb: o.limitadaPorTmb };
}

// ─── Usar a opção como meta (só depois do clique do usuário) ───

export async function aplicarOpcaoMeta(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const id = opcaoSchema.safeParse(form.get("opcao"));
  if (!id.success) return;
  const o = await opcaoDoServidor(userId, id.data);
  if ("erro" in o) return;
  const { dados, painel, opcao, macros, hoje } = o;
  try {
    const m = dados.meta;
    await salvarMeta(
      userId,
      {
        kcal: opcao.kcal,
        proteinaG: macros.proteinaG,
        carboG: macros.carboG,
        gorduraG: macros.gorduraG,
        aguaMl: m?.aguaMl ?? null,
        pesoMetaKg: m?.pesoMetaKg ?? null,
        dataMeta: m?.dataMeta ?? null,
        observacao: `Opção "${opcao.rotulo}" sugerida pelo app (estimativa), confirmada por você em ${hoje.split("-").reverse().join("/")}.`,
      },
      hoje,
    );
    if (m?.pesoMetaKg != null && painel.pesoAtualKg !== null && painel.gasto && painel.fatorAtividade !== null) {
      const proj = projetarPeso({ pesoInicial: painel.pesoAtualKg, gastoInicial: painel.gasto.valor, consumoDiario: opcao.kcal, fatorAtividade: painel.fatorAtividade, pesoMeta: m.pesoMetaKg });
      await guardarProjecao(userId, {
        pesoInicialKg: painel.pesoAtualKg,
        pesoMetaKg: m.pesoMetaKg,
        consumoKcal: opcao.kcal,
        gastoKcal: painel.gasto.valor,
        semanasParaMeta: proj.semanasParaMeta,
        pontos: proj.pontos.map((p) => ({ semana: p.semana, peso: p.peso })),
      });
    }
  } catch (e) {
    registrarErro("aplicarOpcaoMeta", e);
    return;
  }
  revalidatePath("/progresso/meta");
  revalidatePath("/ajustes");
  revalidatePath("/hoje");
  redirect("/progresso/meta?salva=1");
}
