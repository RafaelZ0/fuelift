import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { listarExercicios, listarItensDoTreino, listarTreinos, obterAgenda, planoAtivo } from "@/lib/dal/treino";
import { hojeSaoPaulo } from "@/lib/datas";
import { formatarTempo, NOMES_DIA } from "@/lib/treino";
import {
  adicionarSubstitutoAoItem,
  apagarTreino,
  definirAgendaDoDia,
  removerExercicioDoTreino,
  removerSubstitutoDoItem,
} from "../actions";
import { FormItem, FormPlano, FormTreino } from "./forms";

export const metadata = { title: "Plano de treino · FuelLift" };

export default async function PaginaPlano() {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const [plano, todos] = await Promise.all([planoAtivo(userId), listarExercicios(userId)]);

  if (!plano) {
    return (
      <div className="space-y-6">
        <Link href="/treino" className="inline-flex min-h-11 items-center font-semibold text-suave">
          ‹ Voltar
        </Link>
        <h1 className="text-3xl font-black">Criar plano</h1>
        <FormPlano hoje={hoje} />
      </div>
    );
  }

  const [lista, agenda] = await Promise.all([listarTreinos(userId, plano.id), obterAgenda(userId)]);
  const itensPorTreino = await Promise.all(lista.map((t) => listarItensDoTreino(userId, t.id)));

  return (
    <div className="space-y-12">
      <Link href="/treino" className="inline-flex min-h-11 items-center font-semibold text-suave">
        ‹ Voltar
      </Link>
      <h1 className="text-3xl font-black">Plano de treino</h1>

      <section aria-labelledby="config" className="space-y-4">
        <h2 id="config" className="text-2xl font-bold">Plano</h2>
        <FormPlano
          hoje={hoje}
          valores={{
            id: plano.id,
            nome: plano.nome,
            inicio: plano.inicio,
            seriesInicio: String(plano.seriesInicio),
            seriesDepois: String(plano.seriesDepois),
            semanasInicio: String(plano.semanasInicio),
          }}
        />
      </section>

      <section aria-labelledby="treinos" className="space-y-6">
        <h2 id="treinos" className="text-2xl font-bold">Treinos</h2>
        {lista.map((t, idx) => {
          const itens = itensPorTreino[idx];
          return (
            <article key={t.id} className="space-y-4 rounded-2xl border-2 border-linha p-4">
              <div>
                <h3 className="text-xl font-black">{t.nome}</h3>
                {t.foco ? <p className="text-sm text-suave">{t.foco}</p> : null}
              </div>
              {itens.length === 0 ? <p className="text-sm text-suave">Sem exercícios ainda.</p> : null}
              <ol className="divide-y divide-linha">
                {itens.map((i) => (
                  <li key={i.id} className="space-y-2 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">{i.exercicio.nome}</p>
                        <p className="text-sm text-suave">
                          {i.series ?? "fase"} × {i.repsMin === i.repsMax ? i.repsMin : `${i.repsMin}–${i.repsMax}`} · descanso {formatarTempo(i.descansoS)}
                        </p>
                        {i.observacao ? <p className="text-sm text-suave">{i.observacao}</p> : null}
                      </div>
                      <form action={removerExercicioDoTreino}>
                        <input type="hidden" name="itemId" value={i.id} />
                        <button type="submit" className="min-h-11 px-2 text-sm font-semibold text-suave underline">
                          Remover
                        </button>
                      </form>
                    </div>
                    <details>
                      <summary className="flex min-h-11 cursor-pointer items-center text-sm font-semibold text-suave">
                        Substitutos ({i.substitutos.length})
                      </summary>
                      <ul>
                        {i.substitutos.map((s) => (
                          <li key={s.id} className="flex min-h-11 items-center justify-between text-sm">
                            <span>{s.nome}</span>
                            <form action={removerSubstitutoDoItem}>
                              <input type="hidden" name="itemId" value={i.id} />
                              <input type="hidden" name="exercicioId" value={s.id} />
                              <button type="submit" className="min-h-11 px-2 font-semibold text-suave underline">
                                Tirar
                              </button>
                            </form>
                          </li>
                        ))}
                      </ul>
                      {todos.filter((x) => x.id !== i.exercicio.id && !i.substitutos.some((s) => s.id === x.id)).length > 0 ? (
                        <form action={adicionarSubstitutoAoItem} className="mt-2 flex gap-2">
                          <input type="hidden" name="itemId" value={i.id} />
                          <select name="exercicioId" className="min-h-11 flex-1 rounded-xl border-2 border-linha bg-superficie px-2 [color-scheme:dark]">
                            {todos
                              .filter((x) => x.id !== i.exercicio.id && !i.substitutos.some((s) => s.id === x.id))
                              .map((x) => (
                                <option key={x.id} value={x.id}>
                                  {x.nome}
                                </option>
                              ))}
                          </select>
                          <button type="submit" className="min-h-11 rounded-full border-2 border-linha px-4 font-semibold">
                            Adicionar
                          </button>
                        </form>
                      ) : null}
                    </details>
                  </li>
                ))}
              </ol>
              <details>
                <summary className="flex min-h-12 cursor-pointer items-center font-semibold">+ Adicionar exercício</summary>
                <div className="pt-3">
                  <FormItem treinoId={t.id} exercicios={todos.map((x) => ({ id: x.id, nome: x.nome }))} />
                </div>
              </details>
              <details>
                <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-suave">Editar ou apagar o treino</summary>
                <div className="space-y-4 pt-3">
                  <FormTreino treinoId={t.id} nome={t.nome} foco={t.foco ?? ""} />
                  <form action={apagarTreino}>
                    <input type="hidden" name="treinoId" value={t.id} />
                    <button type="submit" className="min-h-12 w-full rounded-full border-2 border-erro font-semibold text-erro">
                      Apagar treino (o histórico fica)
                    </button>
                  </form>
                </div>
              </details>
            </article>
          );
        })}
        <div className="space-y-3 rounded-2xl border-2 border-dashed border-linha p-4">
          <h3 className="text-lg font-bold">Novo treino</h3>
          <FormTreino />
        </div>
      </section>

      {lista.length > 0 ? (
        <section aria-labelledby="agenda" className="space-y-3">
          <h2 id="agenda" className="text-2xl font-bold">Agenda da semana</h2>
          <ul className="space-y-2">
            {NOMES_DIA.map((nome, dia) => (
              <li key={nome}>
                <form action={definirAgendaDoDia} className="flex items-center gap-2">
                  <input type="hidden" name="diaSemana" value={dia} />
                  <span className="w-20 shrink-0 font-semibold">{nome}</span>
                  <select name="treinoId" defaultValue={agenda.get(dia) ?? ""} className="min-h-12 flex-1 rounded-xl border-2 border-linha bg-superficie px-2 [color-scheme:dark]">
                    <option value="">Descanso</option>
                    {lista.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.nome}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="min-h-12 rounded-full border-2 border-linha px-4 font-semibold">
                    Salvar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
