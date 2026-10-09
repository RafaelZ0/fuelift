import Link from "next/link";
import { EmBreve } from "@/components/em-breve";
import { GraficoLinhas } from "@/components/graficos";
import { exigirUsuario } from "@/lib/auth/sessao";
import { datasDeAplicacao, listarPesagens, obterDiaAplicacao } from "@/lib/dal/corpo";
import { metaVigente } from "@/lib/dal/metas";
import { formatarDataBr, hojeSaoPaulo, somarDias } from "@/lib/datas";
import { formatarGramas } from "@/lib/nutricao";
import { aplicacaoPendente, diasEntre, massaGorda, NOMES_DIA, tendenciaDoPeso } from "@/lib/treino";
import { apagarPesagem, desfazerAplicacao, marcarAplicacao, salvarDiaAplicacao } from "./actions";
import { periodoValido } from "@/lib/painel-energia";
import { FormPesagem } from "./form-pesagem";
import { GraficosProgresso } from "./graficos-progresso";

export const metadata = { title: "Progresso · Kalyft" };

const txt = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

export default async function PaginaProgresso(props: PageProps<"/progresso">) {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const periodo = periodoValido((await props.searchParams).periodo);
  const [lista, meta, diaAplic, aplicacoes] = await Promise.all([
    listarPesagens(userId, somarDias(hoje, -120), 400),
    metaVigente(userId, hoje),
    obterDiaAplicacao(userId),
    datasDeAplicacao(userId, somarDias(hoje, -30)),
  ]);

  const crescente = [...lista].reverse();
  const tendencia = tendenciaDoPeso(crescente.map((p) => ({ data: p.data, peso: p.pesoKg })));
  const primeira = tendencia[0]?.data;
  const x = (data: string) => diasEntre(primeira!, data);
  const ultima = lista[0];
  const hojeJa = lista.find((p) => p.data === hoje) ?? null;
  const tendenciaAtual = tendencia.at(-1)?.tendencia ?? null;
  const gorda = ultima ? massaGorda(ultima.pesoKg, ultima.massaMagraKg) : null;
  const pendente = aplicacaoPendente(hoje, diaAplic, aplicacoes);

  return (
    <div className="space-y-14">
      <EmBreve titulo="Progresso" texto="Seu corpo ao longo do tempo." />

      <Link href="/progresso/meta" className="block rounded-2xl border-2 border-marca p-4 active:bg-superficie">
        <span className="block text-lg font-bold">Meta e plano</span>
        <span className="block text-sm text-suave">Seu gasto estimado, quanto comer por dia e a projeção do peso</span>
      </Link>

      <section aria-labelledby="peso" className="space-y-5">
        <h2 id="peso" className="text-2xl font-bold">Peso</h2>
        {ultima ? (
          <dl className="grid grid-cols-3 gap-3 text-center">
            <div>
              <dt className="text-xs text-suave">Último</dt>
              <dd className="text-xl font-bold">{formatarGramas(ultima.pesoKg)} kg</dd>
            </div>
            <div>
              <dt className="text-xs text-suave">Tendência</dt>
              <dd className="text-xl font-bold">{tendenciaAtual === null ? "—" : `${formatarGramas(tendenciaAtual)} kg`}</dd>
            </div>
            <div>
              <dt className="text-xs text-suave">Massa gorda</dt>
              <dd className="text-xl font-bold">{gorda === null ? "—" : `${formatarGramas(gorda)} kg`}</dd>
            </div>
          </dl>
        ) : null}
        {tendencia.length >= 2 ? (
          <>
            <GraficoLinhas
              titulo="Peso e tendência nos últimos 120 dias"
              unidade="kg"
              linhaMeta={meta?.pesoMetaKg ?? null}
              rotulosX={[formatarDataBr(tendencia[0].data), formatarDataBr(tendencia.at(-1)!.data)]}
              series={[
                { nome: "Peso", tipo: "pontos", pontos: tendencia.map((p) => ({ x: x(p.data), y: p.peso })) },
                { nome: "Tendência", tipo: "linha", pontos: tendencia.map((p) => ({ x: x(p.data), y: p.tendencia })) },
              ]}
            />
            <p className="text-xs text-suave">
              Pontos: pesagens do dia. Linha: tendência (média que suaviza água e sal). A tendência é uma estimativa.
            </p>
          </>
        ) : (
          <p className="text-suave">O gráfico aparece a partir da segunda pesagem.</p>
        )}
        <FormPesagem
          hoje={hoje}
          atual={hojeJa ? { peso: txt(hojeJa.pesoKg), massaMagra: txt(hojeJa.massaMagraKg), cintura: txt(hojeJa.cinturaCm) } : null}
        />
        {lista.length > 0 ? (
          <details>
            <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-suave">Pesagens recentes</summary>
            <ul>
              {lista.slice(0, 15).map((p) => (
                <li key={p.id} className="flex min-h-12 items-center justify-between border-b border-linha text-sm">
                  <span>
                    {formatarDataBr(p.data)} · <span className="font-semibold">{formatarGramas(p.pesoKg)} kg</span>
                    {p.cinturaCm ? <span className="text-suave"> · cintura {formatarGramas(p.cinturaCm)} cm</span> : null}
                  </span>
                  <form action={apagarPesagem}>
                    <input type="hidden" name="pesagemId" value={p.id} />
                    <button type="submit" className="min-h-11 px-3 font-semibold text-suave underline">
                      Apagar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <GraficosProgresso userId={userId} hoje={hoje} periodo={periodo} />

      <section aria-labelledby="aplicacao" className="space-y-4">
        <h2 id="aplicacao" className="text-2xl font-bold">Aplicação semanal</h2>
        <p className="text-sm text-suave">Só um registro de &quot;feito&quot; no dia que você escolher. O app não dá orientação sobre medicação.</p>
        <form action={salvarDiaAplicacao} className="flex items-end gap-3">
          <label className="flex-1">
            <span className="mb-2 block text-sm font-medium text-suave">Lembrete aos</span>
            <select
              name="dia"
              defaultValue={diaAplic === null ? "" : String(diaAplic)}
              className="min-h-12 w-full rounded-xl border-2 border-borda bg-superficie px-3 text-lg font-semibold"
            >
              <option value="">Sem lembrete</option>
              {NOMES_DIA.map((n, i) => (
                <option key={n} value={i}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="min-h-12 rounded-full border-2 border-borda px-5 font-semibold">
            Salvar
          </button>
        </form>
        {pendente ? (
          <form action={marcarAplicacao} className="space-y-2 rounded-2xl border-2 border-marca p-4">
            <p className="font-semibold">Hoje é o dia da aplicação.</p>
            <input type="hidden" name="data" value={hoje} />
            <button type="submit" className="min-h-12 w-full rounded-full bg-destaque font-bold text-sobre-destaque">
              Marcar como feita
            </button>
          </form>
        ) : null}
        {aplicacoes.length > 0 ? (
          <div className="text-sm text-suave">
            Última: {formatarDataBr(aplicacoes[0])}
            {aplicacoes[0] === hoje ? (
              <form action={desfazerAplicacao} className="inline">
                <input type="hidden" name="data" value={hoje} />
                <button type="submit" className="ml-2 min-h-11 font-semibold underline">
                  Desfazer
                </button>
              </form>
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
