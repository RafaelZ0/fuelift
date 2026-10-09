// Gráficos simples em SVG (renderizados no servidor, sem pacote e sem estilo inline: compatível com a CSP).

const PASSOS = [
  "w-0", "w-[5%]", "w-[10%]", "w-[15%]", "w-[20%]", "w-[25%]", "w-[30%]", "w-[35%]", "w-[40%]", "w-[45%]", "w-[50%]",
  "w-[55%]", "w-[60%]", "w-[65%]", "w-[70%]", "w-[75%]", "w-[80%]", "w-[85%]", "w-[90%]", "w-[95%]", "w-full",
];

/** Barra de progresso em passos de 5% (classes fixas, sem estilo inline). */
export function Barra({ percentual, aviso = false }: { percentual: number; aviso?: boolean }) {
  const p = Math.max(0, Math.min(100, percentual));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-linha" role="progressbar" aria-valuenow={Math.round(p)} aria-valuemin={0} aria-valuemax={100}>
      <div className={`h-full rounded-full ${aviso ? "bg-aviso" : "bg-destaque"} ${PASSOS[Math.round(p / 5)]}`} />
    </div>
  );
}

export type PontoGrafico = { x: number; y: number };
export type SerieGrafico = { nome: string; pontos: PontoGrafico[]; tipo: "pontos" | "linha" | "tracejada" };

const L = 320;
const A = 170;
const M = { esq: 38, dir: 10, topo: 10, base: 26 };

/**
 * Gráfico de linhas/pontos. `x` e `y` são números; `rotulosX` mostra o primeiro e o último
 * rótulo embaixo. A linha horizontal opcional marca uma meta.
 */
export function GraficoLinhas({
  series,
  rotulosX,
  unidade,
  titulo,
  linhaMeta,
}: {
  series: SerieGrafico[];
  rotulosX: [string, string];
  unidade: string;
  titulo: string;
  linhaMeta?: number | null;
}) {
  const todos = series.flatMap((s) => s.pontos);
  if (todos.length === 0) return <p className="text-suave">Sem dados ainda.</p>;
  const ys = [...todos.map((p) => p.y), ...(linhaMeta != null ? [linhaMeta] : [])];
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  if (minY === maxY) {
    minY -= 1;
    maxY += 1;
  }
  const folga = (maxY - minY) * 0.1;
  minY -= folga;
  maxY += folga;
  const minX = Math.min(...todos.map((p) => p.x));
  const maxX = Math.max(...todos.map((p) => p.x));
  const larg = L - M.esq - M.dir;
  const alt = A - M.topo - M.base;
  const px = (x: number) => M.esq + (maxX === minX ? larg / 2 : ((x - minX) / (maxX - minX)) * larg);
  const py = (y: number) => M.topo + alt - ((y - minY) / (maxY - minY)) * alt;
  const grade = [0, 0.5, 1].map((f) => minY + f * (maxY - minY));
  const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={titulo} className="w-full">
      <title>{titulo}</title>
      {grade.map((g) => (
        <g key={g}>
          <line x1={M.esq} x2={L - M.dir} y1={py(g)} y2={py(g)} className="stroke-linha" strokeWidth={1} />
          <text x={M.esq - 6} y={py(g) + 4} textAnchor="end" className="fill-suave" fontSize={10}>
            {fmt(g)}
          </text>
        </g>
      ))}
      {linhaMeta != null ? (
        <g>
          <line x1={M.esq} x2={L - M.dir} y1={py(linhaMeta)} y2={py(linhaMeta)} className="stroke-apoio-texto" strokeWidth={1} strokeDasharray="4 3" />
          <text x={L - M.dir} y={py(linhaMeta) - 3} textAnchor="end" className="fill-apoio-texto" fontSize={10}>
            meta {fmt(linhaMeta)} {unidade}
          </text>
        </g>
      ) : null}
      {series.map((s) =>
        s.tipo === "tracejada" ? (
          <polyline
            key={s.nome}
            fill="none"
            className="stroke-apoio-texto"
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.pontos.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")}
          />
        ) : s.tipo === "linha" ? (
          <polyline
            key={s.nome}
            fill="none"
            className="stroke-marca"
            strokeWidth={2.5}
            strokeLinejoin="round"
            strokeLinecap="round"
            points={s.pontos.map((p) => `${px(p.x)},${py(p.y)}`).join(" ")}
          />
        ) : (
          s.pontos.map((p, i) => <circle key={`${s.nome}-${i}`} cx={px(p.x)} cy={py(p.y)} r={2.6} className="fill-suave" />)
        ),
      )}
      <text x={M.esq} y={A - 8} className="fill-suave" fontSize={10}>
        {rotulosX[0]}
      </text>
      <text x={L - M.dir} y={A - 8} textAnchor="end" className="fill-suave" fontSize={10}>
        {rotulosX[1]}
      </text>
    </svg>
  );
}

