"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin, exigirUsuario } from "@/lib/auth/sessao";
import { decidirAcesso } from "@/lib/dal/acessos";
import { salvarMeta } from "@/lib/dal/metas";
import { atualizarPerfil } from "@/lib/dal/perfil";
import { hojeSaoPaulo } from "@/lib/datas";
import { registrarErro } from "@/lib/log";
import { errosPorCampo, formParaObjeto, type ErrosCampos } from "@/lib/validacao/comum";
import { CAMPOS_META, metaSchema } from "@/lib/validacao/metas";
import { CAMPOS_PERFIL, perfilSchema } from "@/lib/validacao/perfil";

// Server Actions são endpoints públicos: cada uma verifica a sessão, valida
// a entrada com Zod e usa o user_id da sessão (nunca do formulário).

export type EstadoForm = { ok?: boolean; erro?: string; erros?: ErrosCampos };

const FALHA = "Não foi possível salvar agora. Tente de novo.";

export async function salvarPerfil(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { userId } = await exigirUsuario();
  const r = perfilSchema.safeParse(formParaObjeto(form, CAMPOS_PERFIL));
  if (!r.success) return { erros: errosPorCampo(r.error) };

  try {
    if (!(await atualizarPerfil(userId, r.data))) return { erro: FALHA };
  } catch (e) {
    registrarErro("salvarPerfil", e);
    return { erro: FALHA };
  }
  revalidatePath("/ajustes");
  return { ok: true };
}

export async function salvarMetas(_: EstadoForm, form: FormData): Promise<EstadoForm> {
  const { userId } = await exigirUsuario();
  const r = metaSchema.safeParse(formParaObjeto(form, CAMPOS_META));
  if (!r.success) return { erros: errosPorCampo(r.error) };

  try {
    await salvarMeta(userId, r.data, hojeSaoPaulo());
  } catch (e) {
    registrarErro("salvarMetas", e);
    return { erro: FALHA };
  }
  revalidatePath("/ajustes");
  return { ok: true };
}

const decisaoSchema = z.object({
  alvo: z.string().min(1).max(200),
  decisao: z.enum(["aprovar", "recusar"]),
});

export async function decidirCadastro(form: FormData): Promise<void> {
  const admin = await exigirAdmin();
  const r = decisaoSchema.safeParse(formParaObjeto(form, ["alvo", "decisao"]));
  if (!r.success) return;

  try {
    await decidirAcesso(admin, r.data.alvo, r.data.decisao === "aprovar" ? "aprovado" : "recusado");
  } catch (e) {
    registrarErro("decidirCadastro", e);
  }
  revalidatePath("/ajustes");
}
