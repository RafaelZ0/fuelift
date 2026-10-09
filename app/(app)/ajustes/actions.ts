"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigirAdmin, exigirUsuario } from "@/lib/auth/sessao";
import { decidirAcesso } from "@/lib/dal/acessos";
import { carregarEnergia } from "@/lib/dal/energia";
import { salvarMeta } from "@/lib/dal/metas";
import { avisoDeMetaDigitada } from "@/lib/projecao";
import { atualizarPerfil } from "@/lib/dal/perfil";
import { hojeSaoPaulo } from "@/lib/datas";
import { registrarErro } from "@/lib/log";
import { errosPorCampo, formParaObjeto, type ErrosCampos } from "@/lib/validacao/comum";
import { CAMPOS_META, metaSchema } from "@/lib/validacao/metas";
import { CAMPOS_PERFIL, perfilSchema } from "@/lib/validacao/perfil";

// Server Actions são endpoints públicos: cada uma verifica a sessão, valida
// a entrada com Zod e usa o user_id da sessão (nunca do formulário).

export type EstadoForm = { ok?: boolean; erro?: string; erros?: ErrosCampos; aviso?: string };

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

  let aviso: string | undefined;
  try {
    await salvarMeta(userId, r.data, hojeSaoPaulo());
    // A meta digitada (por exemplo, combinada com o nutricionista) é salva do jeito que foi digitada;
    // se passar das travas de segurança, o app só avisa.
    if (r.data.kcal !== null) {
      const { painel, perfil } = await carregarEnergia(userId, hojeSaoPaulo(), 60);
      aviso = avisoDeMetaDigitada({ kcal: r.data.kcal, tmb: painel.tmb, gasto: painel.gasto?.valor ?? null, pesoAtual: painel.pesoAtualKg, ritmoMaxPct: perfil.ritmoMaxPct }) ?? undefined;
    }
  } catch (e) {
    registrarErro("salvarMetas", e);
    return { erro: FALHA };
  }
  revalidatePath("/ajustes");
  return { ok: true, aviso };
}

const decisaoSchema = z.object({
  alvo: z.uuid(),
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
