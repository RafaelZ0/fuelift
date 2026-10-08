import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { listarSessoes, obterAgenda, obterTrocas, planoAtivo, ultimasSessoes } from "@/lib/dal/treino";
import { hojeSaoPaulo } from "@/lib/datas";
import { calendarioDoMes, diaDaSemana, estatisticasDoMes, sequenciaAtual, treinoDoDia, type StatusDia } from "@/lib/treino";
import { ROTULOS_MOTIVO, type MOTIVOS } from "@/lib/validacao/treino";

export const metadata = { title: "Calendário de treino · FuelLift" };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const CLASSE: Record<StatusDia, string> = {
  feito: "bg-destaque text-fundo font-bold",
  faltou: "bg-erro text-fundo font-bold",
  planejado: "border-2 border-destaque",
  sem_registro: "border-2 border-dashed border-erro",
  livre: "text-suave",
};
const LEGENDA: Array<[StatusDia, string]> = [
  ["feito", "Feito"],
  ["faltou", "Faltou"],
  ["planejado", "Planejado"],
  ["sem_registro", "Sem registro"],
];

function mesAdjacente(ano: number, mes: number, delta: number) {
  const d = new Date(Date.UTC(ano, mes - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function PaginaCalendario(props: PageProps<"/treino/calendario">) {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const pedido = (await props.searchParams).mes;
  const valido = typeof pedido === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(pedido) && pedido >= "2000-01";
  const [ano, mes] = (valido ? (pedido as string) : hoje.slice(0, 7)).split("-").map(Number);
  const primeiro = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const ultimo = `${ano}-${String(mes).padStart(2, "0")}-${String(new Date(Date.UTC(ano, mes, 0)).getUTCDate()).padStart(2, "0")}`;

  const [plano, sessoes, agenda, trocas, recentes] = await Promise.all([
    planoAtivo(userId),
    listarSessoes(userId, primeiro, ultimo),
    obterAgenda(userId),
    obterTrocas(userId, primeiro, ultimo),
    ultimasSessoes(userId),
  ]);
  const resumo = (l: typeof sessoes) => l.map((s) => ({ data: s.data, status: s.status as "feito" | "faltou", motivo: s.motivo }));
  const dias = calendarioDoMes(ano, mes, hoje, resumo(sessoes), (d) => (!plano || d >= plano.inicio) && treinoDoDia(d, agenda, trocas) !== null);
  const est = estatisticasDoMes(resumo(sessoes), ano, mes);
  const seq = sequenciaAtual(resumo(recentes));
  const vazios = diaDaSemana(primeiro);

  return (
    <div className="space-y-8">
      <Link href="/treino" className="inline-flex min-h-11 items-center font-semibold text-suave">
        ‹ Voltar
      </Link>
      <header className="flex items-center justify-between">
        <Link href={`/treino/calendario?mes=${mesAdjacente(ano, mes, -1)}`} aria-label="Mês anterior" className="flex min-h-12 min-w-12 items-center justify-center rounded-full border-2 border-linha text-xl font-bold">
          ‹
        </Link>
        <h1 className="text-2xl font-black capitalize">
          {MESES[mes - 1]} {ano}
        </h1>
        <Link href={`/treino/calendario?mes=${mesAdjacente(ano, mes, 1)}`} aria-label="Próximo mês" className="flex min-h-12 min-w-12 items-center justify-center rounded-full border-2 border-linha text-xl font-bold">
          ›
        </Link>
      </header>

      <div role="grid" aria-label="Dias do mês" className="grid grid-cols-7 gap-1.5 text-center">
        {["D", "S", "T", "Q", "Q", "S", "S"].map((d, i) => (
          <span key={i} className="text-xs font-bold text-suave">
            {d}
          </span>
        ))}
        {Array.from({ length: vazios }, (_, i) => (
          <span key={`v${i}`} />
        ))}
        {dias.map((d) => {
          const numero = Number(d.data.slice(8));
          const celula = `flex aspect-square items-center justify-center rounded-xl text-sm ${CLASSE[d.status]}`;
          return d.data <= hoje ? (
            <Link key={d.data} href={`/treino?data=${d.data}`} className={celula} aria-label={`${numero}: ${d.status.replace("_", " ")}`}>
              {numero}
            </Link>
          ) : (
            <span key={d.data} className={celula}>
              {numero}
            </span>
          );
        })}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-suave">
        {LEGENDA.map(([st, rotulo]) => (
          <li key={st} className="flex items-center gap-1.5">
            <span className={`inline-block h-3 w-3 rounded-sm ${CLASSE[st].split(" ").filter((c) => c.startsWith("bg-") || c.startsWith("border")).join(" ")}`} />
            {rotulo}
          </li>
        ))}
      </ul>

      <section aria-labelledby="estatisticas" className="space-y-3">
        <h2 id="estatisticas" className="text-2xl font-bold">Estatísticas</h2>
        <dl className="grid grid-cols-3 gap-3 text-center">
          <div>
            <dt className="text-xs text-suave">Treinos no mês</dt>
            <dd className="text-2xl font-black">{est.feitos}</dd>
          </div>
          <div>
            <dt className="text-xs text-suave">Faltas</dt>
            <dd className="text-2xl font-black">{est.faltas}</dd>
          </div>
          <div>
            <dt className="text-xs text-suave">Sequência</dt>
            <dd className="text-2xl font-black">{seq}</dd>
          </div>
        </dl>
        {est.motivos.length > 0 ? (
          <div>
            <p className="mb-1 text-sm font-semibold">Motivos mais comuns</p>
            <ul className="text-sm text-suave">
              {est.motivos.map((m) => (
                <li key={m.motivo}>
                  {ROTULOS_MOTIVO[m.motivo as (typeof MOTIVOS)[number]] ?? m.motivo}: {m.n}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <p className="text-xs text-suave">Sequência: treinos feitos seguidos, do mais recente para trás, até a primeira falta.</p>
      </section>
    </div>
  );
}
