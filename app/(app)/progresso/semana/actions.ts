"use server";

import { revalidatePath } from "next/cache";
import { exigirUsuario } from "@/lib/auth/sessao";
import { consumirUsoIa, devolverUsoIa } from "@/lib/dal/ia";
import { carregarRelatorio, guardarTextoIa } from "@/lib/dal/relatorio";
import { hojeSaoPaulo } from "@/lib/datas";
import { verificarAcessoIa } from "@/lib/ia/acesso";
import { LIMITE_DIARIO } from "@/lib/ia/config";
import { ErroIa } from "@/lib/ia/provedor";
import { obterProvedor } from "@/lib/ia/provedor-ativo";
import { ESQUEMA_RELATORIO, INSTRUCAO_SISTEMA_RELATORIO, montarEntradaRelatorio, sanitizarResumo } from "@/lib/ia/relatorio";
import { registrarErro } from "@/lib/log";
import { semanaValida } from "@/lib/relatorio";

// Server Action pública: sessão, aceite da IA, semana validada (segunda-feira, não futura), limite diário
// atômico. Os números são recalculados aqui, do banco; a IA só escreve o texto e nada que ela cite fora
// dos números do app é aceito.

export type EstadoResumo = { erro?: string; precisaAceite?: boolean; ok?: boolean };

const MSG = {
  semDados: "Ainda não há dados suficientes nesta semana para um resumo.",
  ocupada: "A IA está com muitos pedidos agora. Tente de novo em alguns minutos.",
  falhou: "A IA não respondeu. Tente de novo; enquanto isso vale o resumo do app.",
  numero: "A IA citou um número que não é do seu relatório, então descartei o texto. Vale o resumo do app.",
} as const;

export async function gerarResumoSemana(_: EstadoResumo, form: FormData): Promise<EstadoResumo> {
  const { userId, admin } = await exigirUsuario();
  const acesso = await verificarAcessoIa(userId, admin !== null);
  if (!acesso.ok) return { erro: acesso.erro, precisaAceite: acesso.precisaAceite };

  const hoje = hojeSaoPaulo();
  const inicio = semanaValida(form.get("inicio"), hoje);
  const { relatorio } = await carregarRelatorio(userId, inicio, hoje);
  if (relatorio.calorias.media === null && relatorio.peso.variacaoKg === null && relatorio.treino.feitos === 0) return { erro: MSG.semDados };

  if (!(await consumirUsoIa(userId, hoje, "relatorio"))) {
    return { erro: `Você já usou os ${LIMITE_DIARIO.relatorio} resumos de hoje. Vale o resumo do app.` };
  }
  try {
    const bruto = await obterProvedor().gerar({
      sistema: INSTRUCAO_SISTEMA_RELATORIO,
      texto: montarEntradaRelatorio(relatorio),
      arquivos: [],
      esquema: ESQUEMA_RELATORIO,
    });
    const r = sanitizarResumo(bruto, relatorio);
    if (!r) return { erro: MSG.numero }; // resposta inútil ou com número inventado: conta como uso
    await guardarTextoIa(userId, inicio, [r.explicacao, ...r.dicas.map((d) => `• ${d}`)].join("\n"), relatorio);
  } catch (e) {
    const motivo = e instanceof ErroIa ? e.motivo : null;
    if (!motivo) registrarErro("gerarResumoSemana", e);
    if (motivo !== "bloqueada" && motivo !== "formato") await devolverUsoIa(userId, hoje, "relatorio");
    return { erro: motivo === "limite_provedor" ? MSG.ocupada : MSG.falhou };
  }
  revalidatePath("/progresso/semana");
  return { ok: true };
}
