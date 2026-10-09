"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Aviso, BotaoEnviar, BotaoSecundario } from "@/components/ui";
import { AVISO_NAO_ENVIADO } from "@/lib/ia/prompts";
import { COBERTURA_MINIMA, LIMITES_REFEICAO, montarEntradaRefeicao, ROTULOS_CONFIANCA, type EstimativaAlimento } from "@/lib/ia/refeicao";
import { buscar } from "../actions";
import {
  confirmarEstimativa,
  estimarAlimento,
  interpretarRefeicao,
  salvarRefeicaoIa,
  type EstadoEstimativa,
  type EstadoRefeicaoIa,
  type EstadoSalvar,
  type ItemRascunho,
} from "./actions";

type Cand = { tipo: "base" | "usuario"; id: string; nome: string; marca: string | null; kcal: number | null; cobertura?: number };
type ItemEditavel = Omit<ItemRascunho, "candidatos"> & { chave: number; candidatos: Cand[]; escolhido: Cand | null };

const passoDeGramas = (g: number) => (g < 60 ? 5 : g < 300 ? 10 : 25);
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const kcalDoItem = (i: ItemEditavel) => (i.escolhido?.kcal != null ? (i.escolhido.kcal * i.gramas) / 100 : null);

export function FluxoRefeicao(props: { data: string; refeicao: string; rotuloRefeicao: string; gratuito: boolean; restanteTexto: number; restanteEstimativa: number }) {
  const [itens, setItens] = useState<ItemEditavel[] | null>(null);
  const [descartados, setDescartados] = useState(0);
  if (itens) {
    return <Revisao {...props} itens={itens} setItens={setItens} descartados={descartados} aoVoltar={() => setItens(null)} />;
  }
  return (
    <Entrada
      {...props}
      aoInterpretar={(r) => {
        setDescartados(r.descartados ?? 0);
        setItens((r.itens ?? []).map((it, i) => ({ ...it, chave: i, candidatos: it.candidatos, escolhido: (it.candidatos[0]?.cobertura ?? 0) >= COBERTURA_MINIMA ? it.candidatos[0] : null })));
      }}
    />
  );
}

// ─── Passo 1: escrever e ver o que será enviado ───

function Entrada({ gratuito, restanteTexto, aoInterpretar }: { gratuito: boolean; restanteTexto: number; aoInterpretar: (r: EstadoRefeicaoIa) => void }) {
  const [texto, setTexto] = useState("");
  const [estado, acao] = useActionState<EstadoRefeicaoIa, FormData>(async (anterior, form) => {
    const r = await interpretarRefeicao(anterior, form);
    if (r.itens) aoInterpretar(r);
    return r;
  }, {});
  const entrada = montarEntradaRefeicao(texto);
  return (
    <form action={acao} className="space-y-6" noValidate>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-suave">O que você comeu?</span>
        <textarea
          name="texto"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={LIMITES_REFEICAO.textoMax}
          rows={4}
          placeholder="Ex.: 2 conchas de feijão, arroz e um filé de frango grelhado"
          className="w-full rounded-2xl border-2 border-borda bg-superficie p-4 text-lg outline-none placeholder:text-suave focus:border-marca"
        />
      </label>
      <section aria-labelledby="previa-ia" className="space-y-2 rounded-2xl border-2 border-borda p-4">
        <h2 id="previa-ia" className="text-lg font-bold">O que será enviado ao Google</h2>
        {entrada ? <p className="font-semibold">{entrada.linhas[0].valor}</p> : <p className="text-suave">Escreva o que você comeu para ver o que será enviado.</p>}
        <p className="text-sm text-suave">{AVISO_NAO_ENVIADO}</p>
        {gratuito ? <p className="text-sm text-suave">No plano gratuito, o Google pode usar o conteúdo para melhorar seus produtos. Não escreva dados pessoais.</p> : null}
      </section>
      <p className="text-sm text-suave">A IA só interpreta o texto. As calorias vêm da tabela de alimentos, e você confere tudo antes de salvar. Restam {restanteTexto} interpretações hoje.</p>
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.precisaAceite ? <Link href="/treino/ia" className="block font-semibold underline">Ler e aceitar o aviso da IA</Link> : null}
      <BotaoEnviar pendente="A IA está lendo…">Interpretar</BotaoEnviar>
    </form>
  );
}

