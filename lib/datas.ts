export const FUSO = "America/Sao_Paulo";

/** Data (AAAA-MM-DD) do instante informado no fuso de São Paulo. */
export function dataEmSaoPaulo(instante: Date = new Date()): string {
  // en-CA formata como AAAA-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instante);
}

export function hojeSaoPaulo(): string {
  return dataEmSaoPaulo(new Date());
}

/** Formata AAAA-MM-DD como DD/MM/AAAA, sem conversão de fuso. */
export function formatarDataBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
