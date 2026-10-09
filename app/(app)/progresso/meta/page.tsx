import Link from "next/link";
import { GraficoLinhas } from "@/components/graficos";
import { exigirUsuario } from "@/lib/auth/sessao";
import { carregarEnergia, listarProjecoes } from "@/lib/dal/energia";
import { formatarDataBr, hojeSaoPaulo } from "@/lib/datas";
import { verificarAcessoIa } from "@/lib/ia/acesso";
import { marcos, projetarPeso } from "@/lib/projecao";
import { dividirMacros } from "@/lib/projecao";
import { compararPlanoReal } from "@/lib/progresso-graficos";
import { ROTULOS_ATIVIDADE } from "@/lib/energia";
import { CartaoOpcao, FormPesoMeta, FormRitmoMax, type OpcaoTela } from "./formularios";

export const metadata = { title: "Meta e plano · Kalyft" };

const n = (v: number) => v.toLocaleString("pt-BR");
const dec = (v: number, c = 1) => v.toLocaleString("pt-BR", { maximumFractionDigits: c });
const FALTA: Record<string, string> = {
  sexo: "o sexo",
  nascimento: "a data de nascimento",
  altura: "a altura",
  atividade: "o nível de atividade",
  peso: "uma pesagem",
};

export default async function PaginaMeta(props: PageProps<"/progresso/meta">) {
  const { userId, admin } = await exigirUsuario();
  const sp = await props.searchParams;
  const hoje = hojeSaoPaulo();
  const dados = await carregarEnergia(userId, hoje);
  const p = dados.painel;
  const [projecoes, acesso] = await Promise.all([listarProjecoes(userId, 1), verificarAcessoIa(userId, admin !== null)]);

  const pesoMeta = dados.meta?.pesoMetaKg ?? null;
  const plan = p.planejamento;
  const opcoes: OpcaoTela[] =
    plan && p.pesoAtualKg !== null
      ? plan.opcoes.map((o) => {
          const m = dividirMacros({ kcal: o.kcal, pesoKg: p.pesoAtualKg as number, emDeficit: plan.tipo === "perder" });
          return {
            id: o.id,
            rotulo: o.rotulo,
            kcal: o.kcal,
            kgSemana: o.kgSemana,
            pctSemana: o.pctSemana,
            deficitDia: o.deficitDia,
            semanas: o.semanasParaMeta,
            equilibrio: o.pesoDeEquilibrio,
            limitadaPorTmb: o.limitadaPorTmb,
            recomendada: o.recomendada,
            proteinaG: m.proteinaG,
            carboG: m.carboG,
            gorduraG: m.gorduraG,
            ehMetaAtual: dados.meta?.kcal === o.kcal,
          };
        })
      : [];

  // Gráfico: plano recomendado × projeção com o consumo médio real dos últimos 7 dias.
  const recomendada = plan?.opcoes.find((o) => o.recomendada) ?? plan?.opcoes[0] ?? null;
  const projPlano =
    recomendada && p.gasto && p.pesoAtualKg !== null && p.fatorAtividade !== null && pesoMeta !== null
      ? projetarPeso({ pesoInicial: p.pesoAtualKg, gastoInicial: p.gasto.valor, consumoDiario: recomendada.kcal, fatorAtividade: p.fatorAtividade, pesoMeta })
      : null;
  // Horizonte do gráfico: até a meta (com folga), ou 26 semanas; nunca os 2 anos inteiros.
  const horizonte = Math.min(78, Math.max(12, projPlano?.semanasParaMeta != null ? projPlano.semanasParaMeta + 4 : 26));
  const recorte = <T extends { semana: number }>(l: T[] | undefined) => (l ?? []).filter((q) => q.semana <= horizonte);
  const semanasGrafico = Math.max(recorte(projPlano?.pontos).length, recorte(p.projecaoReal?.pontos).length);

  const ultimaProj = projecoes[0] ?? null;
  const planoReal =
    ultimaProj && pesoMeta !== null
      ? compararPlanoReal({
          projecaoCriadaEm: ultimaProj.criadaEm.toISOString().slice(0, 10),
          pontos: ultimaProj.pontos,
          hoje,
          tendenciaAtualKg: p.tendenciaKg,
          pesoMetaKg: pesoMeta,
        })
      : null;

  return (
    <div className="space-y-12">
      <Link href="/progresso" className="inline-flex min-h-11 items-center font-semibold text-suave">‹ Voltar</Link>
      <h1 className="text-3xl font-black">Meta e plano</h1>

      {sp.salva === "1" ? <p role="status" className="rounded-2xl border-2 border-ok p-4 font-semibold text-ok"><span aria-hidden="true">✓ </span>Meta de calorias e macros salva.</p> : null}

      {p.faltam.length > 0 ? (
        <section className="space-y-3 rounded-2xl border-2 border-aviso p-4">
          <p className="font-semibold text-aviso"><span aria-hidden="true">! </span>Para calcular seu gasto, falta informar: {p.faltam.map((f) => FALTA[f]).join(", ")}.</p>
          <div className="flex flex-wrap gap-3">
            {p.faltam.some((f) => f !== "peso") ? <Link href="/ajustes" className="min-h-12 rounded-full bg-destaque px-5 py-3 font-bold text-sobre-destaque">Completar o perfil</Link> : null}
            {p.faltam.includes("atividade") ? <Link href="/ajustes/atividade" className="min-h-12 rounded-full border-2 border-borda px-5 py-3 font-semibold">Descobrir meu nível com a IA</Link> : null}
            {p.faltam.includes("peso") ? <Link href="/progresso" className="min-h-12 rounded-full border-2 border-borda px-5 py-3 font-semibold">Registrar meu peso</Link> : null}
          </div>
        </section>
      ) : null}

      {p.gasto ? (
        <section aria-labelledby="gasto" className="space-y-3">
          <h2 id="gasto" className="text-2xl font-bold">Seu gasto por dia (estimativa)</h2>
          <p className="text-4xl font-black">{n(p.gasto.valor)} <span className="text-lg font-bold text-suave">kcal</span></p>
          <p className="text-suave">Provavelmente entre {n(p.gasto.minimo)} e {n(p.gasto.maximo)} kcal.</p>
          <p className="text-sm text-suave">{p.gasto.explicacao}</p>
          <p className="text-sm text-suave">
            Em repouso (taxa metabólica basal): ≈ {n(p.tmb ?? 0)} kcal. Nível de atividade usado: <Link href="/ajustes/atividade" className="underline">{dados.perfil.nivel ? ROTULOS_ATIVIDADE[dados.perfil.nivel] : "—"}</Link>.
          </p>
          {p.previsaoDaMeta ? (
            <p className="rounded-2xl border-2 border-borda p-3 font-semibold">{p.previsaoDaMeta.texto}</p>
          ) : null}
          {p.consumoMedio7d ? (
            <p className="text-sm text-suave">
              Nos últimos {p.consumoMedio7d.dias} dias com registro você comeu em média {n(p.consumoMedio7d.kcal)} kcal
              {p.ritmoAtualKgSemana !== null ? `, o que sugere ${p.ritmoAtualKgSemana > 0.05 ? `perder cerca de ${dec(p.ritmoAtualKgSemana, 2)} kg` : p.ritmoAtualKgSemana < -0.05 ? `ganhar cerca de ${dec(-p.ritmoAtualKgSemana, 2)} kg` : "manter o peso"} por semana` : ""}.
            </p>
          ) : null}
        </section>
      ) : null}

      <section aria-labelledby="meta-peso" className="space-y-4">
        <h2 id="meta-peso" className="text-2xl font-bold">Seu peso desejado</h2>
        <FormPesoMeta pesoMeta={pesoMeta === null ? "" : String(pesoMeta).replace(".", ",")} dataMeta={dados.meta?.dataMeta ?? ""} />
      </section>

      {plan ? (
        <>
          {plan.avisos.length > 0 ? (
            <ul className="space-y-3" aria-label="Avisos">
              {plan.avisos.map((a, i) => (
                <li key={i} role="alert" className={`rounded-2xl border-2 p-4 font-medium ${a.nivel === "bloqueio" ? "border-erro text-erro" : "border-aviso text-aviso"}`}>
                  <span aria-hidden="true">{a.nivel === "bloqueio" ? "⚠ " : "! "}</span>
                  {a.texto}
                </li>
              ))}
            </ul>
          ) : null}

          {plan.paraData ? (
            <section className="space-y-2 rounded-2xl border-2 border-borda p-4">
              <h2 className="text-xl font-bold">Para a data {formatarDataBr(dados.meta?.dataMeta ?? null)}</h2>
              <p>
                Seriam {dec(plan.paraData.kgSemana, 2)} kg por semana ({dec(plan.paraData.pctSemana, 2)}% do peso), com cerca de {n(plan.paraData.kcal)} kcal por dia.{" "}
                <strong>{plan.paraData.viavel ? "Está dentro do ritmo seguro." : "Passa do ritmo seguro: converse com o nutricionista."}</strong>
              </p>
            </section>
          ) : null}

          {opcoes.length > 0 ? (
            <section aria-labelledby="opcoes" className="space-y-4">
              <h2 id="opcoes" className="text-2xl font-bold">
                {plan.tipo === "manter" ? "Para manter o peso" : plan.tipo === "ganhar" ? "Para ganhar peso devagar" : "Quanto comer por dia"}
              </h2>
              <p className="text-sm text-suave">São sugestões calculadas pelo app (estimativas). A meta só muda quando você tocar em &quot;Usar como minha meta&quot;, e você pode ajustar depois em Ajustes ou combinar com o nutricionista.</p>
              <ul className="space-y-5">
                {opcoes.map((o) => (
                  <CartaoOpcao key={o.id} o={o} tipo={plan.tipo} ia={acesso.ok} />
                ))}
              </ul>
            </section>
          ) : null}

          {pesoMeta !== null && p.pesoAtualKg !== null && Math.abs(p.pesoAtualKg - pesoMeta) > 5 ? (
            <p className="text-sm text-suave">Marcos pelo caminho: {marcos(p.pesoAtualKg, pesoMeta).map((m) => `${dec(m)} kg`).join(" → ")}.</p>
          ) : null}

          {semanasGrafico >= 2 && projPlano ? (
            <section aria-labelledby="proj" className="space-y-3">
              <h2 id="proj" className="text-2xl font-bold">Projeção do peso</h2>
              <GraficoLinhas
                titulo="Projeção do peso por semana"
                unidade="kg"
                linhaMeta={pesoMeta}
                rotulosX={["hoje", `${semanasGrafico - 1} semanas`]}
                series={[
                  { nome: "Plano", tipo: "tracejada", pontos: recorte(projPlano.pontos).map((q) => ({ x: q.semana, y: q.peso })) },
                  ...(p.projecaoReal ? [{ nome: "Seu consumo atual", tipo: "linha" as const, pontos: recorte(p.projecaoReal.pontos).map((q) => ({ x: q.semana, y: q.peso })) }] : []),
                ]}
              />
              <p className="text-xs text-suave">Linha tracejada: se seguir a opção recomendada. Linha cheia: se continuar comendo a média dos últimos 7 dias. O gasto diminui conforme o peso cai, por isso a curva desacelera. Estimativa.</p>
            </section>
          ) : null}

          {planoReal && planoReal.situacao !== "sem_dados" ? (
            <section className="space-y-1 rounded-2xl border-2 border-borda p-4">
              <h2 className="text-xl font-bold">Plano × real</h2>
              <p>
                {planoReal.situacao === "no_ritmo" ? "No ritmo do plano." : planoReal.situacao === "adiantado" ? "Adiantado em relação ao plano." : "Um pouco atrás do plano."}{" "}
                <span className="text-suave">Na semana {planoReal.semana} o plano previa {dec(planoReal.previstoKg ?? 0)} kg; sua tendência é {dec(p.tendenciaKg ?? 0)} kg.</span>
              </p>
            </section>
          ) : null}
        </>
      ) : null}

      <section aria-labelledby="ritmo" className="space-y-4">
        <h2 id="ritmo" className="text-2xl font-bold">Ritmo máximo</h2>
        <FormRitmoMax atual={dados.perfil.ritmoMaxPct} />
      </section>

      <p className="text-xs text-suave">O app não substitui nutricionista ou médico. Se você usa medicação, tem alguma condição de saúde ou está abaixo do peso, converse com um profissional antes de mudar a alimentação.</p>
    </div>
  );
}