// ─── Passo 2: conferir, ajustar e salvar ───

function Passo({ valor, onMenos, onMais, rotulo }: { valor: string; onMenos: () => void; onMais: () => void; rotulo: string }) {
  return (
    <span className="flex items-center gap-3">
      <button type="button" onClick={onMenos} aria-label={`Diminuir ${rotulo}`} className="size-12 rounded-full border-2 border-borda text-2xl font-bold">−</button>
      <span className="min-w-20 text-center text-lg font-bold">{valor}</span>
      <button type="button" onClick={onMais} aria-label={`Aumentar ${rotulo}`} className="size-12 rounded-full border-2 border-borda text-2xl font-bold">+</button>
    </span>
  );
}

function Revisao({ data, refeicao, rotuloRefeicao, restanteEstimativa, itens, setItens, descartados, aoVoltar }: {
  data: string; refeicao: string; rotuloRefeicao: string; restanteEstimativa: number;
  itens: ItemEditavel[]; setItens: (f: (l: ItemEditavel[] | null) => ItemEditavel[] | null) => void; descartados: number; aoVoltar: () => void;
}) {
  const [estado, acao] = useActionState<EstadoSalvar, FormData>(salvarRefeicaoIa, {});
  const mudar = (chave: number, parte: Partial<ItemEditavel>) => setItens((l) => (l ?? []).map((i) => (i.chave === chave ? { ...i, ...parte } : i)));
  const remover = (chave: number) => setItens((l) => (l ?? []).filter((i) => i.chave !== chave));
  const faltam = itens.filter((i) => !i.escolhido).length;
  const total = itens.reduce((s, i) => s + (kcalDoItem(i) ?? 0), 0);
  const parcial = itens.some((i) => i.escolhido && i.escolhido.kcal === null);
  const payload = JSON.stringify(itens.filter((i) => i.escolhido).map((i) => ({ tipo: i.escolhido!.tipo, alimentoId: i.escolhido!.id, gramas: i.gramas })));

  return (
    <form
      action={acao}
      className="space-y-8"
      noValidate
      onKeyDown={(ev) => {
        // Enter dentro de um campo não pode salvar a refeição por engano.
        if (ev.key === "Enter" && (ev.target as HTMLElement).tagName === "INPUT") ev.preventDefault();
      }}
    >
      <input type="hidden" name="data" value={data} />
      <input type="hidden" name="refeicao" value={refeicao} />
      <input type="hidden" name="itens" value={payload} />
      <p className="rounded-2xl border-2 border-aviso p-4 font-medium text-aviso">
        <span aria-hidden="true">! </span>As gramas são estimativas da IA. Confira cada item e ajuste conforme o que você realmente comeu.
      </p>
      {descartados > 0 ? <p className="text-sm text-suave">{descartados} {descartados === 1 ? "item fora do padrão foi ignorado" : "itens fora do padrão foram ignorados"}.</p> : null}

      <ol className="space-y-6">
        {itens.map((i) => (
          <li key={i.chave} className="space-y-4 rounded-2xl border-2 border-linha p-4">
            <div>
              <p className="text-lg font-bold">{i.quantidade ? `${i.quantidade.toLocaleString("pt-BR")} ${i.unidade ?? ""} · ` : ""}{i.nome}</p>
              <p className="text-sm text-suave">{ROTULOS_CONFIANCA[i.confianca]}</p>
            </div>
            <CampoAlimento item={i} restanteEstimativa={restanteEstimativa} data={data} refeicao={refeicao} aoEscolher={(c) => mudar(i.chave, { escolhido: c })} />
            <div className="flex items-center justify-between gap-3">
              <span className="text-suave">Quantidade</span>
              <Passo
                rotulo="gramas"
                valor={`${fmt(i.gramas)} g`}
                onMenos={() => mudar(i.chave, { gramas: Math.max(5, i.gramas - passoDeGramas(i.gramas)) })}
                onMais={() => mudar(i.chave, { gramas: Math.min(5000, i.gramas + passoDeGramas(i.gramas)) })}
              />
            </div>
            {kcalDoItem(i) !== null ? <p className="font-semibold">≈ {fmt(kcalDoItem(i)!)} kcal</p> : i.escolhido ? <p className="text-suave">Sem calorias na tabela.</p> : null}
            <BotaoSecundario onClick={() => remover(i.chave)}>Remover item</BotaoSecundario>
          </li>
        ))}
      </ol>

      {itens.length > 0 ? (
        <p className="text-xl font-black">Total ≈ {fmt(total)} kcal{parcial ? " (parcial)" : ""}</p>
      ) : (
        <p className="text-suave">Nenhum item. Volte e escreva de novo.</p>
      )}
      {faltam > 0 ? <p role="status" className="font-medium text-aviso"><span aria-hidden="true">! </span>{faltam} {faltam === 1 ? "item ainda precisa" : "itens ainda precisam"} de um alimento (escolha na busca, peça uma estimativa ou remova).</p> : null}
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      <SalvarBotao desabilitado={itens.length === 0 || faltam > 0} rotulo={`Salvar no ${rotuloRefeicao.toLowerCase()}`} />
      <BotaoSecundario onClick={aoVoltar}>Voltar e escrever de novo</BotaoSecundario>
    </form>
  );
}

