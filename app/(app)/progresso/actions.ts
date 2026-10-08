"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth/sessao";
import {
  apagarPesagem as apagarPesagemDal,
  definirDiaAplicacao,
  desfazerAplicacao as desfazerAplicacaoDal,
  registrarAplicacao as registrarAplicacaoDal,
  salvarPesagem as salvarPesagemDal,
} from "@/lib/dal/corpo";
import { registrarErro } from "@/lib/log";
import { errosPorCampo, formParaObjeto, type ErrosCampos } from "@/lib/validacao/comum";
import { aplicacaoSchema, diaAplicacaoSchema, id, pesagemSchema } from "@/lib/validacao/treino";

// Server Actions são endpoints públicos: sessão + Zod + DAL com o user_id da sessão.

export type EstadoCorpo = { ok?: string; erro?: string; erros?: ErrosCampos };
const FALHA = "Não foi possível salvar agora. Tente de novo.";

export async function salvarPesagem(_: EstadoCorpo, form: FormData): Promise<EstadoCorpo> {
  const { userId } = await exigirUsuario();
  const r = pesagemSchema.safeParse(formParaObjeto(form, ["data", "pesoKg", "massaMagraKg", "cinturaCm"]));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  try {
    await salvarPesagemDal(userId, r.data.data, {
      pesoKg: r.data.pesoKg,
      massaMagraKg: r.data.massaMagraKg,
      cinturaCm: r.data.cinturaCm,
    });
  } catch (e) {
    registrarErro("salvarPesagem", e);
    return { erro: FALHA };
  }
  revalidatePath("/progresso");
  return { ok: "Pesagem salva." };
}

export async function apagarPesagem(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const r = id.safeParse(form.get("pesagemId"));
  if (!r.success) return;
  try {
    await apagarPesagemDal(userId, r.data);
  } catch (e) {
    registrarErro("apagarPesagem", e);
  }
  revalidatePath("/progresso");
}

export async function marcarAplicacao(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const r = aplicacaoSchema.safeParse(formParaObjeto(form, ["data"]));
  if (!r.success) return;
  try {
    await registrarAplicacaoDal(userId, r.data.data);
  } catch (e) {
    registrarErro("marcarAplicacao", e);
  }
  revalidatePath("/progresso");
}

export async function desfazerAplicacao(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const r = aplicacaoSchema.safeParse(formParaObjeto(form, ["data"]));
  if (!r.success) return;
  try {
    await desfazerAplicacaoDal(userId, r.data.data);
  } catch (e) {
    registrarErro("desfazerAplicacao", e);
  }
  revalidatePath("/progresso");
}

export async function salvarDiaAplicacao(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const r = diaAplicacaoSchema.safeParse(form.get("dia"));
  if (!r.success) return;
  try {
    await definirDiaAplicacao(userId, r.data);
  } catch (e) {
    registrarErro("salvarDiaAplicacao", e);
  }
  revalidatePath("/progresso");
}
