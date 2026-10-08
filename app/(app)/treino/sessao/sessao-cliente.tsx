"use client";

import { useActionState, useCallback, useEffect, useRef, useState } from "react";
import { Aviso, BotaoEnviar, Campo } from "@/components/ui";
import { FotoExercicio } from "@/components/foto-exercicio";
import { adicionarSegundos, fimDoDescanso, formatarTempo, segundosRestantes } from "@/lib/treino";
import { apagarSerieDoDia, concluirTreino, salvarSerieDoDia, type EstadoTreino } from "../actions";

export type OpcaoTela = {
  id: string;
  nome: string;
  principal: boolean;
  unilateral: boolean;
  cargaPorHalter: boolean;
  porSegundos: boolean;
  fotoId: string | null;
};
export type ItemTela = {
  id: string;
  series: number;
  repsMin: number;
  repsMax: number;
  descansoS: number;
  observacao: string | null;
  opcoes: OpcaoTela[];
};
export type DicaTela = { ultima: Array<{ numero: number; cargaKg: number; repeticoes: number | null; segundos: number | null }>; subirCarga: boolean };
type Feita = { exercicioId: string; numero: number; cargaKg: number; repeticoes: number | null; segundos: number | null; feito: boolean };

const PASSO_CARGA = 2.5;
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });

// ─── Aviso sonoro (bipe gerado no código) ───
// No iPhone o som só funciona depois de um toque na tela: o contexto é criado/retomado
// dentro do clique do botão "feito". Vibração não existe no iPhone: fica só som e cor.

function useAviso() {
  const ctx = useRef<AudioContext | null>(null);
  const desbloquear = useCallback(() => {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx.current ??= new Ctor();
      void ctx.current.resume();
    } catch {
      /* sem áudio: segue só o aviso visual */
    }
  }, []);
  const avisar = useCallback(() => {
    try {
      const c = ctx.current;
      if (c && c.state === "running") {
        [0, 0.28, 0.56].forEach((atraso) => {
          const o = c.createOscillator();
          const g = c.createGain();
          o.frequency.value = 880;
          g.gain.value = 0.25;
          o.connect(g);
          g.connect(c.destination);
          o.start(c.currentTime + atraso);
          o.stop(c.currentTime + atraso + 0.2);
        });
      }
      if ("vibrate" in navigator) navigator.vibrate([200, 100, 200]);
    } catch {
      /* ignora */
    }
  }, []);
  return { desbloquear, avisar };
}

// Mantém a tela acesa (só funciona onde o iOS permite: 18.4+ no app instalado).
function useTelaAcesa() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let ativo = true;
    const pedir = async () => {
      try {
        if (ativo && "wakeLock" in navigator && document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen");
      } catch {
        /* não suportado ou bateria baixa */
      }
    };
    void pedir();
    const aoVoltar = () => void pedir();
    document.addEventListener("visibilitychange", aoVoltar);
    return () => {
      ativo = false;
      document.removeEventListener("visibilitychange", aoVoltar);
      void lock?.release().catch(() => undefined);
    };
  }, []);
}

// ─── Cronômetro: guarda a hora exata do fim e recalcula, em vez de contar segundo a segundo ───