function SalvarBotao({ desabilitado, rotulo }: { desabilitado: boolean; rotulo: string }) {
  return (
    <button type="submit" disabled={desabilitado} className="min-h-14 w-full rounded-full bg-destaque px-6 text-lg font-bold text-sobre-destaque disabled:opacity-50">
      {rotulo}
    </button>
  );
}

// ─── Escolha do alimento de um item: trocar, estimar ou cadastrar ───

function CampoAlimento({ item, restanteEstimativa, data, refeicao, aoEscolher }: { item: ItemEditavel; restanteEstimativa: number; data: string; refeicao: string; aoEscolher: (c: Cand | null) => void }) {
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState(item.nome);
  const [lista, setLista] = useState<Cand[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [buscando, iniciar] = useTransition();
  const [estimando, setEstimando] = useState(false);

  function procurar() {
    setErro(null);
    iniciar(async () => {
      const r = await buscar(termo);
      if (r.erro) setErro(r.erro);
      setLista(r.resultados.map((a) => ({ tipo: a.tipo, id: a.id, nome: a.nome, marca: a.marca, kcal: a.kcal })));
    });
  }

  return (
    <div className="space-y-3">
      {item.escolhido ? (
        <p className="text-lg"><span className="text-suave">Alimento: </span><strong>{item.escolhido.nome}{item.escolhido.marca ? ` (${item.escolhido.marca})` : ""}</strong>{item.escolhido.kcal !== null ? <span className="text-suave"> · {fmt(item.escolhido.kcal)} kcal por 100 g</span> : null}</p>
      ) : (
        <p className="font-medium text-aviso"><span aria-hidden="true">! </span>{item.candidatos.length > 0 ? "Não tenho certeza de qual alimento é. Escolha uma opção abaixo ou busque." : "Não encontrei esse alimento na tabela."}</p>
      )}
      {item.escolhido && (item.escolhido.cobertura ?? 1) < 1 ? <p className="text-sm font-medium text-aviso"><span aria-hidden="true">! </span>O nome não tem todas as palavras do que você disse. Confira se é o alimento certo.</p> : null}

      {item.candidatos.length > 0 && item.candidatos.some((c) => c.id !== item.escolhido?.id) ? (
        <ul className="flex flex-wrap gap-2" aria-label="Outras opções">
          {item.candidatos.filter((c) => c.id !== item.escolhido?.id).slice(0, 4).map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => aoEscolher(c)} className="min-h-11 rounded-full border-2 border-borda px-4 text-left text-sm font-semibold active:border-marca">{c.nome}</button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <BotaoSecundario onClick={() => setAberto((a) => !a)}>{aberto ? "Fechar busca" : item.escolhido ? "Trocar alimento" : "Buscar alimento"}</BotaoSecundario>
        {!item.escolhido ? <BotaoSecundario onClick={() => setEstimando((e) => !e)}>{estimando ? "Fechar estimativa" : "Pedir estimativa da IA"}</BotaoSecundario> : null}
      </div>

      {aberto ? (
        <div className="space-y-3 rounded-2xl border-2 border-borda p-3">
          <div className="flex gap-2">
            <input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); procurar(); } }}
              maxLength={60}
              aria-label="Buscar alimento"
              className="min-h-12 min-w-0 flex-1 border-b-2 border-borda bg-transparent text-lg outline-none focus:border-marca"
            />
            <BotaoSecundario onClick={procurar}>{buscando ? "Buscando…" : "Buscar"}</BotaoSecundario>
          </div>
          {erro ? <Aviso>{erro}</Aviso> : null}
          {lista && lista.length === 0 ? <p className="text-suave">Nada encontrado.</p> : null}
          <ul className="space-y-2">
            {(lista ?? []).slice(0, 8).map((c) => (
              <li key={`${c.tipo}-${c.id}`}>
                <button type="button" onClick={() => { aoEscolher(c); setAberto(false); }} className="min-h-12 w-full rounded-2xl border-2 border-borda p-3 text-left active:border-marca">
                  <span className="font-semibold">{c.nome}</span>{c.marca ? <span className="text-suave"> · {c.marca}</span> : null}{c.kcal !== null ? <span className="text-suave"> · {fmt(c.kcal)} kcal</span> : null}
                </button>
              </li>
            ))}
          </ul>
          <Link href={`/comida/meus-alimentos/novo?data=${data}&refeicao=${refeicao}`} className="block text-sm font-semibold underline">Cadastrar pelo rótulo</Link>
        </div>
      ) : null}

      {estimando && !item.escolhido ? <PainelEstimativa nome={item.nome} restante={restanteEstimativa} aoConfirmar={(c) => { aoEscolher(c); setEstimando(false); }} /> : null}
    </div>
  );
}

