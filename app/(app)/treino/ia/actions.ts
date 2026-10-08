"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/sessao";
import { buscarNoCatalogo, idsComFoto, ligarAoCatalogo, type ResultadoCatalogo } from "@/lib/dal/catalogo";
import { consumirUsoIa, corpoParaIa, devolverUsoIa, obterAceiteIa, registrarAceiteIa } from "@/lib/dal/ia";
import { exerciciosPorNome, gravarPlanoCompleto } from "@/lib/dal/treino-ia";
import { hojeSaoPaulo } from "@/lib/datas";
import { disponibilidadeIa, LIMITE_DIARIO, LIMITES_ARQUIVO, tipoPeloConteudo, type TipoUsoIa } from "@/lib/ia/config";
import { obterProvedor } from "@/lib/ia/provedor-ativo";
import { montarPlanoParaGravar } from "@/lib/ia/plano";
import {
  alertasFinais,
  INSTRUCAO_SISTEMA_IMPORTACAO,
  INSTRUCAO_SISTEMA_PLANO,
  montarEntradaImportacao,
  montarEntradaPlano,
  pedidoPlanoSchema,
  VERSAO_ACEITE_IA,
  type EntradaIa,
} from "@/lib/ia/prompts";
import { ErroIa, type ArquivoIa } from "@/lib/ia/provedor";
import { rascunhoSchema, sanitizarRespostaDaIa, type Rascunho } from "@/lib/ia/rascunho";
import { registrarErro } from "@/lib/log";
import { errosPorCampo, type ErrosCampos } from "@/lib/validacao/comum";

// Server Actions são endpoints públicos: cada uma verifica a sessão, o aceite, valida a entrada com Zod
// e usa o user_id da sessão. A chave da IA fica só no servidor e a resposta da IA nunca é gravada sem
// passar pela sanitização e pela confirmação do usuário.

export type EstadoIa = { erro?: string; erros?: ErrosCampos; rascunho?: Rascunho; descartados?: number };

const MSG = {
  semAceite: "Antes de usar a IA, leia e aceite o aviso.",
  indisponivel: "A IA não está disponível agora.",
  somenteAdmin: "A IA está liberada só para o administrador por enquanto.",
  limite: (n: number) => `Você já usou as ${n} gerações de hoje. Tente de novo amanhã.`,
  ocupada: "A IA está com muitos pedidos agora. Tente de novo em alguns minutos.",
  falhou: "A IA não respondeu. Tente de novo.",
  semPlano: "A IA não conseguiu montar um plano com esses dados. Ajuste o pedido e tente de novo.",
  falha: "Não foi possível salvar agora. Tente de novo.",
} as const;


async function exigirIa(): Promise<{ userId: string } | { erro: string }> {
  const { userId, admin } = await exigirUsuario();
  const d = disponibilidadeIa({ GEMINI_API_KEY: process.env.GEMINI_API_KEY, IA_SOMENTE_ADMIN: process.env.IA_SOMENTE_ADMIN, IA_PLANO: process.env.IA_PLANO }, admin !== null);
  if (!d.ok) return { erro: d.motivo === "somente_admin" ? MSG.somenteAdmin : MSG.indisponivel };
  const aceite = await obterAceiteIa(userId);
  if (!aceite || aceite.versao < VERSAO_ACEITE_IA) return { erro: MSG.semAceite };
  return { userId };
}

/** Confere o limite, chama a IA e devolve o rascunho limpo. Falhas do provedor devolvem a chamada ao saldo. */
async function chamarIa(userId: string, tipo: TipoUsoIa, sistema: string, entrada: EntradaIa, arquivos: ArquivoIa[], limitacoes: string): Promise<EstadoIa> {
  const dia = hojeSaoPaulo();
  if (!(await consumirUsoIa(userId, dia, tipo))) return { erro: MSG.limite(LIMITE_DIARIO[tipo]) };
  try {
    const bruto = await obterProvedor().gerar({ sistema, texto: entrada.texto, arquivos });
    const { rascunho, descartados } = sanitizarRespostaDaIa(bruto);
    const ligacoes = await ligarAoCatalogo(rascunho.treinos.flatMap((t) => t.exercicios.map((e) => e.nomeEn)));
    let i = 0;
    for (const t of rascunho.treinos) {
      for (const e of t.exercicios) {
        const l = ligacoes[i++];
        if (l) {
          e.fotoId = l.id;
          e.fotoNome = l.nomeEn;
        }
      }
    }
    rascunho.alertas = alertasFinais(rascunho.alertas, limitacoes);
    return { rascunho, descartados };
  } catch (e) {
    const motivo = e instanceof ErroIa ? e.motivo : null;
    if (!motivo) registrarErro("chamarIa", e);
    if (motivo === "limite_provedor") {
      await devolverUsoIa(userId, dia, tipo);
      return { erro: MSG.ocupada };
    }
    if (motivo === "indisponivel" || motivo === "config") {
      await devolverUsoIa(userId, dia, tipo);
      return { erro: MSG.falhou };
    }
    return { erro: MSG.semPlano }; // resposta vazia, bloqueada ou fora do formato: conta como uso
  }
}

// ─── Aceite ───

