import Link from "next/link";
import { GraficoBarras, GraficoLinhas } from "@/components/graficos";
import { carregarEnergia } from "@/lib/dal/energia";
import { listarSessoes } from "@/lib/dal/treino";
import { formatarDataBr, somarDias } from "@/lib/datas";
import { deficitAcumulado, PERIODOS, ROTULOS_PERIODO, type Periodo } from "@/lib/painel-energia";
import { mediaPorSemana, perdaRealPelaTendencia, treinosPorSemana } from "@/lib/progresso-graficos";
import { diasEntre, tendenciaDoPeso } from "@/lib/treino";

const n = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const dec = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function Secao({ id, titulo, children, nota }: { id: string; titulo: string; children: React.ReactNode; nota?: string }) {
  return (
    <section aria-labelledby={id} className="space-y-3">
      <h3 id={id} className="text-2xl font-bold">{titulo}</h3>
      {children}
      {nota ? <p className="text-xs text-suave">{nota}</p> : null}
    </section>
  );
}

/** Gráficos de progresso com seletor de período. Todos os dados são do próprio usuário (DAL com user_id). */
export async function GraficosProgresso({ userId, hoje, periodo }: { userId: string; hoje: string; periodo: Periodo }) {
  const dias = PERIODOS[periodo];
  const desde = somarDias(hoje, -dias);
  const dados = await carregarEnergia(userId, hoje, Math.max(dias, 60));
  const sessoes = await listarSessoes(userId, desde, hoje);

  const consumo = dados.consumo.filter((d) => d.data >= desde);
  const gasto = dados.painel.gasto?.valor ?? null;
  const metaProt = dados.meta?.proteinaG ?? null;
  const semanal = periodo !== "4s";

  const seletor = (
    <nav aria-label="Período dos gráficos" className="flex gap-2">
      {(Object.keys(PERIODOS) as Periodo[]).map((p) => (
        <Link
          key={p}
          href={`/progresso?periodo=${p}`}
          aria-current={p === periodo ? "true" : undefined}
          className={`flex min-h-12 flex-1 items-center justify-center rounded-full border-2 text-sm font-semibold ${p === periodo ? "border-marca text-texto" : "border-borda text-suave"}`}
        >
          {ROTULOS_PERIODO[p]}
        </Link>
      ))}
    </nav>
  );

  // 1) Consumo × gasto (barras por dia, ou média por semana nos períodos longos).
  const kcalDias = consumo.filter((d) => d.kcal !== null && d.kcal >= 800);
  const barrasKcal = semanal
    ? mediaPorSemana(consumo.map((d) => ({ data: d.data, valor: d.kcal !== null && d.kcal >= 800 ? d.kcal : null }))).map((s, i) => ({ x: i, y: s.media }))
    : kcalDias.map((d, i) => ({ x: i, y: Math.round(d.kcal as number) }));
  const mediaKcal = kcalDias.length ? Math.round(kcalDias.reduce((s, d) => s + (d.kcal as number), 0) / kcalDias.length) : null;

  // 2) Déficit acumulado × perda real.
  const trend = tendenciaDoPeso(dados.pesagens.map((p) => ({ data: p.data, peso: p.peso })));
  const real = perdaRealPelaTendencia(trend, desde);
  const def = gasto !== null ? deficitAcumulado(consumo, gasto) : [];
  const base = real[0]?.data ?? def[0]?.data ?? desde;
  const xDia = (d: string) => Math.max(0, diasEntre(base, d));
  const defNoPeriodo = def.filter((d) => d.data >= base);
  const diferenca = real.length > 1 && defNoPeriodo.length > 1 ? Math.round(((defNoPeriodo.at(-1)!.perdaEsperadaKg - defNoPeriodo[0].perdaEsperadaKg) - real.at(-1)!.perdaKg) * 10) / 10 : null;

  // 3) Composição corporal (avaliações com massa magra).
  const comp = dados.pesagens.filter((p) => p.data >= desde && p.massaMagraKg !== null);
  const compBase = comp[0]?.data;

  // 5) Proteína × meta.
  const protDias = consumo.filter((d) => d.proteinaG != null && d.kcal !== null && d.kcal >= 800);
  const barrasProt = semanal
    ? mediaPorSemana(consumo.map((d) => ({ data: d.data, valor: d.proteinaG != null && d.kcal !== null && d.kcal >= 800 ? d.proteinaG : null }))).map((s, i) => ({ x: i, y: s.media }))
    : protDias.map((d, i) => ({ x: i, y: Math.round(d.proteinaG as number) }));
  const mediaProt = protDias.length ? Math.round(protDias.reduce((s, d) => s + (d.proteinaG as number), 0) / protDias.length) : null;

  // 6) Treinos por semana.
  const semanas = treinosPorSemana(sessoes.filter((s) => s.status === "feito").map((s) => s.data));

  const rot = (a: string | undefined, b: string | undefined): [string, string] => [a ? formatarDataBr(a) : "", b ? formatarDataBr(b) : ""];

  return (
    <div className="space-y-12">
      <div className="space-y-3">
        <h2 className="text-2xl font-bold">Gráficos</h2>
        {seletor}
      </div>

      <Secao id="g-consumo" titulo="Consumo × gasto" nota={`${semanal ? "Média de calorias por semana" : "Calorias por dia"}, só em dias com registro completo (a partir de 800 kcal). A linha é o gasto estimado de hoje; barras laranjas ficaram acima dele. Estimativa.`}>
        <GraficoBarras
          titulo="Calorias consumidas e gasto estimado"
          unidade="kcal"
          linha={gasto}
          rotuloLinha="gasto"
          acimaEmAtencao
          barras={barrasKcal}
          rotulosX={rot(kcalDias[0]?.data, kcalDias.at(-1)?.data)}
        />
        {mediaKcal !== null && gasto !== null ? (
          <p className="font-semibold">
            Média: {n(mediaKcal)} kcal por dia.{" "}
            {mediaKcal < gasto ? `Déficit médio de ≈ ${n(gasto - mediaKcal)} kcal.` : `Superávit médio de ≈ ${n(mediaKcal - gasto)} kcal.`}
          </p>
        ) : null}
      </Secao>

      <Secao
        id="g-deficit"
        titulo="Déficit acumulado × perda real"
        nota="Tracejada: perda esperada pelo déficit registrado (7.700 kcal ≈ 1 kg). Cheia: perda real pela tendência do peso. Uma diferença grande costuma indicar registro de comida incompleto ou gasto mal estimado."
      >
        {def.length >= 2 || real.length >= 2 ? (
          <GraficoLinhas
            titulo="Perda esperada pelo déficit e perda real"
            unidade="kg"
            rotulosX={rot(base, real.at(-1)?.data ?? defNoPeriodo.at(-1)?.data)}
            series={[
              { nome: "Esperada", tipo: "tracejada", pontos: defNoPeriodo.map((d) => ({ x: xDia(d.data), y: d.perdaEsperadaKg - (defNoPeriodo[0]?.perdaEsperadaKg ?? 0) })) },
              { nome: "Real", tipo: "linha", pontos: real.map((r) => ({ x: xDia(r.data), y: r.perdaKg })) },
            ]}
          />
        ) : (
          <p className="text-suave">Precisa de registros de comida e de pesagens no período.</p>
        )}
        {diferenca !== null && Math.abs(diferenca) >= 1 ? (
          <p className="rounded-2xl border-2 border-aviso p-3 text-sm font-medium text-aviso">
            <span aria-hidden="true">! </span>A diferença é de ≈ {dec(Math.abs(diferenca))} kg {diferenca > 0 ? "a menos perdidos do que o déficit indica" : "a mais perdidos do que o déficit indica"}. Pode ser registro incompleto de comida ou gasto estimado diferente do real.
          </p>
        ) : null}
      </Secao>

      <Secao id="g-comp" titulo="Composição corporal" nota="Massa gorda = peso − massa magra, a cada avaliação com massa magra. Estimativa de balança.">
        {comp.length >= 2 ? (
          <GraficoLinhas
            titulo="Peso, massa magra e massa gorda"
            unidade="kg"
            rotulosX={rot(comp[0].data, comp.at(-1)!.data)}
            series={[
              { nome: "Peso", tipo: "pontos", pontos: comp.map((p) => ({ x: diasEntre(compBase!, p.data), y: p.peso })) },
              { nome: "Massa magra", tipo: "linha", pontos: comp.map((p) => ({ x: diasEntre(compBase!, p.data), y: p.massaMagraKg as number })) },
              { nome: "Massa gorda", tipo: "tracejada", pontos: comp.map((p) => ({ x: diasEntre(compBase!, p.data), y: Math.round((p.peso - (p.massaMagraKg as number)) * 10) / 10 })) },
            ]}
          />
        ) : (
          <p className="text-suave">Registre a massa magra em pelo menos duas pesagens para ver a composição.</p>
        )}
      </Secao>

      <Secao id="g-prot" titulo="Proteína × meta" nota={semanal ? "Média diária de proteína por semana." : "Proteína por dia."}>
        <GraficoBarras titulo="Proteína consumida e meta" unidade="g" linha={metaProt} rotuloLinha="meta" barras={barrasProt} rotulosX={rot(protDias[0]?.data, protDias.at(-1)?.data)} />
        {mediaProt !== null ? (
          <p className="font-semibold">
            Média: {n(mediaProt)} g por dia{metaProt ? ` (meta ${n(metaProt)} g)` : ""}.
          </p>
        ) : null}
      </Secao>

      <Secao id="g-treino" titulo="Treinos por semana">
        <GraficoBarras
          titulo="Treinos feitos por semana"
          unidade="treinos"
          barras={semanas.map((s, i) => ({ x: i, y: s.total }))}
          rotulosX={rot(semanas[0]?.inicio, semanas.at(-1)?.inicio)}
        />
      </Secao>
    </div>
  );
}