// ─── Estimativa da IA para um alimento fora do banco (só quando o usuário pede) ───

type Campos = { kcal: string; proteinaG: string; carboG: string; gorduraG: string; fibraG: string; sodioMg: string };
const num = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};
const texto = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));

function PainelEstimativa({ nome, restante, aoConfirmar }: { nome: string; restante: number; aoConfirmar: (c: Cand) => void }) {
  // Sem <form> aqui: este painel fica dentro do formulário de salvar, e formulário dentro de formulário é inválido.
  const [estado, setEstado] = useState<EstadoEstimativa>({});
  const [pendente, iniciar] = useTransition();
  function pedir() {
    const fd = new FormData();
    fd.set("nome", nome);
    iniciar(async () => setEstado(await estimarAlimento({}, fd)));
  }
  const e: EstimativaAlimento | undefined = estado.estimativa;
  return (
    <div className="space-y-3 rounded-2xl border-2 border-borda p-3">
      {!e ? (
        <div className="space-y-3">
          <p className="text-sm text-suave">A IA estima os nutrientes de &quot;{nome}&quot; por 100 g. É só uma estimativa: você confere antes de usar. Restam {restante} estimativas hoje.</p>
          {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
          <button type="button" onClick={pedir} disabled={pendente} className="min-h-12 w-full rounded-full bg-destaque px-6 font-bold text-sobre-destaque disabled:opacity-60">
            {pendente ? "A IA está estimando…" : "Pedir estimativa"}
          </button>
        </div>
      ) : (
        <ConferirEstimativa estimativa={e} aoConfirmar={aoConfirmar} />
      )}
    </div>
  );
}

function ConferirEstimativa({ estimativa, aoConfirmar }: { estimativa: EstimativaAlimento; aoConfirmar: (c: Cand) => void }) {
  const n = estimativa.nutrientes;
  const [nome, setNome] = useState(estimativa.nome);
  const [v, setV] = useState<Campos>({ kcal: texto(n.kcal), proteinaG: texto(n.proteinaG), carboG: texto(n.carboG), gorduraG: texto(n.gorduraG), fibraG: texto(n.fibraG), sodioMg: texto(n.sodioMg) });
  const [confirmou, setConfirmou] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const rotulos: Array<[keyof Campos, string, string]> = [["kcal", "Calorias", "kcal"], ["proteinaG", "Proteína", "g"], ["carboG", "Carboidrato", "g"], ["gorduraG", "Gordura", "g"], ["fibraG", "Fibra", "g"], ["sodioMg", "Sódio", "mg"]];

  function confirmar() {
    setErro(null);
    const kcal = num(v.kcal);
    if (kcal === null) return setErro("Informe as calorias.");
    iniciar(async () => {
      const r = await confirmarEstimativa({ nome, kcal, proteinaG: num(v.proteinaG), carboG: num(v.carboG), gorduraG: num(v.gorduraG), fibraG: num(v.fibraG), sodioMg: num(v.sodioMg), medidas: estimativa.medidas, confirmarDivergencia: confirmou });
      if (r.candidato) aoConfirmar(r.candidato);
      else setErro(r.erro ?? "Não foi possível confirmar.");
    });
  }

  return (
    <div className="space-y-3">
      <p className="rounded-2xl border-2 border-aviso p-3 font-medium text-aviso"><span aria-hidden="true">! </span>Estimativa da IA, por 100 g. Confira e ajuste os números antes de usar.</p>
      <label className="block"><span className="mb-1 block text-sm text-suave">Nome</span>
        <input value={nome} onChange={(ev) => setNome(ev.target.value)} maxLength={120} className="min-h-12 w-full border-b-2 border-borda bg-transparent text-lg font-semibold outline-none focus:border-marca" />
      </label>
      <div className="grid grid-cols-2 gap-4">
        {rotulos.map(([k, rotulo, un]) => (
          <label key={k} className="block"><span className="mb-1 block text-sm text-suave">{rotulo} ({un})</span>
            <input value={v[k]} onChange={(ev) => setV((a) => ({ ...a, [k]: ev.target.value }))} inputMode="decimal" maxLength={7} className="min-h-12 w-full border-b-2 border-borda bg-transparent text-lg font-semibold outline-none focus:border-marca" />
          </label>
        ))}
      </div>
      {estimativa.medidas.length > 0 ? <p className="text-sm text-suave">Medidas sugeridas: {estimativa.medidas.map((m) => `${m.nome} = ${fmt(m.gramas)} g`).join("; ")}.</p> : null}
      {estimativa.inconsistente ? (
        <label className="flex min-h-12 items-start gap-3">
          <input type="checkbox" checked={confirmou} onChange={(ev) => setConfirmou(ev.target.checked)} className="mt-1 size-6 shrink-0 accent-[var(--color-destaque)]" />
          <span>As calorias não batem com os macros. Mesmo assim, confirmo que os valores estão corretos.</span>
        </label>
      ) : null}
      {erro ? <Aviso>{erro}</Aviso> : null}
      <button type="button" onClick={confirmar} disabled={pendente} className="min-h-12 w-full rounded-full bg-destaque px-6 font-bold text-sobre-destaque disabled:opacity-60">
        {pendente ? "Salvando…" : "Confirmar e usar este alimento"}
      </button>
    </div>
  );
}
