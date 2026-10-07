import Link from "next/link";
import { exigirUsuario } from "@/lib/auth/sessao";
import { metaVigente } from "@/lib/dal/metas";
import { listarDia } from "@/lib/dal/registros";
import { hojeSaoPaulo, rotuloDia, somarDias } from "@/lib/datas";
import { compararComMeta, formatarGramas, formatarKcal, somarDia, type CampoTotal } from "@/lib/nutricao";
import { dataDiario, REFEICOES, ROTULOS_REFEICAO } from "@/lib/validacao/comida";
import { MenuRefeicao } from "./menu-refeicao";

export const metadata = { title: "Comida · FuelLift" };

const LINHAS_TOTAIS: Array<{ campo: CampoTotal; rotulo: string; unidade: string; meta: "kcal" | "proteinaG" | "carboG" | "gorduraG" | null }> = [
  { campo: "kcal", rotulo: "Calorias", unidade: "kcal", meta: "kcal" },
  { campo: "proteinaG", rotulo: "Proteína", unidade: "g", meta: "proteinaG" },
  { campo: "carboG", rotulo: "Carboidrato", unidade: "g", meta: "carboG" },
  { campo: "gorduraG", rotulo: "Gordura", unidade: "g", meta: "gorduraG" },
  { campo: "fibraG", rotulo: "Fibra", unidade: "g", meta: null },
];

export default async function PaginaComida(props: PageProps<"/comida">) {
  const { userId } = await exigirUsuario();
  const hoje = hojeSaoPaulo();
  const pedido = (await props.searchParams).data;
  const r = dataDiario.safeParse(typeof pedido === "string" ? pedido : hoje);
  const data = r.success ? r.data : hoje;

  const [registros, meta] = await Promise.all([listarDia(userId, data), metaVigente(userId, data)]);
  const totais = somarDia(registros);

  return (
    <div className="space-y-10">
      <header className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-4xl font-black tracking-tight">Comida</h1>
          <div className="flex gap-2 text-sm font-semibold">
            <Link href="/comida/meus-alimentos" className="flex min-h-11 items-center rounded-full border-2 border-linha px-3 text-suave">
              Meus alimentos
            </Link>
            <Link href={`/comida/refeicoes?data=${data}`} className="flex min-h-11 items-center rounded-full border-2 border-linha px-3 text-suave">
              Refeições
            </Link>
          </div>
        </div>
        <nav aria-label="Dia" className="flex items-center justify-between">
          <Link href={`/comida?data=${somarDias(data, -1)}`} aria-label="Dia anterior" className="flex min-h-12 min-w-12 items-center justify-center rounded-full border-2 border-linha text-xl font-bold">
            ‹
          </Link>
          <div className="text-center">
            <p className="text-xl font-bold">{rotuloDia(data, hoje)}</p>
            {data !== hoje ? (
              <Link href="/comida" className="text-sm font-semibold text-destaque underline">
                Voltar para hoje
              </Link>
            ) : null}
          </div>
          {data < hoje ? (
            <Link href={`/comida?data=${somarDias(data, 1)}`} aria-label="Próximo dia" className="flex min-h-12 min-w-12 items-center justify-center rounded-full border-2 border-linha text-xl font-bold">
              ›
            </Link>
          ) : (
            <span className="min-h-12 min-w-12" aria-hidden="true" />
          )}
        </nav>
      </header>

      <section aria-labelledby="totais" className="space-y-3">
        <h2 id="totais" className="sr-only">Totais do dia</h2>
        {LINHAS_TOTAIS.map(({ campo, rotulo, unidade, meta: chaveMeta }) => {
          const valorMeta = chaveMeta && meta ? (meta[chaveMeta] ?? null) : null;
          const c = compararComMeta(totais[campo], valorMeta);
          const fmt = campo === "kcal" ? formatarKcal : formatarGramas;
          const largura = c.percentual === null ? 0 : Math.min(100, c.percentual);
          return (
            <div key={campo}>
              <div className="flex items-baseline justify-between">
                <span className="text-suave">{rotulo}</span>
                <span className="font-semibold">
                  {fmt(c.consumido)}
                  {c.meta !== null ? <span className="text-suave"> / {fmt(c.meta)}</span> : null} {unidade}
                  {totais.parcial[campo] ? <span className="ml-1 text-sm text-suave" title="Algum item não tem esse valor na tabela">(parcial)</span> : null}
                </span>
              </div>
              {c.meta !== null ? (
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-linha">
                  <progress className="sr-only" value={largura} max={100} />
                  <div className={`h-full rounded-full ${c.percentual! > 110 ? "bg-erro" : "bg-destaque"} ${larguraClasse(largura)}`} />
                </div>
              ) : null}
            </div>
          );
        })}
        {!meta ? (
          <p className="text-sm text-suave">
            Sem meta para este dia. <Link href="/ajustes" className="underline">Definir metas</Link>
          </p>
        ) : null}
      </section>

      {REFEICOES.map((ref) => {
        const itens = registros.filter((x) => x.refeicao === ref);
        const kcal = itens.reduce((s, x) => s + x.kcal, 0);
        return (
          <section key={ref} aria-labelledby={`ref-${ref}`} className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 id={`ref-${ref}`} className="text-2xl font-bold">
                {ROTULOS_REFEICAO[ref]}
              </h2>
              <span className="text-suave">{formatarKcal(kcal)} kcal</span>
            </div>
            <ul>
              {itens.map((x) => (
                <li key={x.id}>
                  <Link href={`/comida/registro/${x.id}?data=${data}`} className="flex min-h-14 items-center justify-between gap-4 border-b border-linha py-2">
                    <span>
                      <span className="block font-medium">{x.nome}</span>
                      <span className="text-sm text-suave">
                        {x.medidaTexto ? `${x.medidaTexto} · ` : ""}
                        {formatarGramas(x.gramas)} g
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold">{formatarKcal(x.kcal)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-3 pt-1">
              <Link href={`/comida/adicionar?data=${data}&refeicao=${ref}`} className="flex min-h-12 flex-1 items-center justify-center rounded-full bg-destaque font-bold text-fundo">
                + Adicionar
              </Link>
              <MenuRefeicao data={data} refeicao={ref} temItens={itens.length > 0} />
            </div>
          </section>
        );
      })}
    </div>
  );
}

// Classes fixas (sem estilo inline, por causa da CSP): largura em passos de 5%.
function larguraClasse(p: number): string {
  const passos = [
    "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]", "w-[35%]", "w-[40%]", "w-[45%]", "w-[50%]",
    "w-[55%]", "w-[60%]", "w-[65%]", "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]", "w-full",
  ];
  return passos[Math.round(p / 5)];
}
