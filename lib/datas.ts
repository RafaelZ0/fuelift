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

/** Soma `dias` a uma data AAAA-MM-DD (aritmética de calendário, sem fuso). */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(a, m - 1, d + dias));
  return dt.toISOString().slice(0, 10);
}

const DIAS_SEMANA = ["dom.", "seg.", "ter.", "qua.", "qui.", "sex.", "sáb."];

/** "Hoje", "Ontem" ou "seg., 06/10/2026". */
export function rotuloDia(iso: string, hoje: string): string {
  if (iso === hoje) return "Hoje";
  if (iso === somarDias(hoje, -1)) return "Ontem";
  const [a, m, d] = iso.split("-").map(Number);
  const semana = DIAS_SEMANA[new Date(Date.UTC(a, m - 1, d)).getUTCDay()];
  return `${semana}, ${formatarDataBr(iso)}`;
}

/** Formata AAAA-MM-DD como DD/MM/AAAA, sem conversão de fuso. */
export function formatarDataBr(iso: string | null | undefined): string {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}
