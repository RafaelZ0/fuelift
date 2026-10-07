import "server-only";

import { obterAlimento } from "@/lib/dal/alimentos";
import type { NovoRegistro } from "@/lib/dal/registros";
import { calcularNutrientes } from "@/lib/nutricao";
import type { Refeicao, TipoAlimento } from "@/lib/validacao/comida";

export type ItemParaRegistrar = {
  alimentoBaseId: string | null;
  alimentoUsuarioId: string | null;
  gramas: number;
  medidaTexto: string | null;
};

/**
 * Monta registros novos recalculando os nutrientes com os valores atuais de cada
 * alimento (usado ao copiar refeição e ao usar refeição salva). Alimentos que não
 * existem mais, de outro usuário ou sem calorias conhecidas são pulados.
 */
export async function montarRegistros(
  userId: string,
  data: string,
  refeicao: Refeicao,
  itens: ReadonlyArray<ItemParaRegistrar>,
): Promise<{ registros: NovoRegistro[]; pulados: number }> {
  const registros: NovoRegistro[] = [];
  let pulados = 0;
  for (const it of itens) {
    const tipo: TipoAlimento | null = it.alimentoBaseId ? "base" : it.alimentoUsuarioId ? "usuario" : null;
    const alimentoId = it.alimentoBaseId ?? it.alimentoUsuarioId;
    const alimento = tipo && alimentoId ? await obterAlimento(userId, tipo, alimentoId) : null;
    const nutrientes = alimento ? calcularNutrientes(alimento, it.gramas) : null;
    if (!alimento || !nutrientes || !tipo) {
      pulados++;
      continue;
    }
    registros.push({
      data,
      refeicao,
      tipo,
      alimentoId: alimento.id,
      nome: alimento.marca ? `${alimento.nome} (${alimento.marca})` : alimento.nome,
      gramas: it.gramas,
      medidaTexto: it.medidaTexto,
      nutrientes,
    });
  }
  return { registros, pulados };
}
