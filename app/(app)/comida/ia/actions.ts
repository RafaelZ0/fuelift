"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/sessao";
import { conferirEnergia, problemasDeSanidade } from "@/lib/barras";
import { criarAlimentoUsuario, obterAlimento } from "@/lib/dal/alimentos";
import { consumirUsoIa, devolverUsoIa } from "@/lib/dal/ia";
import { criarMedida } from "@/lib/dal/medidas";
import { casarItens, type CandidatoAlimento } from "@/lib/dal/refeicao-ia";
import { criarRegistros } from "@/lib/dal/registros";
import { hojeSaoPaulo } from "@/lib/datas";
import { LIMITE_DIARIO, type TipoUsoIa } from "@/lib/ia/config";
import { verificarAcessoIa } from "@/lib/ia/acesso";
import { ErroIa } from "@/lib/ia/provedor";
import { obterProvedor } from "@/lib/ia/provedor-ativo";
import {
  ESQUEMA_ESTIMATIVA,
  ESQUEMA_REFEICAO,
  INSTRUCAO_SISTEMA_ESTIMATIVA,
  INSTRUCAO_SISTEMA_REFEICAO,
  montarEntradaEstimativa,
  montarEntradaRefeicao,
  sanitizarEstimativa,
  sanitizarRefeicao,
  type EstimativaAlimento,
  type ItemInterpretado,
} from "@/lib/ia/refeicao";
import { registrarErro } from "@/lib/log";
import { calcularNutrientes, GRAMAS_MAX, KCAL_MAX_ITEM } from "@/lib/nutricao";
import { dataDiario, id as idSchema, refeicao as refeicaoSchema, tipoAlimento } from "@/lib/validacao/comida";

// Server Actions são endpoints públicos: cada uma verifica a sessão (e, para a IA, o aceite), valida a
// entrada com Zod e usa o user_id da sessão. A IA só interpreta o texto; os nutrientes vêm do banco, e
// nada é gravado sem o usuário confirmar na tela.

export type ItemRascunho = ItemInterpretado & { candidatos: CandidatoAlimento[] };
export type EstadoRefeicaoIa = { erro?: string; precisaAceite?: boolean; itens?: ItemRascunho[]; descartados?: number };
export type EstadoEstimativa = { erro?: string; estimativa?: EstimativaAlimento };
export type EstadoConfirmar = { erro?: string; candidato?: CandidatoAlimento };
export type EstadoSalvar = { erro?: string };

const MSG = {
  limite: (n: number, o: string) => `Você já usou as ${n} ${o} de hoje. Tente de novo amanhã.`,
  ocupada: "A IA está com muitos pedidos agora. Tente de novo em alguns minutos.",
  falhou: "A IA não respondeu. Tente de novo.",
  ilegivel: "A IA não conseguiu entender esse texto. Escreva o que você comeu com mais detalhes.",
  semItens: "Não encontrei comida nesse texto. Escreva o que você comeu, por exemplo: 2 conchas de feijão e arroz.",
  falha: "Não foi possível salvar agora. Tente de novo.",
} as const;

/** Conta o uso, chama a IA e devolve a resposta bruta. Falhas do provedor devolvem a chamada ao saldo. */
async function chamarProvedor(userId: string, tipo: TipoUsoIa, nomeUso: string, chamada: () => Promise<unknown>): Promise<{ bruto: unknown } | { erro: string }> {
  const dia = hojeSaoPaulo();
  if (!(await consumirUsoIa(userId, dia, tipo))) return { erro: MSG.limite(LIMITE_DIARIO[tipo], nomeUso) };
  try {
    return { bruto: await chamada() };
  } catch (e) {
    const motivo = e instanceof ErroIa ? e.motivo : null;
    if (!motivo) registrarErro("chamarProvedor", e);
    if (motivo === "bloqueada" || motivo === "formato") return { erro: MSG.ilegivel }; // conta como uso
    await devolverUsoIa(userId, dia, tipo);
    return { erro: motivo === "limite_provedor" ? MSG.ocupada : MSG.falhou };
  }
}

// ─── Interpretar o texto ───

export async function interpretarRefeicao(_: EstadoRefeicaoIa, form: FormData): Promise<EstadoRefeicaoIa> {
  const { userId, admin } = await exigirUsuario();
  const acesso = await verificarAcessoIa(userId, admin !== null);
  if (!acesso.ok) return { erro: acesso.erro, precisaAceite: acesso.precisaAceite };
  const entrada = montarEntradaRefeicao(form.get("texto"));
  if (!entrada) return { erro: "Escreva o que você comeu (pelo menos algumas letras)." };

  const r = await chamarProvedor(userId, "texto", "interpretações", () =>
    obterProvedor().gerar({ sistema: INSTRUCAO_SISTEMA_REFEICAO, texto: entrada.texto, arquivos: [], esquema: ESQUEMA_REFEICAO }),
  );
  if ("erro" in r) return { erro: r.erro };
  try {
    const { itens, descartados } = sanitizarRefeicao(r.bruto);
    if (itens.length === 0) return { erro: MSG.semItens };
    const candidatos = await casarItens(userId, itens);
    return { itens: itens.map((item, i) => ({ ...item, candidatos: candidatos[i] })), descartados };
  } catch (e) {
    registrarErro("interpretarRefeicao", e);
    return { erro: MSG.ilegivel };
  }
}

// ─── Estimativa de um alimento que não está no banco (só quando o usuário pede) ───

