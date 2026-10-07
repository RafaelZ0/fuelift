import Link from "next/link";
import type { AlimentoResumo } from "@/lib/dal/alimentos";
import { formatarKcal } from "@/lib/nutricao";

/** Monta a query string de volta (data e refeição) só com valores válidos. */
export function voltaQuery(data: string | null, refeicao: string | null): string {
  const q = new URLSearchParams();
  if (data) q.set("data", data);
  if (refeicao) q.set("refeicao", refeicao);
  return q.size ? `?${q}` : "";
}

export function ListaAlimentos({ itens, volta }: { itens: AlimentoResumo[]; volta: string }) {
  return (
    <ul>
      {itens.map((a) => (
        <li key={`${a.tipo}-${a.id}`}>
          <Link
            href={`/comida/alimento/${a.tipo}/${a.id}${volta}`}
            className="flex min-h-14 items-center justify-between gap-4 border-b border-linha py-2"
          >
            <span>
              <span className="block font-medium">
                {a.favorito ? <span aria-label="favorito" className="text-destaque">★ </span> : null}
                {a.nome}
              </span>
              <span className="text-sm text-suave">
                {a.tipo === "usuario" ? `Meu alimento${a.marca ? ` · ${a.marca}` : ""}` : "TACO"}
              </span>
            </span>
            <span className="shrink-0 text-sm text-suave">
              {a.kcal === null ? "sem kcal" : `${formatarKcal(a.kcal)} kcal/100 g`}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CitacaoTaco({ citacao }: { citacao: string | null }) {
  if (!citacao) return null;
  return <p className="pt-6 text-xs text-suave">Fonte dos alimentos da TACO: {citacao}</p>;
}

export function Voltar({ href, rotulo = "Voltar" }: { href: string; rotulo?: string }) {
  return (
    <Link href={href} className="inline-flex min-h-11 items-center font-semibold text-suave">
      ‹ {rotulo}
    </Link>
  );
}
