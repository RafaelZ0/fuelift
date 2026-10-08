// Transforma o rascunho confirmado em linhas prontas para gravar (função pura, sem banco).
// Exercícios que o usuário já tem (mesmo nome, ignorando acentos e maiúsculas) são reaproveitados;
// os demais são criados. A agenda usa o dia sugerido de cada treino (um treino por dia da semana).
import { normalizarBusca } from "@/lib/busca";
import type { Rascunho } from "./rascunho";

export type PlanoParaGravar = {
  plano: { id: string; nome: string; inicio: string };
  exerciciosNovos: Array<{
    id: string;
    nome: string;
    grupo: string | null;
    unilateral: boolean;
    cargaPorHalter: boolean;
    medida: "repeticoes" | "segundos";
    fotoId: string | null;
  }>;
  treinos: Array<{ id: string; ordem: number; nome: string; foco: string | null }>;
  itens: Array<{
    id: string;
    treinoId: string;
    exercicioId: string;
    ordem: number;
    series: number | null;
    repsMin: number;
    repsMax: number;
    descansoS: number;
    observacao: string | null;
  }>;
  agenda: Array<{ diaSemana: number; treinoId: string }>;
};

export function montarPlanoParaGravar(
  rascunho: Rascunho,
  existentes: ReadonlyMap<string, string>,
  fotosValidas: ReadonlySet<string>,
  hoje: string,
  novoId: () => string = () => crypto.randomUUID(),
): PlanoParaGravar {
  const exerciciosNovos: PlanoParaGravar["exerciciosNovos"] = [];
  const porNome = new Map(existentes); // nome normalizado → id
  const treinos: PlanoParaGravar["treinos"] = [];
  const itens: PlanoParaGravar["itens"] = [];
  const agenda: PlanoParaGravar["agenda"] = [];
  const diasUsados = new Set<number>();

  rascunho.treinos.forEach((t, ordem) => {
    const treinoId = novoId();
    treinos.push({ id: treinoId, ordem, nome: t.nome, foco: t.foco });
    if (t.diaSugerido !== null && !diasUsados.has(t.diaSugerido)) {
      diasUsados.add(t.diaSugerido);
      agenda.push({ diaSemana: t.diaSugerido, treinoId });
    }
    const jaNoTreino = new Set<string>();
    for (const e of t.exercicios) {
      const chave = normalizarBusca(e.nomePt);
      let exercicioId = porNome.get(chave);
      if (!exercicioId) {
        exercicioId = novoId();
        porNome.set(chave, exercicioId);
        exerciciosNovos.push({
          id: exercicioId,
          nome: e.nomePt,
          grupo: e.grupo,
          unilateral: e.unilateral,
          cargaPorHalter: e.cargaPorHalter,
          medida: e.medida,
          fotoId: e.fotoId && fotosValidas.has(e.fotoId) ? e.fotoId : null,
        });
      }
      if (jaNoTreino.has(exercicioId)) continue; // o mesmo exercício duas vezes no mesmo treino é ignorado
      jaNoTreino.add(exercicioId);
      itens.push({
        id: novoId(),
        treinoId,
        exercicioId,
        ordem: jaNoTreino.size - 1,
        series: e.series,
        repsMin: e.repsMin,
        repsMax: e.repsMax,
        descansoS: e.descansoS,
        observacao: e.observacao,
      });
    }
  });

  return { plano: { id: novoId(), nome: rascunho.nome, inicio: hoje }, exerciciosNovos, treinos, itens, agenda };
}
