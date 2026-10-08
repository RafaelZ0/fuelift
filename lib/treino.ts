// Regras do treino, da água e do corpo (funções puras, sem banco). Datas são AAAA-MM-DD
// (fuso de São Paulo, já resolvido por quem chama).
import { somarDias } from "./datas";

// ─── Datas ───

const MS_DIA = 86_400_000;

function diasEntre(deIso: string, ateIso: string): number {
  const [a1, m1, d1] = deIso.split("-").map(Number);
  const [a2, m2, d2] = ateIso.split("-").map(Number);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / MS_DIA);
}

/** 0 = domingo ... 6 = sábado. */
export function diaDaSemana(iso: string): number {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

export const NOMES_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"] as const;

// ─── Readaptação: séries por semana ───

export type PlanoSeries = { inicio: string; seriesInicio: number; seriesDepois: number; semanasInicio: number };

/** Semana do plano (1 = primeira). Antes do início = 0. */
export function semanaDoPlano(inicio: string, data: string): number {
  const dias = diasEntre(inicio, data);
  return dias < 0 ? 0 : Math.floor(dias / 7) + 1;
}

/** Séries da fase de readaptação: poucas séries nas primeiras semanas, mais depois. */
export function seriesDaFase(plano: PlanoSeries, data: string): number {
  return semanaDoPlano(plano.inicio, data) <= plano.semanasInicio ? plano.seriesInicio : plano.seriesDepois;
}

/** Séries de um exercício: valor próprio, se houver; senão o da fase. */
export function seriesDoExercicio(seriesProprias: number | null, plano: PlanoSeries, data: string): number {
  return seriesProprias ?? seriesDaFase(plano, data);
}

// ─── Treino do dia ───

export type Agenda = ReadonlyMap<number, string>; // dia da semana → treinoId
export type Trocas = ReadonlyMap<string, string | null>; // data → treinoId (null = descanso)

/** Troca do dia vale mais que a agenda semanal. */
export function treinoDoDia(data: string, agenda: Agenda, trocas: Trocas): string | null {
  if (trocas.has(data)) return trocas.get(data) ?? null;
  return agenda.get(diaDaSemana(data)) ?? null;
}

// ─── Progressão ───

export type SerieFeita = { numero: number; cargaKg: number; repeticoes: number | null; segundos: number | null; feito: boolean };

export type Dica = {
  ultima: SerieFeita[];
  /** Todas as séries previstas foram feitas e chegaram ao topo da faixa. */
  subirCarga: boolean;
};

/**
 * Compara a última sessão do exercício com a faixa de repetições. Só sugere subir a
 * carga se TODAS as séries previstas foram feitas e atingiram o topo da faixa.
 * Para exercícios em segundos, o topo da faixa é o tempo máximo.
 */
export function dicaDeProgressao(ultima: ReadonlyArray<SerieFeita>, seriesPrevistas: number, topoDaFaixa: number, porSegundos = false): Dica | null {
  if (ultima.length === 0) return null;
  const ordenadas = [...ultima].sort((a, b) => a.numero - b.numero);
  const feitas = ordenadas.filter((s) => s.feito);
  const valor = (s: SerieFeita) => (porSegundos ? s.segundos : s.repeticoes) ?? 0;
  const subir = feitas.length >= seriesPrevistas && feitas.slice(0, seriesPrevistas).every((s) => valor(s) >= topoDaFaixa);
  return { ultima: ordenadas, subirCarga: subir };
}

// ─── Estatísticas e calendário ───

export type SessaoResumo = { data: string; status: "feito" | "faltou"; motivo: string | null };

export function estatisticasDoMes(sessoes: ReadonlyArray<SessaoResumo>, ano: number, mes: number) {
  const prefixo = `${ano}-${String(mes).padStart(2, "0")}-`;
  const doMes = sessoes.filter((s) => s.data.startsWith(prefixo));
  const motivos = new Map<string, number>();
  for (const s of doMes) if (s.status === "faltou" && s.motivo) motivos.set(s.motivo, (motivos.get(s.motivo) ?? 0) + 1);
  return {
    feitos: doMes.filter((s) => s.status === "feito").length,
    faltas: doMes.filter((s) => s.status === "faltou").length,
    motivos: [...motivos.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([motivo, n]) => ({ motivo, n })),
  };
}

/**
 * Sequência atual: quantos treinos feitos seguidos, do mais recente para trás, até a
 * primeira falta. Dias sem registro não quebram a sequência.
 */
export function sequenciaAtual(sessoes: ReadonlyArray<SessaoResumo>): number {
  const recentes = [...sessoes].sort((a, b) => b.data.localeCompare(a.data));
  let n = 0;
  for (const s of recentes) {
    if (s.status !== "feito") break;
    n++;
  }
  return n;
}

export type StatusDia = "feito" | "faltou" | "planejado" | "sem_registro" | "livre";

/** Estado de cada dia do mês: feito, faltou, planejado (futuro), sem registro (passado planejado) ou livre. */
export function calendarioDoMes(
  ano: number,
  mes: number,
  hoje: string,
  sessoes: ReadonlyArray<SessaoResumo>,
  planejado: (data: string) => boolean,
): Array<{ data: string; status: StatusDia }> {
  const porData = new Map(sessoes.map((s) => [s.data, s.status]));
  const total = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const dias: Array<{ data: string; status: StatusDia }> = [];
  for (let d = 1; d <= total; d++) {
    const data = `${ano}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const reg = porData.get(data);
    let status: StatusDia;
    if (reg) status = reg;
    else if (!planejado(data)) status = "livre";
    else status = data >= hoje ? "planejado" : "sem_registro";
    dias.push({ data, status });
  }
  return dias;
}

// ─── Água ───

export const BOTOES_AGUA = [200, 300, 500] as const;

export function totalAgua(registros: ReadonlyArray<{ ml: number }>): number {
  return registros.reduce((s, r) => s + r.ml, 0);
}

// ─── Corpo: tendência do peso ───

export type PontoPeso = { data: string; peso: number; tendencia: number };

/**
 * Tendência do peso por média móvel exponencial. As pesagens diárias oscilam com
 * água e sal; a tendência suaviza. Dias sem pesagem aumentam o peso da pesagem
 * seguinte (alfa efetivo = 1 − (1 − alfa)^dias). Alfa padrão de 0,1 por dia.
 */
export function tendenciaDoPeso(pesagens: ReadonlyArray<{ data: string; peso: number }>, alfa = 0.1): PontoPeso[] {
  const ordenadas = [...pesagens].sort((a, b) => a.data.localeCompare(b.data));
  const saida: PontoPeso[] = [];
  let tend = 0;
  ordenadas.forEach((p, i) => {
    if (i === 0) tend = p.peso;
    else {
      const dias = Math.max(1, diasEntre(ordenadas[i - 1].data, p.data));
      const a = 1 - (1 - alfa) ** dias;
      tend = tend + a * (p.peso - tend);
    }
    saida.push({ data: p.data, peso: p.peso, tendencia: Math.round(tend * 100) / 100 });
  });
  return saida;
}

/** Massa gorda = peso − massa magra, quando as duas existem. */
export function massaGorda(peso: number, massaMagra: number | null): number | null {
  return massaMagra === null ? null : Math.round((peso - massaMagra) * 10) / 10;
}

// ─── Aplicação semanal (só um lembrete de "feito") ───

/** O lembrete aparece no dia escolhido, se ainda não houver registro nos últimos 6 dias. */
export function aplicacaoPendente(hoje: string, diaEscolhido: number | null, datasRegistradas: ReadonlyArray<string>): boolean {
  if (diaEscolhido === null || diaDaSemana(hoje) !== diaEscolhido) return false;
  const limite = somarDias(hoje, -6);
  return !datasRegistradas.some((d) => d >= limite && d <= hoje);
}

// ─── Cronômetro de descanso ───
// Guarda a HORA EXATA do fim (não conta segundo a segundo): o relógio da página pode
// ser pausado quando a tela apaga, então o tempo restante é sempre recalculado.

export function fimDoDescanso(agoraMs: number, segundos: number): number {
  return agoraMs + Math.round(segundos * 1000);
}

export function segundosRestantes(fimMs: number, agoraMs: number): number {
  return Math.max(0, Math.ceil((fimMs - agoraMs) / 1000));
}

export function adicionarSegundos(fimMs: number, agoraMs: number, extra: number): number {
  return Math.max(fimMs, agoraMs) + extra * 1000;
}

export function formatarTempo(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const DESCANSO_PADRAO_S = 90;
