import "server-only";

import { cobertura, penalidadeCru, tentativasDeBusca, type ItemInterpretado } from "@/lib/ia/refeicao";
import { buscarAlimentos, type AlimentoResumo } from "./alimentos";
import { exigirId } from "./util";

export type CandidatoAlimento = Pick<AlimentoResumo, "tipo" | "id" | "nome" | "marca" | "kcal"> & {
  /** Fração das palavras que importam do pedido que aparecem no nome (1 = todas). */
  cobertura: number;
};

/** Candidatos mostrados por item (o primeiro vem já escolhido; o usuário pode trocar). */
export const CANDIDATOS_POR_ITEM = 5;

/**
 * Procura cada item no banco (TACO e alimentos do próprio usuário), com todas as palavras que importam e,
 * se não achar, tirando uma por vez sem nunca perder a primeira (ver tentativasDeBusca). A IA só dá o nome; a identificação
 * do alimento é sempre por id do banco, e o dono vem do `userId` da sessão.
 */
export async function casarItens(userId: string, itens: ReadonlyArray<Pick<ItemInterpretado, "nome">>): Promise<CandidatoAlimento[][]> {
  exigirId(userId);
  return Promise.all(
    itens.map(async ({ nome }) => {
      for (const termo of tentativasDeBusca(nome)) {
        const r = await buscarAlimentos(userId, termo);
        // Candidatos sem nenhuma palavra em comum (parecidos só pelas letras) seriam só ruído.
        const uteis = r.map((a, ordem) => ({ a, ordem, cob: cobertura(nome, a.nome), cru: penalidadeCru(nome, a.nome) })).filter((x) => x.cob > 0);
        if (uteis.length > 0) {
          return uteis
            .sort((x, y) => y.cob - x.cob || x.cru - y.cru || x.ordem - y.ordem) // mais palavras em comum; depois não cru; depois a ordem da busca
            .slice(0, CANDIDATOS_POR_ITEM)
            .map(({ a, cob }) => ({ tipo: a.tipo, id: a.id, nome: a.nome, marca: a.marca, kcal: a.kcal, cobertura: cob }));
        }
      }
      return [];
    }),
  );
}