function Cronometro({ fimMs, aoAcabar, onMais, onPular }: { fimMs: number; aoAcabar: () => void; onMais: () => void; onPular: () => void }) {
  const [agora, setAgora] = useState(() => Date.now());
  const acabou = useRef(false);

  useEffect(() => {
    acabou.current = false;
    const tick = () => setAgora(Date.now());
    const t = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [fimMs]);

  const resta = segundosRestantes(fimMs, agora);
  useEffect(() => {
    if (resta === 0 && !acabou.current) {
      acabou.current = true;
      aoAcabar();
    }
  }, [resta, aoAcabar]);

  const horaFim = new Date(fimMs).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  return (
    <div role="timer" aria-live="off" className={`fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-20 border-t-2 px-4 py-3 ${resta === 0 ? "border-destaque bg-destaque text-fundo" : "border-linha bg-superficie"}`}>
      <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase">{resta === 0 ? "Descanso acabou" : "Descanso"}</p>
          <p className="text-3xl font-black tabular-nums">{formatarTempo(resta)}</p>
          <p className="text-xs opacity-70">termina às {horaFim}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={onMais} className="min-h-12 rounded-full border-2 border-current px-4 font-bold">
            +15 s
          </button>
          <button type="button" onClick={onPular} className="min-h-12 rounded-full border-2 border-current px-4 font-bold">
            {resta === 0 ? "Ok" : "Pular"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Contador com + e − (nada de campo numérico durante o treino) ───

function Contador({ rotulo, valor, passo, minimo, onChange, unidade }: { rotulo: string; valor: number; passo: number; minimo: number; onChange: (v: number) => void; unidade: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-suave">{rotulo}</p>
      <div className="flex items-center gap-2">
        <button type="button" aria-label={`Diminuir ${rotulo}`} onClick={() => onChange(Math.max(minimo, Math.round((valor - passo) * 100) / 100))} className="min-h-12 min-w-12 rounded-full border-2 border-linha text-xl font-bold">
          −
        </button>
        <span className="min-w-14 text-center text-xl font-black tabular-nums">
          {fmt(valor)}
          <span className="ml-0.5 text-xs font-medium text-suave">{unidade}</span>
        </span>
        <button type="button" aria-label={`Aumentar ${rotulo}`} onClick={() => onChange(Math.round((valor + passo) * 100) / 100)} className="min-h-12 min-w-12 rounded-full border-2 border-linha text-xl font-bold">
          +
        </button>
      </div>
    </div>
  );
}

// ─── Série ───

type EstadoSerie = { carga: number; alvo: number; feita: boolean; salvando: boolean; erro?: string };

function chave(exId: string, n: number) {
  return `${exId}:${n}`;
}

export function SessaoCliente({
  data,
  treinoId,
  itens,
  dicas,
  feitas,
  observacao,
}: {
  data: string;
  treinoId: string;
  itens: ItemTela[];
  dicas: Record<string, DicaTela | null>;
  feitas: Feita[];
  observacao: string;
}) {
  const { desbloquear, avisar } = useAviso();
  useTelaAcesa();

  const [escolha, setEscolha] = useState<Record<string, string>>(() => {
    // Se já há séries salvas de um substituto, ele continua escolhido.
    const e: Record<string, string> = {};
    for (const i of itens) {
      const salvo = i.opcoes.find((o) => feitas.some((f) => f.exercicioId === o.id));
      e[i.id] = (salvo ?? i.opcoes[0]).id;
    }
    return e;
  });
  const [series, setSeries] = useState<Record<string, EstadoSerie>>(() => {
    const s: Record<string, EstadoSerie> = {};
    for (const f of feitas) s[chave(f.exercicioId, f.numero)] = { carga: f.cargaKg, alvo: f.segundos ?? f.repeticoes ?? 0, feita: f.feito, salvando: false };
    return s;
  });
  const [fimMs, setFimMs] = useState<number | null>(null);
  const [fotoAberta, setFotoAberta] = useState<string | null>(null);
  const [estado, concluir] = useActionState<EstadoTreino, FormData>(concluirTreino, {});

  const aoAcabar = useCallback(() => avisar(), [avisar]);

  function valorInicial(item: ItemTela, op: OpcaoTela, n: number): EstadoSerie {
    const existente = series[chave(op.id, n)];
    if (existente) return existente;
    const ult = dicas[`${item.id}:${op.id}`]?.ultima ?? [];
    const base = ult.find((u) => u.numero === n) ?? ult.at(-1);
    return {
      carga: base?.cargaKg ?? 0,
      alvo: (op.porSegundos ? base?.segundos : base?.repeticoes) ?? item.repsMin,
      feita: false,
      salvando: false,
    };
  }

  function mudar(item: ItemTela, op: OpcaoTela, n: number, parcial: Partial<EstadoSerie>) {
    setSeries((s) => ({ ...s, [chave(op.id, n)]: { ...valorInicial(item, op, n), ...s[chave(op.id, n)], ...parcial } }));
  }

  async function marcarFeita(item: ItemTela, op: OpcaoTela, n: number) {
    desbloquear(); // dentro do toque: libera o som no iPhone
    const atual = { ...valorInicial(item, op, n), ...series[chave(op.id, n)] };
    mudar(item, op, n, { salvando: true, erro: undefined });
    const r = await salvarSerieDoDia({
      data,
      treinoId,
      exercicioId: op.id,
      numero: n,
      cargaKg: atual.carga,
      repeticoes: op.porSegundos ? null : atual.alvo,
      segundos: op.porSegundos ? atual.alvo : null,
      feito: true,
    });
    if (!r.ok) {
      mudar(item, op, n, { salvando: false, erro: r.erro ?? "Não foi possível salvar." });
      return;
    }
    mudar(item, op, n, { salvando: false, feita: true, erro: undefined });
    setFimMs(fimDoDescanso(Date.now(), item.descansoS));
  }

  async function desfazer(item: ItemTela, op: OpcaoTela, n: number) {
    const r = await apagarSerieDoDia(data, op.id, n);
    if (r.ok) mudar(item, op, n, { feita: false });
  }

  return (
    <div className="space-y-10 pb-28">
      {itens.map((item, idx) => {
        const op = item.opcoes.find((o) => o.id === escolha[item.id]) ?? item.opcoes[0];
        const dica = dicas[`${item.id}:${op.id}`];
        return (
          <section key={item.id} aria-labelledby={`ex-${item.id}`} className="space-y-4">
            <div>
              <p className="text-sm text-suave">
                {idx + 1} de {itens.length}
              </p>
              <h2 id={`ex-${item.id}`} className="text-2xl font-black leading-tight">{op.nome}</h2>
              <p className="text-suave">
                {item.series} × {item.repsMin === item.repsMax ? item.repsMin : `${item.repsMin}–${item.repsMax}`}
                {op.porSegundos ? " s" : ""} · descanso {formatarTempo(item.descansoS)}
              </p>
              <p className="mt-1 flex flex-wrap gap-2 text-xs font-bold">
                {op.unilateral ? <span className="rounded-full border border-linha px-2 py-0.5">cada lado</span> : null}
                {op.cargaPorHalter ? <span className="rounded-full border border-linha px-2 py-0.5">carga de cada halter</span> : null}
              </p>
              {item.observacao ? <p className="mt-1 text-sm text-suave">{item.observacao}</p> : null}
            </div>

            {item.opcoes.length > 1 ? (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Exercício feito">
                {item.opcoes.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={o.id === op.id}
                    onClick={() => setEscolha((e) => ({ ...e, [item.id]: o.id }))}
                    className={`min-h-11 rounded-full border-2 px-4 text-sm font-semibold ${o.id === op.id ? "border-destaque text-texto" : "border-linha text-suave"}`}
                  >
                    {o.principal ? o.nome : `Substituto: ${o.nome}`}
                  </button>
                ))}
              </div>
            ) : null}

            {op.fotoId ? (
              <div>
                <button type="button" onClick={() => setFotoAberta(fotoAberta === item.id ? null : item.id)} className="min-h-11 text-sm font-semibold text-suave underline">
                  {fotoAberta === item.id ? "Esconder fotos" : "Ver fotos"}
                </button>
                {fotoAberta === item.id ? <FotoExercicio fotoId={op.fotoId} nome={op.nome} /> : null}
              </div>
            ) : null}

            {dica ? (
              <div className="rounded-xl bg-superficie p-3 text-sm">
                <p className="font-semibold">Última vez</p>
                <p className="text-suave">
                  {dica.ultima.map((u) => `${fmt(u.cargaKg)} kg × ${u.segundos ?? u.repeticoes}${op.porSegundos ? " s" : ""}`).join(" · ")}
                </p>
                {dica.subirCarga ? <p className="mt-1 font-bold text-destaque">Você chegou ao topo da faixa em todas as séries. Que tal subir a carga?</p> : null}
              </div>
            ) : null}

            <ol className="space-y-3">
              {Array.from({ length: item.series }, (_, k) => k + 1).map((n) => {
                const s = { ...valorInicial(item, op, n), ...series[chave(op.id, n)] };
                return (
                  <li key={n} className={`rounded-2xl border-2 p-3 ${s.feita ? "border-destaque" : "border-linha"}`}>
                    <p className="mb-2 text-sm font-bold text-suave">Série {n}</p>
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <Contador rotulo="Carga" valor={s.carga} passo={PASSO_CARGA} minimo={0} unidade="kg" onChange={(v) => mudar(item, op, n, { carga: v })} />
                      <Contador
                        rotulo={op.porSegundos ? "Tempo" : "Repetições"}
                        valor={s.alvo}
                        passo={op.porSegundos ? 5 : 1}
                        minimo={0}
                        unidade={op.porSegundos ? "s" : ""}
                        onChange={(v) => mudar(item, op, n, { alvo: v })}
                      />
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={s.salvando}
                        onClick={() => void marcarFeita(item, op, n)}
                        className={`min-h-12 flex-1 rounded-full font-bold ${s.feita ? "border-2 border-destaque text-destaque" : "bg-destaque text-fundo"} disabled:opacity-60`}
                      >
                        {s.salvando ? "Salvando…" : s.feita ? "Feita ✓ (salvar de novo)" : "Feito"}
                      </button>
                      {s.feita ? (
                        <button type="button" onClick={() => void desfazer(item, op, n)} className="min-h-12 rounded-full border-2 border-linha px-4 text-sm font-semibold text-suave">
                          Desfazer
                        </button>
                      ) : null}
                    </div>
                    {s.erro ? <div className="mt-2"><Aviso>{s.erro}</Aviso></div> : null}
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <form action={concluir} className="space-y-4 border-t border-linha pt-8" noValidate>
        <input type="hidden" name="data" value={data} />
        <input type="hidden" name="treinoId" value={treinoId} />
        <Campo nome="observacao" rotulo="Observação do treino (opcional)" maxLength={500} valor={observacao} erro={estado.erros?.observacao} />
        {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
        <BotaoEnviar pendente="Salvando…">Concluir treino</BotaoEnviar>
      </form>

      {fimMs !== null ? (
        <Cronometro fimMs={fimMs} aoAcabar={aoAcabar} onMais={() => setFimMs((f) => adicionarSegundos(f ?? Date.now(), Date.now(), 15))} onPular={() => setFimMs(null)} />
      ) : null}
    </div>
  );
}
