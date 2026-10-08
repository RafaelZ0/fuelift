"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/sessao";
import {
  adicionarItem,
  adicionarSubstituto,
  apagarSerie,
  apagarSessao,
  atualizarExercicio,
  atualizarPlano,
  atualizarTreino,
  criarExercicio,
  criarPlano,
  criarTreino,
  definirAgenda,
  definirTroca,
  excluirExercicio,
  excluirTreino,
  planoAtivo,
  registrarFalta,
  removerItem,
  removerSubstituto,
  removerTroca,
  salvarObservacaoDaSessao,
  salvarSerie,
} from "@/lib/dal/treino";
import { idsComFoto } from "@/lib/dal/catalogo";
import { registrarErro } from "@/lib/log";
import { errosPorCampo, formParaObjeto, type ErrosCampos } from "@/lib/validacao/comum";
import {
  agendaSchema,
  concluirSchema,
  dataQualquer,
  exercicioSchema,
  faltaSchema,
  id as idSchema,
  planoSchema,
  serieSchema,
  trocaSchema,
  treinoExercicioSchema,
  treinoSchema,
} from "@/lib/validacao/treino";

// Server Actions são endpoints públicos: cada uma verifica a sessão, valida a entrada com Zod
// e usa o user_id da sessão. Ids recebidos são conferidos na DAL (filtro por user_id) e, nas
// tabelas ligadas, também pelo banco (FK por id + user_id).

export type EstadoTreino = { ok?: string; erro?: string; erros?: ErrosCampos };
const FALHA = "Não foi possível salvar agora. Tente de novo.";

// ─── Exercícios ───

export async function salvarExercicio(_: EstadoTreino, form: FormData): Promise<EstadoTreino> {
  const { userId } = await exigirUsuario();
  const r = exercicioSchema.safeParse(formParaObjeto(form, ["nome", "grupo", "unilateral", "cargaPorHalter", "medida", "fotoId"]));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  // A foto só vale se existir no catálogo (o id vem do navegador, então é conferido aqui).
  if (r.data.fotoId && !(await idsComFoto([r.data.fotoId])).has(r.data.fotoId)) return { erros: { fotoId: "Escolha uma foto da busca." } };
  const alvo = form.get("exercicioId");
  const editar = typeof alvo === "string" && alvo !== "" ? idSchema.safeParse(alvo) : null;
  if (editar && !editar.success) return { erro: "Exercício inválido." };
  try {
    if (editar?.success) {
      if (!(await atualizarExercicio(userId, editar.data, r.data))) return { erro: "Exercício não encontrado." };
    } else {
      await criarExercicio(userId, r.data);
    }
  } catch (e) {
    registrarErro("salvarExercicio", e);
    return { erro: FALHA };
  }
  revalidatePath("/treino", "layout");
  return { ok: editar ? "Exercício atualizado." : "Exercício criado." };
}

export async function apagarExercicio(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const r = idSchema.safeParse(form.get("exercicioId"));
  if (!r.success) return;
  try {
    await excluirExercicio(userId, r.data);
  } catch (e) {
    registrarErro("apagarExercicio", e);
  }
  revalidatePath("/treino", "layout");
  redirect("/treino/exercicios");
}

// ─── Plano ───

export async function salvarPlano(_: EstadoTreino, form: FormData): Promise<EstadoTreino> {
  const { userId } = await exigirUsuario();
  const r = planoSchema.safeParse(formParaObjeto(form, ["nome", "inicio", "seriesInicio", "seriesDepois", "semanasInicio"]));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  const alvo = form.get("planoId");
  const editar = typeof alvo === "string" && alvo !== "" ? idSchema.safeParse(alvo) : null;
  if (editar && !editar.success) return { erro: "Plano inválido." };
  try {
    if (editar?.success) {
      if (!(await atualizarPlano(userId, editar.data, r.data))) return { erro: "Plano não encontrado." };
    } else {
      await criarPlano(userId, r.data);
    }
  } catch (e) {
    registrarErro("salvarPlano", e);
    return { erro: FALHA };
  }
  revalidatePath("/treino", "layout");
  return { ok: "Plano salvo." };
}

