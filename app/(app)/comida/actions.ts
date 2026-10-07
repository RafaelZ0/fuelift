"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/sessao";
import {
  atualizarAlimentoUsuario,
  buscarAlimentos,
  criarAlimentoUsuario,
  excluirAlimentoUsuario,
  obterAlimento,
  type AlimentoResumo,
} from "@/lib/dal/alimentos";
import { alternarFavorito, criarMedida, excluirMedida, obterMedida } from "@/lib/dal/medidas";
import {
  criarRefeicaoSalva,
  excluirRefeicaoSalva,
  itensDaRefeicaoSalva,
} from "@/lib/dal/refeicoes-salvas";
import {
  atualizarRegistro,
  criarRegistros,
  excluirRegistro,
  itensDaRefeicao,
} from "@/lib/dal/registros";
import { montarRegistros } from "@/lib/diario";
import { dentroDoLimite } from "@/lib/limites";
import { registrarErro } from "@/lib/log";
import { calcularNutrientes, gramasDaMedida, paraPor100g } from "@/lib/nutricao";
import { errosPorCampo, formParaObjeto, type ErrosCampos } from "@/lib/validacao/comum";
import {
  adicionarSchema,
  alimentoUsuarioSchema,
  buscaSchema,
  CAMPOS_ALIMENTO,
  copiarSchema,
  dataDiario,
  editarRegistroSchema,
  id as idSchema,
  medidaSchema,
  nomeRefeicaoSalvaSchema,
  refeicao as refeicaoSchema,
  tipoAlimento,
} from "@/lib/validacao/comida";

// Server Actions são endpoints públicos: cada uma verifica a sessão, valida a
// entrada com Zod e usa o user_id da sessão. Ids recebidos são conferidos na DAL
// (filtro por user_id) e, para dados do usuário, também pelo banco (FK por id + user_id).

export type Estado = { ok?: string; erro?: string; erros?: ErrosCampos };
const FALHA = "Não foi possível salvar agora. Tente de novo.";

const urlDia = (data: string) => `/comida?data=${data}`;

// ─── Busca ───

export async function buscar(termo: string): Promise<{ resultados: AlimentoResumo[]; erro?: string }> {
  const { userId } = await exigirUsuario();
  const r = buscaSchema.safeParse(termo);
  if (!r.success) return { resultados: [], erro: r.error.issues[0]?.message };
  if (!(await dentroDoLimite([{ tipo: "buscaPorUsuario", valor: userId }]))) {
    return { resultados: [], erro: "Muitas buscas seguidas. Espere um minuto." };
  }
  try {
    return { resultados: await buscarAlimentos(userId, r.data) };
  } catch (e) {
    registrarErro("buscar", e);
    return { resultados: [], erro: "A busca falhou. Tente de novo." };
  }
}

// ─── Registros ───

export async function adicionar(_: Estado, form: FormData): Promise<Estado> {
  const { userId } = await exigirUsuario();
  const f = formParaObjeto(form, ["data", "refeicao", "tipo", "alimentoId", "modo", "gramas", "medidaId", "quantidade"]);
  const r = adicionarSchema.safeParse({
    data: f.data,
    refeicao: f.refeicao,
    tipo: f.tipo,
    alimentoId: f.alimentoId,
    quantidade:
      f.modo === "medida"
        ? { modo: "medida", medidaId: f.medidaId, quantidade: f.quantidade }
        : { modo: "gramas", gramas: f.gramas },
  });
  if (!r.success) {
    const erros = errosPorCampo(r.error);
    return { erros: { ...erros, gramas: erros.quantidade ?? erros.gramas } };
  }
  const { data, refeicao, tipo, alimentoId, quantidade } = r.data;

  try {
    const alimento = await obterAlimento(userId, tipo, alimentoId);
    if (!alimento) return { erro: "Alimento não encontrado." };

    let gramas: number;
    let medidaTexto: string | null = null;
    if (quantidade.modo === "gramas") {
      gramas = quantidade.gramas;
    } else {
      const medida = await obterMedida(userId, quantidade.medidaId);
      const daMedida = tipo === "base" ? medida?.alimentoBaseId : medida?.alimentoUsuarioId;
      if (!medida || daMedida !== alimentoId) return { erro: "Medida não encontrada." };
      gramas = gramasDaMedida(medida.gramas, quantidade.quantidade);
      medidaTexto = `${quantidade.quantidade.toLocaleString("pt-BR")} × ${medida.nome}`;
    }
    if (gramas > 5000) return { erros: { gramas: "Quantidade acima de 5 kg." } };

    const nutrientes = calcularNutrientes(alimento, gramas);
    if (!nutrientes) return { erro: "Este alimento está sem calorias na tabela e não pode ser adicionado." };
    if (nutrientes.kcal > 10000) return { erros: { gramas: "Quantidade grande demais para um item." } };

    await criarRegistros(userId, [
      {
        data,
        refeicao,
        tipo,
        alimentoId,
        nome: alimento.marca ? `${alimento.nome} (${alimento.marca})` : alimento.nome,
        gramas,
        medidaTexto,
        nutrientes,
      },
    ]);
  } catch (e) {
    registrarErro("adicionar", e);
    return { erro: FALHA };
  }
  revalidatePath("/comida");
  redirect(urlDia(data));
}

