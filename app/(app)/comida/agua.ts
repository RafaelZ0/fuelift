"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/sessao";
import { desfazerUltimaAgua, registrarAgua } from "@/lib/dal/agua";
import { registrarErro } from "@/lib/log";
import { formParaObjeto, errosPorCampo, type ErrosCampos } from "@/lib/validacao/comum";
import { aguaSchema, dataAteHoje } from "@/lib/validacao/treino";

export type EstadoAgua = { erro?: string; erros?: ErrosCampos };

/** Botões rápidos (+200, +300, +500 ml). */
export async function adicionarAgua(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const r = aguaSchema.safeParse(formParaObjeto(form, ["data", "ml"]));
  if (!r.success) return;
  try {
    await registrarAgua(userId, r.data.data, r.data.ml);
  } catch (e) {
    registrarErro("adicionarAgua", e);
  }
  revalidatePath("/comida");
}

/** Valor livre, com mensagem de erro no campo. */
export async function adicionarAguaLivre(_: EstadoAgua, form: FormData): Promise<EstadoAgua> {
  const { userId } = await exigirUsuario();
  const r = aguaSchema.safeParse(formParaObjeto(form, ["data", "ml"]));
  if (!r.success) return { erros: errosPorCampo(r.error) };
  try {
    await registrarAgua(userId, r.data.data, r.data.ml);
  } catch (e) {
    registrarErro("adicionarAguaLivre", e);
    return { erro: "Não foi possível salvar agora. Tente de novo." };
  }
  revalidatePath("/comida");
  return {};
}

export async function desfazerAgua(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const data = z.object({ data: dataAteHoje }).safeParse(formParaObjeto(form, ["data"]));
  if (!data.success) return;
  try {
    await desfazerUltimaAgua(userId, data.data.data);
  } catch (e) {
    registrarErro("desfazerAgua", e);
  }
  revalidatePath("/comida");
}