export async function salvarTreino(_: EstadoTreino, form: FormData): Promise<EstadoTreino> {
  const { userId } = await exigirUsuario();
  const r = treinoSchema.safeParse(formParaObjeto(form, ["nome", "foco"]));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  const alvo = form.get("treinoId");
  const editar = typeof alvo === "string" && alvo !== "" ? idSchema.safeParse(alvo) : null;
  if (editar && !editar.success) return { erro: "Treino inválido." };
  try {
    if (editar?.success) {
      if (!(await atualizarTreino(userId, editar.data, r.data.nome, r.data.foco))) return { erro: "Treino não encontrado." };
    } else {
      const plano = await planoAtivo(userId);
      if (!plano) return { erro: "Crie o plano primeiro." };
      await criarTreino(userId, plano.id, r.data.nome, r.data.foco);
    }
  } catch (e) {
    registrarErro("salvarTreino", e);
    return { erro: FALHA };
  }
  revalidatePath("/treino", "layout");
  return { ok: "Treino salvo." };
}

export async function apagarTreino(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const r = idSchema.safeParse(form.get("treinoId"));
  if (!r.success) return;
  try {
    await excluirTreino(userId, r.data);
  } catch (e) {
    registrarErro("apagarTreino", e);
  }
  revalidatePath("/treino", "layout");
}

export async function adicionarExercicioAoTreino(_: EstadoTreino, form: FormData): Promise<EstadoTreino> {
  const { userId } = await exigirUsuario();
  const r = treinoExercicioSchema.safeParse(
    formParaObjeto(form, ["treinoId", "exercicioId", "series", "repsMin", "repsMax", "descansoS", "observacao"]),
  );
  if (!r.success) return { erros: errosPorCampo(r.error) };
  try {
    await adicionarItem(userId, r.data);
  } catch (e) {
    registrarErro("adicionarExercicioAoTreino", e);
    return { erro: "Não foi possível adicionar. Confira se o exercício e o treino são seus." };
  }
  revalidatePath("/treino", "layout");
  return { ok: "Exercício adicionado." };
}

export async function removerExercicioDoTreino(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const r = idSchema.safeParse(form.get("itemId"));
  if (!r.success) return;
  try {
    await removerItem(userId, r.data);
  } catch (e) {
    registrarErro("removerExercicioDoTreino", e);
  }
  revalidatePath("/treino", "layout");
}

const subSchema = z.object({ itemId: idSchema, exercicioId: idSchema });

export async function adicionarSubstitutoAoItem(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const r = subSchema.safeParse(formParaObjeto(form, ["itemId", "exercicioId"]));
  if (!r.success) return;
  try {
    await adicionarSubstituto(userId, r.data.itemId, r.data.exercicioId);
  } catch (e) {
    registrarErro("adicionarSubstitutoAoItem", e);
  }
  revalidatePath("/treino", "layout");
}

export async function removerSubstitutoDoItem(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const r = subSchema.safeParse(formParaObjeto(form, ["itemId", "exercicioId"]));
  if (!r.success) return;
  try {
    await removerSubstituto(userId, r.data.itemId, r.data.exercicioId);
  } catch (e) {
    registrarErro("removerSubstitutoDoItem", e);
  }
  revalidatePath("/treino", "layout");
}

// ─── Agenda e troca do dia ───

export async function definirAgendaDoDia(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const r = agendaSchema.safeParse(formParaObjeto(form, ["diaSemana", "treinoId"]));
  if (!r.success) return;
  try {
    await definirAgenda(userId, r.data.diaSemana, r.data.treinoId);
  } catch (e) {
    registrarErro("definirAgendaDoDia", e);
  }
  revalidatePath("/treino", "layout");
}

