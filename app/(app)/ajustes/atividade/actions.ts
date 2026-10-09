"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { exigirUsuario } from "@/lib/auth/sessao";
import { definirNivelAtividade } from "@/lib/dal/energia";
import { consumirUsoIa, devolverUsoIa } from "@/lib/dal/ia";
import { obterAgenda } from "@/lib/dal/treino";
import { hojeSaoPaulo } from "@/lib/datas";
import { FATORES_ATIVIDADE, NIVEIS_ATIVIDADE, type NivelAtividade } from "@/lib/energia";
import { verificarAcessoIa } from "@/lib/ia/acesso";
import { ESQUEMA_ATIVIDADE, INSTRUCAO_SISTEMA_ATIVIDADE, montarEntradaAtividade, sanitizarAtividade } from "@/lib/ia/atividade";
import { LIMITE_DIARIO } from "@/lib/ia/config";
import { ErroIa } from "@/lib/ia/provedor";
import { obterProvedor } from "@/lib/ia/provedor-ativo";
import { registrarErro } from "@/lib/log";

// Server Actions são endpoints públicos: sessão, aceite da IA, Zod e user_id da sessão. A IA só ESCOLHE um
// dos cinco níveis; o fator numérico é da tabela do app e nada é salvo sem o usuário confirmar.

export type EstadoAtividade = {
  erro?: string;
  precisaAceite?: boolean;
  resultado?: { nivel: NivelAtividade; justificativa: string; fator: number };
};

const MSG = {
  ocupada: "A IA está com muitos pedidos agora. Tente de novo em alguns minutos.",
  falhou: "A IA não respondeu. Tente de novo ou escolha o nível na lista.",
  ilegivel: "A IA não conseguiu entender. Descreva com mais detalhes ou escolha o nível na lista.",
} as const;

export async function diagnosticarAtividade(_: EstadoAtividade, form: FormData): Promise<EstadoAtividade> {
  const { userId, admin } = await exigirUsuario();
  const acesso = await verificarAcessoIa(userId, admin !== null);
  if (!acesso.ok) return { erro: acesso.erro, precisaAceite: acesso.precisaAceite };

  let treinos: number | null = null;
  try {
    const agenda = await obterAgenda(userId);
    treinos = agenda.size > 0 ? agenda.size : null;
  } catch {
    treinos = null; // sem agenda: só o texto vai
  }
  const entrada = montarEntradaAtividade(form.get("texto"), treinos);
  if (!entrada) return { erro: "Descreva um pouco mais (pelo menos uma frase) o seu dia a dia e os seus exercícios." };

  const dia = hojeSaoPaulo();
  if (!(await consumirUsoIa(userId, dia, "atividade"))) {
    return { erro: `Você já usou os ${LIMITE_DIARIO.atividade} diagnósticos de hoje. Escolha o nível na lista.` };
  }
  try {
    const bruto = await obterProvedor().gerar({ sistema: INSTRUCAO_SISTEMA_ATIVIDADE, texto: entrada.texto, arquivos: [], esquema: ESQUEMA_ATIVIDADE });
    const r = sanitizarAtividade(bruto);
    return { resultado: { nivel: r.nivel, justificativa: r.justificativa, fator: FATORES_ATIVIDADE[r.nivel] } };
  } catch (e) {
    const motivo = e instanceof ErroIa ? e.motivo : null;
    if (!motivo && !(e instanceof Error && e.message.startsWith("nível"))) registrarErro("diagnosticarAtividade", e);
    if (motivo === "bloqueada" || motivo === "formato" || (e instanceof Error && !motivo)) return { erro: MSG.ilegivel };
    await devolverUsoIa(userId, dia, "atividade");
    return { erro: motivo === "limite_provedor" ? MSG.ocupada : MSG.falhou };
  }
}

const nivelSchema = z.enum(NIVEIS_ATIVIDADE);

/** Salva o nível (vindo da IA ou escolhido na lista). O fator é sempre o da tabela do app. */
export async function confirmarAtividade(form: FormData): Promise<void> {
  const { userId } = await exigirUsuario();
  const r = nivelSchema.safeParse(form.get("nivel"));
  if (!r.success) return;
  try {
    await definirNivelAtividade(userId, r.data);
  } catch (e) {
    registrarErro("confirmarAtividade", e);
    return;
  }
  revalidatePath("/ajustes");
  revalidatePath("/ajustes/atividade");
  revalidatePath("/progresso/meta");
  revalidatePath("/hoje");
  redirect("/ajustes/atividade?salvo=1");
}