export type BarraGrafico = { x: number; y: number };

/**
 * Barras (uma por dia ou semana) com uma linha horizontal de referência (gasto, meta...). Barras acima da
 * linha, quando `acimaEmAtencao`, ficam em laranja: acima do gasto ou da meta é atenção, não erro.
 */
export function GraficoBarras({
  barras,
  rotulosX,
  unidade,
  titulo,
  linha,
  rotuloLinha,
  acimaEmAtencao = false,
}: {
  barras: BarraGrafico[];
  rotulosX: [string, string];
  unidade: string;
  titulo: string;
  linha?: number | null;
  rotuloLinha?: string;
  acimaEmAtencao?: boolean;
}) {
  if (barras.length === 0) return <p className="text-suave">Sem dados ainda.</p>;
  const maxY = Math.max(...barras.map((b) => b.y), linha ?? 0, 1) * 1.1;
  const larg = L - M.esq - M.dir;
  const alt = A - M.topo - M.base;
  const n = barras.length;
  const passo = larg / n;
  const largBarra = Math.max(1.5, Math.min(passo * 0.7, 18));
  const py = (y: number) => M.topo + alt - (y / maxY) * alt;
  const fmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const grade = [0, 0.5, 1].map((f) => f * maxY);
  return (
    <svg viewBox={`0 0 ${L} ${A}`} role="img" aria-label={titulo} className="w-full">
      <title>{titulo}</title>
      {grade.map((g) => (
        <g key={g}>
          <line x1={M.esq} x2={L - M.dir} y1={py(g)} y2={py(g)} className="stroke-linha" strokeWidth={1} />
          <text x={M.esq - 6} y={py(g) + 4} textAnchor="end" className="fill-suave" fontSize={10}>
            {fmt(g)}
          </text>
        </g>
      ))}
      {barras.map((b, i) => {
        const x = M.esq + i * passo + (passo - largBarra) / 2;
        const h = Math.max(0, (b.y / maxY) * alt);
        const acima = acimaEmAtencao && linha != null && b.y > linha;
        return <rect key={i} x={x} y={M.topo + alt - h} width={largBarra} height={h} rx={1.5} className={acima ? "fill-aviso" : "fill-marca"} />;
      })}
      {linha != null ? (
        <g>
          <line x1={M.esq} x2={L - M.dir} y1={py(linha)} y2={py(linha)} className="stroke-apoio-texto" strokeWidth={1.5} strokeDasharray="4 3" />
          <text x={L - M.dir} y={py(linha) - 3} textAnchor="end" className="fill-apoio-texto" fontSize={10}>
            {rotuloLinha ?? "referência"} {fmt(linha)} {unidade}
          </text>
        </g>
      ) : null}
      <text x={M.esq} y={A - 8} className="fill-suave" fontSize={10}>
        {rotulosX[0]}
      </text>
      <text x={L - M.dir} y={A - 8} textAnchor="end" className="fill-suave" fontSize={10}>
        {rotulosX[1]}
      </text>
    </svg>
  );
}
