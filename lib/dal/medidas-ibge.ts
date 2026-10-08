import "server-only";

import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { escaparLike, normalizarBusca } from "@/lib/busca";
import { alimentoPrincipal, filtrarSugestoes, type CandidatoIbge } from "@/lib/medidas-ibge";
import type { TipoAlimento } from "@/lib/validacao/comida";
import { obterAlimento } from "./alimentos";
import { ehUuid, exigirId } from "./util";

/** Sugestões de medidas do IBGE para um nome de alimento (tabela pública, só leitura). */
export async function sugestoesIbge(nomeAlimento: string): Promise<CandidatoIbge[]> {
  const principal = alimentoPrincipal(nomeAlimento);
  if (!principal) return [];
  const nome = normalizarBusca(nomeAlimento);
  const raiz = principal.replace(/(s|es)$/, "");
  const linhas = await db.execute<{
    id: string;
    ref_alimento: string;
    medida: string;
    gramas: string;
    nome_busca: string;
    semelhanca: number;
  }>(sql`
    select id, ref_alimento, medida, gramas, nome_busca, similarity(nome_busca, ${nome}) as semelhanca
    from medidas_ibge
    where nome_busca like ${`%${escaparLike(raiz)}%`}
    order by semelhanca desc
    limit 80
  `);
  return filtrarSugestoes(
    nomeAlimento,
    linhas.rows.map((l) => ({
      id: l.id,
      refAlimento: l.ref_alimento,
      medida: l.medida,
      gramas: Number(l.gramas),
      nomeBusca: l.nome_busca,
      semelhanca: Number(l.semelhanca),
    })),
  );
}

/**
 * A sugestão do IBGE só vale para o alimento em que foi mostrada: confere que o
 * alimento é visível ao usuário e que a medida está entre as sugestões dele.
 */
export async function sugestaoIbgeDoAlimento(
  userId: string,
  tipo: TipoAlimento,
  alimentoId: string,
  medidaIbgeId: string,
): Promise<CandidatoIbge | null> {
  exigirId(userId);
  if (!ehUuid(medidaIbgeId)) return null;
  const alimento = await obterAlimento(userId, tipo, alimentoId);
  if (!alimento) return null;
  return (await sugestoesIbge(alimento.nome)).find((s) => s.id === medidaIbgeId) ?? null;
}