export async function estimarAlimento(_: EstadoEstimativa, form: FormData): Promise<EstadoEstimativa> {
  const { userId, admin } = await exigirUsuario();
  const acesso = await verificarAcessoIa(userId, admin !== null);
  if (!acesso.ok) return { erro: acesso.erro };
  const entrada = montarEntradaEstimativa(form.get("nome"));
  if (!entrada) return { erro: "Nome do alimento inválido." };

  const r = await chamarProvedor(userId, "estimativa", "estimativas", () =>
    obterProvedor().gerar({ sistema: INSTRUCAO_SISTEMA_ESTIMATIVA, texto: entrada.texto, arquivos: [], esquema: ESQUEMA_ESTIMATIVA }),
  );
  if ("erro" in r) return { erro: r.erro };
  try {
    return { estimativa: sanitizarEstimativa(r.bruto, entrada.nome) };
  } catch {
    return { erro: "A IA não conseguiu estimar esse alimento. Cadastre pelo rótulo ou escolha outro alimento." };
  }
}

const numeroOpc = (max: number) => z.number().min(0).max(max).nullable();
const confirmarSchema = z.object({
  nome: z.string().trim().min(1, "Digite o nome.").max(120, "Nome muito longo."),
  kcal: z.number().min(0).max(900),
  proteinaG: numeroOpc(100),
  carboG: numeroOpc(100),
  gorduraG: numeroOpc(100),
  fibraG: numeroOpc(100),
  sodioMg: numeroOpc(40000),
  medidas: z.array(z.object({ nome: z.string().trim().min(1).max(40), gramas: z.number().gt(0).max(2000) })).max(4),
  confirmarDivergencia: z.boolean(),
});

/** O usuário conferiu (e talvez ajustou) a estimativa: ela vira um alimento DELE, com origem ia_estimativa. */
export async function confirmarEstimativa(entrada: unknown): Promise<EstadoConfirmar> {
  const { userId } = await exigirUsuario();
  const r = confirmarSchema.safeParse(entrada);
  if (!r.success) return { erro: "Há valores inválidos. Confira os números." };
  const d = r.data;
  const nutrientes = { kcal: d.kcal, proteinaG: d.proteinaG, carboG: d.carboG, gorduraG: d.gorduraG, fibraG: d.fibraG, sodioMg: d.sodioMg };
  const problemas = problemasDeSanidade(nutrientes);
  if (problemas.length > 0) return { erro: problemas[0] };
  const conta = conferirEnergia(nutrientes);
  if (!conta.fecha && !d.confirmarDivergencia) {
    return { erro: `As calorias não batem com os macros (pelos macros seriam cerca de ${conta.esperadas} kcal por 100 g). Ajuste os números ou confirme que estão corretos.` };
  }
  try {
    const novoId = await criarAlimentoUsuario(userId, { nome: d.nome, marca: null, ...nutrientes, origem: "ia_estimativa" });
    for (const m of d.medidas) await criarMedida(userId, "usuario", novoId, m.nome, m.gramas);
    revalidatePath("/comida", "layout");
    return { candidato: { tipo: "usuario", id: novoId, nome: d.nome, marca: null, kcal: d.kcal, cobertura: 1 } };
  } catch (e) {
    registrarErro("confirmarEstimativa", e);
    return { erro: MSG.falha };
  }
}

// ─── Salvar a refeição confirmada ───

const salvarSchema = z.object({
  data: dataDiario,
  refeicao: refeicaoSchema,
  itens: z.array(z.object({ tipo: tipoAlimento, alimentoId: idSchema, gramas: z.number().min(0.1).max(GRAMAS_MAX) })).min(1, "Nenhum item para salvar.").max(20),
});

export async function salvarRefeicaoIa(_: EstadoSalvar, form: FormData): Promise<EstadoSalvar> {
  const { userId } = await exigirUsuario();
  let itensBrutos: unknown;
  try {
    const t = form.get("itens");
    itensBrutos = typeof t === "string" && t.length < 20_000 ? JSON.parse(t) : null;
  } catch {
    itensBrutos = null;
  }
  const r = salvarSchema.safeParse({ data: form.get("data"), refeicao: form.get("refeicao"), itens: itensBrutos });
  if (!r.success) return { erro: r.error.issues[0]?.message ?? "Dados inválidos." };
  const { data, refeicao, itens } = r.data;

  try {
    const novos = [];
    for (const it of itens) {
      // O banco é a fonte dos nutrientes: alimento da TACO ou do próprio usuário (de outro usuário = não encontrado).
      const alimento = await obterAlimento(userId, it.tipo, it.alimentoId);
      if (!alimento) return { erro: "Um dos alimentos não foi encontrado. Troque-o e tente de novo." };
      const nutrientes = calcularNutrientes(alimento, it.gramas);
      if (!nutrientes) return { erro: `"${alimento.nome}" está sem calorias na tabela e não pode ser adicionado. Troque o alimento.` };
      if (nutrientes.kcal > KCAL_MAX_ITEM) return { erro: `Quantidade grande demais em "${alimento.nome}". Confira as gramas.` };
      novos.push({
        data,
        refeicao,
        tipo: it.tipo,
        alimentoId: it.alimentoId,
        nome: alimento.marca ? `${alimento.nome} (${alimento.marca})` : alimento.nome,
        gramas: it.gramas,
        medidaTexto: null,
        nutrientes,
        origem: "ia_texto" as const,
      });
    }
    await criarRegistros(userId, novos);
  } catch (e) {
    registrarErro("salvarRefeicaoIa", e);
    return { erro: MSG.falha };
  }
  revalidatePath("/comida");
  redirect(`/comida?data=${data}`);
}