export async function editarRegistro(_: Estado, form: FormData): Promise<Estado> {
  const { userId } = await exigirUsuario();
  const r = editarRegistroSchema.safeParse(formParaObjeto(form, ["registroId", "refeicao", "gramas"]));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  const data = dataDiario.safeParse(form.get("data"));
  try {
    if (!(await atualizarRegistro(userId, r.data.registroId, r.data.refeicao, r.data.gramas))) {
      return { erro: "Registro não encontrado." };
    }
  } catch (e) {
    registrarErro("editarRegistro", e);
    return { erro: FALHA };
  }
  revalidatePath("/comida");
  redirect(data.success ? urlDia(data.data) : "/comida");
}

export async function apagarRegistro(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const id = idSchema.safeParse(form.get("registroId"));
  const data = dataDiario.safeParse(form.get("data"));
  if (!id.success) return;
  try {
    await excluirRegistro(userId, id.data);
  } catch (e) {
    registrarErro("apagarRegistro", e);
  }
  revalidatePath("/comida");
  redirect(data.success ? urlDia(data.data) : "/comida");
}

// ─── Favoritos e medidas ───

export async function favoritar(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const r = z.object({ tipo: tipoAlimento, alimentoId: idSchema }).safeParse(formParaObjeto(form, ["tipo", "alimentoId"]));
  if (!r.success) return;
  try {
    // O alimento precisa existir e ser visível para o usuário (TACO ou dele).
    if (await obterAlimento(userId, r.data.tipo, r.data.alimentoId)) {
      await alternarFavorito(userId, r.data.tipo, r.data.alimentoId);
    }
  } catch (e) {
    registrarErro("favoritar", e);
  }
  revalidatePath("/comida", "layout");
}

export async function salvarMedida(_: Estado, form: FormData): Promise<Estado> {
  const { userId } = await exigirUsuario();
  const r = medidaSchema.safeParse(formParaObjeto(form, ["tipo", "alimentoId", "nome", "gramas"]));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  try {
    if (!(await obterAlimento(userId, r.data.tipo, r.data.alimentoId))) return { erro: "Alimento não encontrado." };
    const res = await criarMedida(userId, r.data.tipo, r.data.alimentoId, r.data.nome, r.data.gramas);
    if (res === "duplicada") return { erros: { nome: "Você já tem uma medida com esse nome." } };
  } catch (e) {
    registrarErro("salvarMedida", e);
    return { erro: FALHA };
  }
  revalidatePath("/comida", "layout");
  return { ok: "Medida salva." };
}

export async function apagarMedida(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const id = idSchema.safeParse(form.get("medidaId"));
  if (!id.success) return;
  try {
    await excluirMedida(userId, id.data);
  } catch (e) {
    registrarErro("apagarMedida", e);
  }
  revalidatePath("/comida", "layout");
}

// ─── Alimentos do usuário (rótulo) ───

export async function salvarAlimento(_: Estado, form: FormData): Promise<Estado> {
  const { userId } = await exigirUsuario();
  const r = alimentoUsuarioSchema.safeParse(formParaObjeto(form, CAMPOS_ALIMENTO));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  const alimentoId = form.get("alimentoId");
  const editar = typeof alimentoId === "string" && alimentoId !== "" ? idSchema.safeParse(alimentoId) : null;
  if (editar && !editar.success) return { erro: "Alimento inválido." };

  // Converte os valores da porção do rótulo para 100 g.
  const p = r.data.porcaoG;
  const dados = {
    nome: r.data.nome,
    marca: r.data.marca,
    kcal: paraPor100g(r.data.kcal, p)!,
    proteinaG: paraPor100g(r.data.proteinaG, p),
    carboG: paraPor100g(r.data.carboG, p),
    gorduraG: paraPor100g(r.data.gorduraG, p),
    fibraG: paraPor100g(r.data.fibraG, p),
    sodioMg: paraPor100g(r.data.sodioMg, p),
  };
  if (dados.kcal > 900) return { erros: { kcal: "Passa de 900 kcal por 100 g. Confira o rótulo e a porção." } };
  for (const campo of ["proteinaG", "carboG", "gorduraG", "fibraG"] as const) {
    const v = dados[campo];
    if (v !== null && v > 100) return { erros: { [campo]: "Passa de 100 g por 100 g. Confira o rótulo e a porção." } };
  }
  if ((dados.proteinaG ?? 0) + (dados.carboG ?? 0) + (dados.gorduraG ?? 0) > 100.5) {
    return { erro: "Proteína + carboidrato + gordura passam de 100 g por 100 g. Confira o rótulo." };
  }
  if (dados.sodioMg !== null && dados.sodioMg > 40000) return { erros: { sodioMg: "Sódio alto demais. Confira o rótulo." } };

  let novoId: string | null = null;
  try {
    if (editar?.success) {
      if (!(await atualizarAlimentoUsuario(userId, editar.data, dados))) return { erro: "Alimento não encontrado." };
    } else {
      novoId = await criarAlimentoUsuario(userId, dados);
    }
  } catch (e) {
    registrarErro("salvarAlimento", e);
    return { erro: FALHA };
  }
  revalidatePath("/comida", "layout");
  if (novoId) {
    const volta = new URLSearchParams();
    const data = dataDiario.safeParse(form.get("data"));
    const ref = refeicaoSchema.safeParse(form.get("refeicao"));
    if (data.success) volta.set("data", data.data);
    if (ref.success) volta.set("refeicao", ref.data);
    redirect(`/comida/alimento/usuario/${novoId}${volta.size ? `?${volta}` : ""}`);
  }
  return { ok: "Alimento atualizado." };
}