/** treinoId: um treino, "descanso" ou "agenda" (volta ao treino da agenda semanal). */
export async function trocarTreinoDoDia(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const bruto = form.get("treinoId");
  const data = dataQualquer.safeParse(form.get("data"));
  if (!data.success) return;
  try {
    if (bruto === "agenda") {
      await removerTroca(userId, data.data);
    } else {
      const r = trocaSchema.safeParse({ data: data.data, treinoId: bruto });
      if (!r.success) return;
      await definirTroca(userId, r.data.data, r.data.treinoId);
    }
  } catch (e) {
    registrarErro("trocarTreinoDoDia", e);
  }
  revalidatePath("/treino", "layout");
}

// ─── Execução do treino ───

export type EntradaSerie = {
  data: string;
  treinoId: string | null;
  exercicioId: string;
  numero: number;
  cargaKg: number;
  repeticoes: number | null;
  segundos: number | null;
  feito: boolean;
};

const arred = (n: number) => String(Math.round(n * 100) / 100);

/** Chamada pelo botão "feito" da série. Retorna sucesso ou a mensagem de erro. */
export async function salvarSerieDoDia(e: EntradaSerie): Promise<{ ok: boolean; erro?: string }> {
  const { userId } = await exigirUsuario();
  const r = serieSchema.safeParse({
    data: e.data,
    treinoId: e.treinoId ?? "",
    exercicioId: e.exercicioId,
    numero: String(e.numero),
    cargaKg: arred(Number(e.cargaKg)),
    repeticoes: e.repeticoes === null ? "" : String(Math.round(Number(e.repeticoes))),
    segundos: e.segundos === null ? "" : String(Math.round(Number(e.segundos))),
    feito: e.feito,
  });
  if (!r.success) return { ok: false, erro: r.error.issues[0]?.message ?? "Valor inválido." };
  try {
    await salvarSerie(userId, r.data);
  } catch (err) {
    registrarErro("salvarSerieDoDia", err);
    return { ok: false, erro: FALHA };
  }
  return { ok: true };
}

export async function apagarSerieDoDia(data: string, exercicioId: string, numero: number): Promise<{ ok: boolean }> {
  const { userId } = await exigirUsuario();
  const r = z.object({ data: dataQualquer, exercicioId: idSchema, numero: z.number().int().min(1).max(30) }).safeParse({ data, exercicioId, numero });
  if (!r.success) return { ok: false };
  try {
    await apagarSerie(userId, r.data.data, r.data.exercicioId, r.data.numero);
  } catch (err) {
    registrarErro("apagarSerieDoDia", err);
    return { ok: false };
  }
  return { ok: true };
}

export async function concluirTreino(_: EstadoTreino, form: FormData): Promise<EstadoTreino> {
  const { userId } = await exigirUsuario();
  const r = concluirSchema.safeParse(formParaObjeto(form, ["data", "treinoId", "observacao"]));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  try {
    await salvarObservacaoDaSessao(userId, r.data.data, r.data.treinoId, r.data.observacao);
  } catch (e) {
    registrarErro("concluirTreino", e);
    return { erro: FALHA };
  }
  revalidatePath("/treino", "layout");
  redirect("/treino");
}

export async function registrarFaltaDoDia(_: EstadoTreino, form: FormData): Promise<EstadoTreino> {
  const { userId } = await exigirUsuario();
  const r = faltaSchema.safeParse(formParaObjeto(form, ["data", "treinoId", "motivo", "observacao"]));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  try {
    await registrarFalta(userId, r.data.data, r.data.treinoId, r.data.motivo, r.data.observacao);
  } catch (e) {
    registrarErro("registrarFaltaDoDia", e);
    return { erro: FALHA };
  }
  revalidatePath("/treino", "layout");
  redirect("/treino");
}

export async function desfazerRegistroDoDia(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const data = dataQualquer.safeParse(form.get("data"));
  if (!data.success) return;
  try {
    await apagarSessao(userId, data.data);
  } catch (e) {
    registrarErro("desfazerRegistroDoDia", e);
  }
  revalidatePath("/treino", "layout");
}
