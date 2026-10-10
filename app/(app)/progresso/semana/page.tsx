import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { carregarRelatorio } from "@/lib/dal/relatorio";
import { formatarDataBr, hojeSaoPaulo } from "@/lib/datas";
import { verificarAcessoIa } from "@/lib/ia/acesso";
import { resumoFixo, semanaAnterior, semanaSeguinte, semanaValida } from "@/lib/relatorio";
import { BotaoResumo } from "./botao-resumo";

export const metadata = { title: "Resumo da semana · Kalyft" };

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const sinal = (v: number) => (v > 0 ? `+${n(v)}` : n(v));

function Cartao({ titulo, grande, texto }: { titulo: string; grande: string; texto?: string }) {
  return (
    <div className="rounded-2xl border-2 border-linha p-4">
      <p className="text-sm text-suave">{titulo}</p>
      <p className="text-3xl font-black">{grande}</p>
      {texto ? <p className="mt-1 text-sm text-suave">{texto}</p> : null}
    </div>
  );
}

export default async function PaginaSemana(props: PageProps<"/progresso/semana">) {
  const { userId, admin } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const sp = await props.searchParams;
  const inicio = semanaValida(sp.inicio, hoje);
  const [{ relatorio: r, textoIa }, acesso] = await Promise.all([carregarRelatorio(userId, inicio, hoje), verificarAcessoIa(userId, admin !== null)]);
  const ehAtual = semanaSeguinte(inicio) > hoje;

  return (
    <div className="space-y-10">
      <Link href="/progresso" className="inline-flex min-h-11 items-center font-semibold text-suave">‹ Voltar</Link>
      <header className="space-y-4">
        <h1 className="text-3xl font-black">Resumo da semana</h1>
        <nav aria-label="Semana" className="flex items-center justify-between">
          <Link href={`/progresso/semana?inicio=${semanaAnterior(inicio)}`} aria-label="Semana anterior" className="flex min-h-12 min-w-12 items-center justify-center rounded-full border-2 border-borda text-xl font-bold">‹</Link>
          <p className="text-center font-semibold">
            {formatarDataBr(r.inicio)} a {formatarDataBr(r.fim)}
            {r.parcial ? <span className="block text-sm text-suave">em andamento</span> : null}
          </p>
          {!ehAtual ? (
            <Link href={`/progresso/semana?inicio=${semanaSeguinte(inicio)}`} aria-label="Próxima semana" className="flex min-h-12 min-w-12 items-center justify-center rounded-full border-2 border-borda text-xl font-bold">›</Link>
          ) : (
            <span className="min-w-12" />
          )}
        </nav>
      </header>

      {r.avisos.length > 0 ? (
        <ul className="space-y-2" aria-label="Avisos">
          {r.avisos.map((a) => (
            <li key={a} className="rounded-2xl border-2 border-aviso p-3 text-sm font-medium text-aviso"><span aria-hidden="true">! </span>{a}</li>
          ))}
        </ul>
      ) : null}

      <section aria-labelledby="resumo" className="space-y-4">
        <h2 id="resumo" className="text-2xl font-bold">Resumo</h2>
        <div className="space-y-2 rounded-2xl bg-superficie p-4">
          <p className="text-xs font-semibold text-suave">{textoIa ? "Escrito pela IA com os números abaixo" : "Resumo do app (estimativa)"}</p>
          {(textoIa ?? resumoFixo(r)).split("\n").map((linha, i) => (
            <p key={i}>{linha}</p>
          ))}
        </div>
        {acesso.ok || acesso.precisaAceite ? <BotaoResumo inicio={inicio} temTexto={textoIa !== null} /> : null}
      </section>

      <section aria-labelledby="numeros" className="space-y-4">
        <h2 id="numeros" className="text-2xl font-bold">Números da semana</h2>
        <div className="grid grid-cols-2 gap-3">
          <Cartao
            titulo="Calorias por dia"
            grande={r.calorias.media !== null ? `${r.calorias.media.toLocaleString("pt-BR")}` : "—"}
            texto={r.calorias.media !== null ? `${r.calorias.dias} dias com registro${r.calorias.meta !== null ? ` · meta ${r.calorias.meta.toLocaleString("pt-BR")}` : ""}` : "sem registros"}
          />
          <Cartao
            titulo="Proteína por dia"
            grande={r.proteina.media !== null ? `${r.proteina.media} g` : "—"}
            texto={r.proteina.meta !== null ? `meta ${r.proteina.meta} g` : undefined}
          />
          <Cartao titulo="Treinos" grande={`${r.treino.feitos}`} texto={`${r.treino.faltas} ${r.treino.faltas === 1 ? "falta" : "faltas"}${r.treino.planejados !== null ? ` · ${r.treino.planejados} planejados` : ""}`} />
          <Cartao
            titulo="Tendência do peso"
            grande={r.peso.variacaoKg !== null ? `${sinal(r.peso.variacaoKg)} kg` : "—"}
            texto={r.peso.fimKg !== null ? `${n(r.peso.fimKg)} kg no fim · ${r.peso.pesagens} pesagens` : "sem pesagens"}
          />
          <Cartao
            titulo="Gasto estimado"
            grande={r.gasto ? `${r.gasto.valor.toLocaleString("pt-BR")}` : "—"}
            texto={r.gasto ? `entre ${r.gasto.minimo.toLocaleString("pt-BR")} e ${r.gasto.maximo.toLocaleString("pt-BR")} kcal` : "complete o perfil"}
          />
          <Cartao titulo="Passos por dia" grande={r.passos.media !== null ? r.passos.media.toLocaleString("pt-BR") : "—"} texto={r.passos.media !== null ? `${r.passos.dias} dias` : undefined} />
        </div>
        {r.ritmoPrevistoKgSemana !== null || r.ritmoRealKgSemana !== null ? (
          <p className="text-sm text-suave">
            {r.ritmoPrevistoKgSemana !== null ? `Pelo que você comeu, a estimativa era ${r.ritmoPrevistoKgSemana > 0 ? `perder ${n(r.ritmoPrevistoKgSemana)}` : `ganhar ${n(-r.ritmoPrevistoKgSemana)}`} kg na semana. ` : ""}
            {r.ritmoRealKgSemana !== null ? `A tendência do peso indicou ${r.ritmoRealKgSemana > 0 ? `perda de ${n(r.ritmoRealKgSemana)}` : `ganho de ${n(-r.ritmoRealKgSemana)}`} kg por semana.` : ""}
          </p>
        ) : null}
        <p className="text-xs text-suave">Tudo isto é estimativa. O peso oscila por água e sal; olhe a tendência de várias semanas.</p>
      </section>
    </div>
  );
}
