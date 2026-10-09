"use server";

import { exigirUsuario } from "@/lib/auth/sessao";
import { consumirUsoIa, devolverUsoIa, obterAceiteIa } from "@/lib/dal/ia";
import { hojeSaoPaulo } from "@/lib/datas";
import { disponibilidadeIa, LIMITE_DIARIO, LIMITES_ARQUIVO, tipoPeloConteudo } from "@/lib/ia/config";
import { VERSAO_ACEITE_IA } from "@/lib/ia/prompts";
import { ErroIa } from "@/lib/ia/provedor";
import { obterProvedor } from "@/lib/ia/provedor-ativo";
import { ESQUEMA_ROTULO, INSTRUCAO_SISTEMA_ROTULO, sanitizarRotulo, TEXTO_PEDIDO_ROTULO, type RotuloLido } from "@/lib/ia/rotulo";
import { registrarErro } from "@/lib/log";

// Server Action pública: sessão, aceite da IA, limite diário atômico, tipo do arquivo pelos bytes e
// resposta sanitizada. O resultado só preenche o formulário no navegador; nada é salvo aqui.

export type EstadoRotulo = { erro?: string; precisaAceite?: boolean; rotulo?: RotuloLido; descartados?: number };

const MSG = {
  indisponivel: "A leitura por foto não está disponível agora.",
  somenteAdmin: "A IA está liberada só para o administrador por enquanto.",
  semAceite: "Antes de usar a IA, leia e aceite o aviso em Treino → Plano → Criar ou importar com IA.",
  limite: (n: number) => `Você já usou as ${n} leituras de rótulo de hoje. Digite os números ou tente amanhã.`,
  ocupada: "A IA está com muitos pedidos agora. Tente de novo em alguns minutos.",
  falhou: "A IA não respondeu. Tente de novo ou digite os números.",
  ilegivel: "Não consegui ler a tabela nesta foto. Tente de novo com mais luz, de perto e sem reflexo.",
} as const;

export async function lerRotuloComIa(_: EstadoRotulo, form: FormData): Promise<EstadoRotulo> {
  const { userId, admin } = await exigirUsuario();
  const d = disponibilidadeIa(
    { GEMINI_API_KEY: process.env.GEMINI_API_KEY, IA_SOMENTE_ADMIN: process.env.IA_SOMENTE_ADMIN, IA_PLANO: process.env.IA_PLANO },
    admin !== null,
  );
  if (!d.ok) return { erro: d.motivo === "somente_admin" ? MSG.somenteAdmin : MSG.indisponivel };
  const aceite = await obterAceiteIa(userId);
  if (!aceite || aceite.versao < VERSAO_ACEITE_IA) return { erro: MSG.semAceite, precisaAceite: true };

  const arquivo = form.get("foto");
  if (!(arquivo instanceof File) || arquivo.size === 0) return { erro: "Escolha uma foto do rótulo." };
  if (arquivo.size > LIMITES_ARQUIVO.bytesPorArquivo) return { erro: "A foto pode ter no máximo 4 MB." };
  const dados = new Uint8Array(await arquivo.arrayBuffer());
  const tipo = tipoPeloConteudo(dados); // o tipo declarado pelo navegador não é confiável
  if (!tipo || tipo === "application/pdf") return { erro: "Use uma imagem (JPEG, PNG ou WebP)." };

  const dia = hojeSaoPaulo();
  if (!(await consumirUsoIa(userId, dia, "rotulo"))) return { erro: MSG.limite(LIMITE_DIARIO.rotulo) };
  try {
    const bruto = await obterProvedor().gerar({
      sistema: INSTRUCAO_SISTEMA_ROTULO,
      texto: TEXTO_PEDIDO_ROTULO,
      arquivos: [{ mimeType: tipo, dados }],
      esquema: ESQUEMA_ROTULO,
    });
    try {
      const { rotulo, descartados } = sanitizarRotulo(bruto);
      return { rotulo, descartados };
    } catch {
      return { erro: MSG.ilegivel }; // resposta vazia ou inútil: conta como uso
    }
  } catch (e) {
    const motivo = e instanceof ErroIa ? e.motivo : null;
    if (!motivo) registrarErro("lerRotuloComIa", e);
    if (motivo === "bloqueada" || motivo === "formato") return { erro: MSG.ilegivel };
    await devolverUsoIa(userId, dia, "rotulo"); // falha do provedor não gasta o saldo
    return { erro: motivo === "limite_provedor" ? MSG.ocupada : MSG.falhou };
  }
}
