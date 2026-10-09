import Link from "next/link";
import { Barra } from "@/components/graficos";
import { exigirUsuario } from "@/lib/auth/sessao";
import { totalAguaDoDia } from "@/lib/dal/agua";
import { carregarEnergia } from "@/lib/dal/energia";
import { passosDoPeriodo } from "@/lib/dal/passos";
import { listarDia } from "@/lib/dal/registros";
import { listarTreinos, obterAgenda, obterSessao, obterTrocas, planoAtivo } from "@/lib/dal/treino";
import { formatarDataBr, hojeSaoPaulo } from "@/lib/datas";
import { compararComMeta, formatarGramas, somarDia } from "@/lib/nutricao";
import { treinoDoDia } from "@/lib/treino";

export const metadata = { title: "Hoje · Kalyft" };

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const dec = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

export default async function PaginaHoje() {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();

  const [energia, registros, aguaMl, passos, plano, sessao] = await Promise.all([
    carregarEnergia(userId, hoje, 60),
    listarDia(userId, hoje),
    totalAguaDoDia(userId, hoje),
    passosDoPeriodo(userId, hoje, hoje),
    planoAtivo(userId),
    obterSessao(userId, hoje),
  ]);
  const meta = energia.meta;
  const painel = energia.painel;
  const totais = somarDia(registros);
  const kcal = compararComMeta(totais.kcal, meta?.kcal ?? null);
  const prot = compararComMeta(totais.proteinaG, meta?.proteinaG ?? null);
  const agua = compararComMeta(aguaMl, meta?.aguaMl ?? null);

  let treinoNome: string | null = null;
  if (plano) {
    const [agenda, trocas, treinos] = await Promise.all([obterAgenda(userId), obterTrocas(userId, hoje, hoje), listarTreinos(userId, plano.id)]);
    const id = treinoDoDia(hoje, agenda, trocas);
    treinoNome = id ? (treinos.find((t) => t.id === id)?.nome ?? null) : null;
  }
  const pesoHoje = energia.pesagens.find((p) => p.data === hoje)?.peso ?? null;
  const ultimoPeso = energia.pesagens.at(-1) ?? null;
  const restante = meta?.kcal != null ? meta.kcal - totais.kcal : null;

  return (
    <div className="space-y-10">
      <header>
        <p className="text-sm font-semibold text-suave">{formatarDataBr(hoje)}</p>
        <h1 className="text-4xl font-black tracking-tight">Hoje</h1>
      </header>

      <section aria-labelledby="cal" className="space-y-3">
        <h2 id="cal" className="sr-only">Calorias de hoje</h2>
        <p className="text-5xl font-black">{n(totais.kcal)}<span className="ml-2 text-lg font-bold text-suave">{meta?.kcal != null ? `de ${n(meta.kcal)} kcal` : "kcal"}</span></p>
        {meta?.kcal != null ? (
          <>
            <Barra percentual={kcal.percentual ?? 0} aviso={(kcal.percentual ?? 0) > 110} />
            {restante !== null && restante >= 0 ? (
              <p className="text-lg font-semibold">Ainda dá para comer ≈ {n(restante)} kcal hoje.</p>
            ) : (
              <p className="text-lg font-semibold text-aviso"><span aria-hidden="true">! </span>Acima da meta em ≈ {n(-(restante ?? 0))} kcal. A média da semana é o que conta.</p>
            )}
          </>
        ) : (
          <p className="text-suave">Sem meta de calorias. <Link href="/progresso/meta" className="font-semibold underline">Ver sugestões</Link></p>
        )}
        {painel.previsaoDaMeta ? <p className="rounded-2xl border-2 border-borda p-3 text-sm font-medium">{painel.previsaoDaMeta.texto} <span className="text-suave">(estimativa)</span></p> : null}
        <Link href="/comida" className="flex min-h-12 items-center justify-center rounded-full bg-destaque font-bold text-sobre-destaque">
          Registrar comida
        </Link>
      </section>

      <section aria-labelledby="macros" className="space-y-3">
        <h2 id="macros" className="text-2xl font-bold">Proteína e água</h2>
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-suave">Proteína</span>
            <span className="font-semibold">{formatarGramas(totais.proteinaG)} g{meta?.proteinaG != null ? <span className="text-suave"> / {meta.proteinaG} g</span> : null}</span>
          </div>
          {meta?.proteinaG != null ? <div className="mt-1"><Barra percentual={prot.percentual ?? 0} /></div> : null}
        </div>
        <div>
          <div className="flex items-baseline justify-between">
            <span className="text-suave">Água</span>
            <span className="font-semibold">{dec(aguaMl / 1000)} L{meta?.aguaMl != null ? <span className="text-suave"> / {dec(meta.aguaMl / 1000)} L</span> : null}</span>
          </div>
          {meta?.aguaMl != null ? <div className="mt-1"><Barra percentual={agua.percentual ?? 0} /></div> : null}
        </div>
      </section>

      <section aria-labelledby="treino" className="space-y-3">
        <h2 id="treino" className="text-2xl font-bold">Treino</h2>
        {sessao?.status === "feito" ? (
          <p className="text-lg font-bold text-ok"><span aria-hidden="true">✓ </span>Treino feito hoje.</p>
        ) : sessao?.status === "faltou" ? (
          <p className="text-lg font-bold text-aviso"><span aria-hidden="true">! </span>Falta registrada hoje.</p>
        ) : treinoNome ? (
          <p className="text-lg font-semibold">{treinoNome}</p>
        ) : plano ? (
          <p className="text-suave">Dia de descanso, segundo o seu plano.</p>
        ) : (
          <p className="text-suave">Você ainda não tem um plano de treino.</p>
        )}
        <Link href="/treino" className="flex min-h-12 items-center justify-center rounded-full border-2 border-borda font-semibold">
          {treinoNome && sessao?.status !== "feito" ? "Ir para o treino" : "Abrir treino"}
        </Link>
      </section>

      <section aria-labelledby="corpo" className="space-y-3">
        <h2 id="corpo" className="text-2xl font-bold">Corpo</h2>
        <dl className="grid grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-suave">Peso de hoje</dt>
            <dd className="text-2xl font-black">{pesoHoje !== null ? `${dec(pesoHoje)} kg` : "—"}</dd>
            {pesoHoje === null ? <Link href="/progresso" className="text-sm font-semibold underline">Registrar</Link> : null}
          </div>
          <div>
            <dt className="text-sm text-suave">Tendência</dt>
            <dd className="text-2xl font-black">{painel.tendenciaKg !== null ? `${dec(painel.tendenciaKg)} kg` : "—"}</dd>
            {pesoHoje === null && ultimoPeso ? <p className="text-xs text-suave">última pesagem em {formatarDataBr(ultimoPeso.data)}</p> : null}
          </div>
          <div>
            <dt className="text-sm text-suave">Gasto estimado</dt>
            <dd className="text-2xl font-black">{painel.gasto ? `${n(painel.gasto.valor)} kcal` : "—"}</dd>
            <p className="text-xs text-suave">{painel.gasto ? `entre ${n(painel.gasto.minimo)} e ${n(painel.gasto.maximo)} (estimativa)` : "complete o perfil"}</p>
          </div>
          <div>
            <dt className="text-sm text-suave">Passos</dt>
            <dd className="text-2xl font-black">{passos[0] ? n(passos[0].passos) : "—"}</dd>
            {!passos[0] ? <Link href="/ajustes/passos" className="text-sm font-semibold underline">Configurar</Link> : null}
          </div>
        </dl>
        {painel.faltam.length > 0 ? (
          <p className="rounded-2xl border-2 border-aviso p-3 text-sm font-medium text-aviso">
            <span aria-hidden="true">! </span>Para estimar seu gasto, complete o perfil. <Link href="/progresso/meta" className="underline">Ver o que falta</Link>
          </p>
        ) : null}
        <Link href="/progresso/meta" className="flex min-h-12 items-center justify-center rounded-full border-2 border-borda font-semibold">
          Meta e plano
        </Link>
      </section>
    </div>
  );
}