export async function apagarAlimento(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const id = idSchema.safeParse(form.get("alimentoId"));
  if (!id.success) return;
  try {
    await excluirAlimentoUsuario(userId, id.data);
  } catch (e) {
    registrarErro("apagarAlimento", e);
  }
  revalidatePath("/comida", "layout");
  redirect("/comida/meus-alimentos");
}

// ─── Refeições salvas e copiar refeição ───

export async function salvarComoRefeicao(_: Estado, form: FormData): Promise<Estado> {
  const { userId } = await exigirUsuario();
  const r = z
    .object({ data: dataDiario, refeicao: refeicaoSchema, nome: nomeRefeicaoSalvaSchema })
    .safeParse(formParaObjeto(form, ["data", "refeicao", "nome"]));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  try {
    const itens = (await itensDaRefeicao(userId, r.data.data, r.data.refeicao)).filter(
      (i) => i.alimentoBaseId || i.alimentoUsuarioId,
    );
    if (itens.length === 0) return { erro: "Essa refeição não tem itens para salvar." };
    await criarRefeicaoSalva(userId, r.data.nome, itens.slice(0, 30));
  } catch (e) {
    registrarErro("salvarComoRefeicao", e);
    return { erro: FALHA };
  }
  revalidatePath("/comida", "layout");
  return { ok: "Refeição salva." };
}

export async function usarRefeicaoSalva(_: Estado, form: FormData): Promise<Estado> {
  const { userId } = await exigirUsuario();
  const r = z
    .object({ refeicaoSalvaId: idSchema, data: dataDiario, refeicao: refeicaoSchema })
    .safeParse(formParaObjeto(form, ["refeicaoSalvaId", "data", "refeicao"]));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  let pulados = 0;
  try {
    const itens = await itensDaRefeicaoSalva(userId, r.data.refeicaoSalvaId);
    if (!itens) return { erro: "Refeição salva não encontrada." };
    const montados = await montarRegistros(userId, r.data.data, r.data.refeicao, itens);
    pulados = montados.pulados;
    await criarRegistros(userId, montados.registros);
  } catch (e) {
    registrarErro("usarRefeicaoSalva", e);
    return { erro: FALHA };
  }
  revalidatePath("/comida");
  if (pulados > 0) return { ok: `Adicionado. ${pulados} item(ns) não puderam ser recalculados e ficaram de fora.` };
  redirect(urlDia(r.data.data));
}

export async function apagarRefeicaoSalva(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const id = idSchema.safeParse(form.get("refeicaoSalvaId"));
  if (!id.success) return;
  try {
    await excluirRefeicaoSalva(userId, id.data);
  } catch (e) {
    registrarErro("apagarRefeicaoSalva", e);
  }
  revalidatePath("/comida", "layout");
}

/** Copia uma refeição de outro dia, recalculando os nutrientes como registros novos. */
export async function copiarRefeicao(_: Estado, form: FormData): Promise<Estado> {
  const { userId } = await exigirUsuario();
  const r = copiarSchema.safeParse(formParaObjeto(form, ["deData", "deRefeicao", "paraData", "paraRefeicao"]));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  if (r.data.deData === r.data.paraData && r.data.deRefeicao === r.data.paraRefeicao) {
    return { erro: "Escolha outro dia ou outra refeição para copiar." };
  }
  let pulados = 0;
  try {
    const itens = await itensDaRefeicao(userId, r.data.deData, r.data.deRefeicao);
    if (itens.length === 0) return { erro: "Não há nada registrado nessa refeição." };
    const montados = await montarRegistros(userId, r.data.paraData, r.data.paraRefeicao, itens);
    pulados = montados.pulados;
    await criarRegistros(userId, montados.registros);
  } catch (e) {
    registrarErro("copiarRefeicao", e);
    return { erro: FALHA };
  }
  revalidatePath("/comida");
  if (pulados > 0) return { ok: `Copiado. ${pulados} item(ns) sem alimento ligado ficaram de fora.` };
  redirect(urlDia(r.data.paraData));
}