export async function aceitarUsoIa(_: EstadoIa, form: FormData): Promise<EstadoIa> {
  const { userId } = await exigirUsuario();
  if (form.get("regiao") !== "on" || form.get("dados") !== "on") return { erro: "Marque as duas confirmações para continuar." };
  try {
    await registrarAceiteIa(userId, VERSAO_ACEITE_IA);
  } catch (e) {
    registrarErro("aceitarUsoIa", e);
    return { erro: MSG.falha };
  }
  revalidatePath("/treino/ia");
  redirect("/treino/ia");
}

// ─── Criar plano com a IA ───


export async function gerarPlanoComIa(_: EstadoIa, form: FormData): Promise<EstadoIa> {
  const g = await exigirIa();
  if ("erro" in g) return g;
  const r = pedidoPlanoSchema.safeParse({
    objetivo: form.get("objetivo"),
    nivel: form.get("nivel"),
    dias: form.get("dias"),
    minutos: form.get("minutos"),
    equipamentos: form.getAll("equipamentos"),
    limitacoes: form.get("limitacoes") ?? "",
    enviarSexo: form.get("enviarSexo") === "on",
    enviarIdade: form.get("enviarIdade") === "on",
    enviarAltura: form.get("enviarAltura") === "on",
    enviarPeso: form.get("enviarPeso") === "on",
  });
  if (!r.success) return { erros: errosPorCampo(r.error) };
  const entrada = montarEntradaPlano(r.data, await corpoParaIa(g.userId, hojeSaoPaulo()));
  return chamarIa(g.userId, "plano", INSTRUCAO_SISTEMA_PLANO, entrada, [], r.data.limitacoes);
}

// ─── Importar de imagem ou PDF ───

export async function importarTreinoComIa(_: EstadoIa, form: FormData): Promise<EstadoIa> {
  const g = await exigirIa();
  if ("erro" in g) return g;
  const nota = z.string().trim().max(300).safeParse(form.get("nota") ?? "");
  if (!nota.success) return { erro: "A observação pode ter no máximo 300 caracteres." };
  const enviados = form.getAll("arquivos").filter((f): f is File => f instanceof File && f.size > 0);
  if (enviados.length === 0) return { erro: "Escolha pelo menos um arquivo." };
  if (enviados.length > LIMITES_ARQUIVO.quantidade) return { erro: `Envie no máximo ${LIMITES_ARQUIVO.quantidade} arquivos.` };
  if (enviados.reduce((s, f) => s + f.size, 0) > LIMITES_ARQUIVO.bytesTotal) return { erro: "Os arquivos juntos passam de 6 MB." };

  const arquivos: ArquivoIa[] = [];
  const resumo: Array<{ nome: string; tipo: string; bytes: number }> = [];
  for (const f of enviados) {
    if (f.size > LIMITES_ARQUIVO.bytesPorArquivo) return { erro: "Cada arquivo pode ter no máximo 4 MB." };
    const dados = new Uint8Array(await f.arrayBuffer());
    const tipo = tipoPeloConteudo(dados); // o tipo declarado pelo navegador não é confiável
    if (!tipo) return { erro: "Use apenas imagens (JPEG, PNG, WebP) ou PDF." };
    arquivos.push({ mimeType: tipo, dados });
    resumo.push({ nome: f.name, tipo, bytes: f.size });
  }
  const entrada = montarEntradaImportacao(resumo, nota.data);
  return chamarIa(g.userId, "importacao", INSTRUCAO_SISTEMA_IMPORTACAO, entrada, arquivos, "");
}

// ─── Salvar o rascunho confirmado ───

export async function salvarRascunhoIa(_: EstadoIa, form: FormData): Promise<EstadoIa> {
  const { userId } = await exigirUsuario();
  const texto = form.get("rascunho");
  if (typeof texto !== "string" || texto.length > 200_000) return { erro: "Rascunho inválido." };
  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return { erro: "Rascunho inválido." };
  }
  const r = rascunhoSchema.safeParse(json); // o rascunho voltou do navegador: revalida do zero
  if (!r.success) return { erro: "Há campos inválidos no rascunho. Confira nomes, séries e repetições." };
  const rascunho: Rascunho = r.data;
  try {
    const fotosValidas = await idsComFoto(rascunho.treinos.flatMap((t) => t.exercicios.map((e) => e.fotoId).filter((x): x is string => x !== null)));
    const plano = montarPlanoParaGravar(rascunho, await exerciciosPorNome(userId), fotosValidas, hojeSaoPaulo());
    await gravarPlanoCompleto(userId, plano);
  } catch (e) {
    registrarErro("salvarRascunhoIa", e);
    return { erro: MSG.falha };
  }
  revalidatePath("/treino");
  revalidatePath("/treino/plano");
  redirect("/treino/plano");
}

// ─── Busca de foto no catálogo ───

export async function buscarFotoNoCatalogo(termo: string): Promise<ResultadoCatalogo[]> {
  await exigirUsuario();
  if (typeof termo !== "string" || termo.length > 60) return [];
  try {
    return await buscarNoCatalogo(termo, 12);
  } catch (e) {
    registrarErro("buscarFotoNoCatalogo", e);
    return [];
  }
}
