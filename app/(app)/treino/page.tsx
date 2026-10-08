import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { listarItensDoTreino, listarTreinos, obterAgenda, obterSessao, obterTrocas, planoAtivo } from "@/lib/dal/treino";
import { hojeSaoPaulo, rotuloDia, somarDias } from "@/lib/datas";
import { formatarTempo, seriesDoExercicio, treinoDoDia } from "@/lib/treino";
import { ROTULOS_MOTIVO, dataAteHoje, MOTIVOS } from "@/lib/validacao/treino";
import { desfazerRegistroDoDia, trocarTreinoDoDia } from "./actions";

export const metadata = { title: "Treino · FuelLift" };

export default async function PaginaTreino(props: PageProps<"/treino">) {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const pedido = (await props.searchParams).data;
  const data = dataAteHoje.safeParse(typeof pedido === "string" ? pedido : hoje).data ?? hoje;

  const plano = await planoAtivo(userId);
  const links = (
    <nav aria-label="Treino" className="flex flex-wrap gap-2 text-sm font-semibold">
      {[
        ["/treino/calendario", "Calendário"],
        ["/treino/plano", "Plano"],
        ["/treino/exercicios", "Exercícios"],
      ].map(([href, rotulo]) => (
        <Link key={href} href={href} className="flex min-h-11 items-center whitespace-nowrap rounded-full border-2 border-linha px-4 text-suave">
          {rotulo}
        </Link>
      ))}
    </nav>
  );

  if (!plano) {
    return (
      <div className="space-y-8">
        <h1 className="text-4xl font-black tracking-tight">Treino</h1>
        <p className="max-w-sm text-lg text-suave">Você ainda não tem um plano de treino. Monte o seu: cadastre os exercícios e organize os treinos da semana.</p>
        <Link href="/treino/plano" className="flex min-h-14 items-center justify-center rounded-full bg-destaque text-lg font-bold text-fundo">
          Criar meu plano
        </Link>
        {links}
      </div>
    );
  }

  const [agenda, trocas, treinos, sessao] = await Promise.all([
    obterAgenda(userId),
    obterTrocas(userId, data, data),
    listarTreinos(userId, plano.id),
    obterSessao(userId, data),
  ]);
  const treinoId = treinoDoDia(data, agenda, trocas);
  const treino = treinoId ? (treinos.find((t) => t.id === treinoId) ?? null) : null;
  const itens = treino ? await listarItensDoTreino(userId, treino.id) : [];

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <h1 className="text-4xl font-black tracking-tight">Treino</h1>
        <nav aria-label="Dia" className="flex items-center justify-between">
          <Link href={`/treino?data=${somarDias(data, -1)}`} aria-label="Dia anterior" className="flex min-h-12 min-w-12 items-center justify-center rounded-full border-2 border-linha text-xl font-bold">
            ‹
          </Link>
          <div className="text-center">
            <p className="text-xl font-bold">{rotuloDia(data, hoje)}</p>
            {data !== hoje ? (
              <Link href="/treino" className="text-sm font-semibold text-destaque underline">
                Voltar para hoje
              </Link>
            ) : null}
          </div>
          {data < hoje ? (
            <Link href={`/treino?data=${somarDias(data, 1)}`} aria-label="Próximo dia" className="flex min-h-12 min-w-12 items-center justify-center rounded-full border-2 border-linha text-xl font-bold">
              ›
            </Link>
          ) : (
            <span className="min-h-12 min-w-12" aria-hidden="true" />
          )}
        </nav>
        {links}
      </header>

      {sessao ? (
        <section className="space-y-3 rounded-2xl border-2 border-linha p-4" aria-live="polite">
          {sessao.status === "feito" ? (
            <p className="text-lg font-bold text-destaque">Treino feito</p>
          ) : (
            <p className="text-lg font-bold text-erro">
              Faltou{sessao.motivo ? `: ${ROTULOS_MOTIVO[sessao.motivo as (typeof MOTIVOS)[number]] ?? sessao.motivo}` : ""}
            </p>
          )}
          {sessao.observacao ? <p className="text-suave">{sessao.observacao}</p> : null}
          <form action={desfazerRegistroDoDia}>
            <input type="hidden" name="data" value={data} />
            <button type="submit" className="min-h-11 text-sm font-semibold text-suave underline">
              Desfazer o registro deste dia
            </button>
          </form>
        </section>
      ) : null}

      {treino ? (
        <section aria-labelledby="treino-dia" className="space-y-4">
          <div>
            <h2 id="treino-dia" className="text-3xl font-black">{treino.nome}</h2>
            {treino.foco ? <p className="text-suave">{treino.foco}</p> : null}
          </div>
          {itens.length === 0 ? (
            <p className="text-suave">
              Este treino ainda não tem exercícios. <Link href="/treino/plano" className="underline">Adicionar no plano</Link>
            </p>
          ) : (
            <ol className="divide-y divide-linha">
              {itens.map((i) => (
                <li key={i.id} className="py-3">
                  <p className="font-semibold">{i.exercicio.nome}</p>
                  <p className="text-sm text-suave">
                    {seriesDoExercicio(i.series, plano, data)} × {i.repsMin === i.repsMax ? i.repsMin : `${i.repsMin}–${i.repsMax}`}
                    {i.exercicio.medida === "segundos" ? " s" : ""} · descanso {formatarTempo(i.descansoS)}
                    {i.exercicio.unilateral ? " · cada lado" : ""}
                  </p>
                  {i.observacao ? <p className="text-sm text-suave">{i.observacao}</p> : null}
                </li>
              ))}
            </ol>
          )}
          <div className="grid gap-3">
            <Link
              href={`/treino/sessao?data=${data}`}
              className="flex min-h-14 items-center justify-center rounded-full bg-destaque text-lg font-bold text-fundo"
            >
              {sessao?.status === "feito" ? "Continuar treino" : "Começar treino"}
            </Link>
            {!sessao ? (
              <Link href={`/treino/falta?data=${data}`} className="flex min-h-12 items-center justify-center rounded-full border-2 border-linha font-semibold">
                Não vou treinar
              </Link>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="space-y-2">
          <h2 className="text-3xl font-black">Descanso</h2>
          <p className="text-suave">Sem treino neste dia. Você pode trocar abaixo.</p>
        </section>
      )}

      <form action={trocarTreinoDoDia} className="space-y-3 border-t border-linha pt-6">
        <input type="hidden" name="data" value={data} />
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-suave">Trocar o treino deste dia</span>
          <select
            name="treinoId"
            defaultValue={treinoId ?? "descanso"}
            className="min-h-12 w-full rounded-xl border-2 border-linha bg-superficie px-3 text-lg font-semibold [color-scheme:dark]"
          >
            {treinos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
            <option value="descanso">Descanso</option>
            <option value="agenda">Voltar ao da agenda</option>
          </select>
        </label>
        <button type="submit" className="min-h-12 w-full rounded-full border-2 border-linha font-semibold">
          Trocar
        </button>
      </form>
    </div>
  );
}
