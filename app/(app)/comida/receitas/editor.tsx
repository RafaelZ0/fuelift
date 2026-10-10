"use client";

import Link from "next/link";
import { useActionState, useState, useTransition } from "react";
import { Aviso, BotaoEnviar, BotaoSecundario } from "@/components/ui";
import { buscar } from "../actions";
import { interpretarRefeicao, type EstadoRefeicaoIa } from "../ia/actions";
import { salvarReceita, type EstadoReceita } from "./actions";

export type IngredienteEditavel = { chave: number; tipo: "base" | "usuario"; id: string; nome: string; gramas: number; kcal100: number | null };
type Resultado = { tipo: "base" | "usuario"; id: string; nome: string; marca: string | null; kcal: number | null };

const passo = (g: number) => (g < 60 ? 5 : g < 300 ? 10 : 25);
const fmt = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
const dec = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function Passo({ valor, onMenos, onMais, rotulo }: { valor: string; onMenos: () => void; onMais: () => void; rotulo: string }) {
  return (
    <span className="flex items-center gap-3">
      <button type="button" onClick={onMenos} aria-label={`Diminuir ${rotulo}`} className="size-12 rounded-full border-2 border-borda text-2xl font-bold">−</button>
      <span className="min-w-20 text-center text-lg font-bold">{valor}</span>
      <button type="button" onClick={onMais} aria-label={`Aumentar ${rotulo}`} className="size-12 rounded-full border-2 border-borda text-2xl font-bold">+</button>
    </span>
  );
}

export function EditorReceita({
  receitaId,
  nomeInicial,
  porcoesInicial,
  pesoFinalInicial,
  itensIniciais,
  iaDisponivel,
}: {
  receitaId?: string;
  nomeInicial: string;
  porcoesInicial: number;
  pesoFinalInicial: string;
  itensIniciais: IngredienteEditavel[];
  iaDisponivel: boolean;
}) {
  const [estado, acao] = useActionState<EstadoReceita, FormData>(salvarReceita, {});
  const [nome, setNome] = useState(nomeInicial);
  const [porcoes, setPorcoes] = useState(porcoesInicial);
  const [pesoFinal, setPesoFinal] = useState(pesoFinalInicial);
  const [itens, setItens] = useState<IngredienteEditavel[]>(itensIniciais);
  const [proxima, setProxima] = useState(itensIniciais.length);

  // Busca para adicionar ingrediente
  const [termo, setTermo] = useState("");
  const [lista, setLista] = useState<Resultado[] | null>(null);
  const [erroBusca, setErroBusca] = useState<string | null>(null);
  const [buscando, iniciarBusca] = useTransition();

  // Preencher com a IA
  const [textoIa, setTextoIa] = useState("");
  const [avisoIa, setAvisoIa] = useState<string | null>(null);
  const [pensando, iniciarIa] = useTransition();

  const adicionar = (r: { tipo: "base" | "usuario"; id: string; nome: string; kcal: number | null }, gramas = 100) => {
    setItens((l) => [...l, { chave: proxima + l.length + Math.random(), tipo: r.tipo, id: r.id, nome: r.nome, gramas, kcal100: r.kcal }]);
    setProxima((p) => p + 1);
  };
  const mudarGramas = (chave: number, g: number) => setItens((l) => l.map((i) => (i.chave === chave ? { ...i, gramas: Math.min(10000, Math.max(5, g)) } : i)));

  function procurar() {
    setErroBusca(null);
    iniciarBusca(async () => {
      const r = await buscar(termo);
      if (r.erro) setErroBusca(r.erro);
      setLista(r.resultados.map((a) => ({ tipo: a.tipo, id: a.id, nome: a.nome, marca: a.marca, kcal: a.kcal })));
    });
  }

  function preencherComIa() {
    setAvisoIa(null);
    iniciarIa(async () => {
      const fd = new FormData();
      fd.set("texto", textoIa);
      const r: EstadoRefeicaoIa = await interpretarRefeicao({}, fd);
      if (r.erro) return setAvisoIa(r.erro);
      const faltou: string[] = [];
      for (const it of r.itens ?? []) {
        const c = it.candidatos[0];
        if (c && c.cobertura >= 0.5 && c.kcal !== null) adicionar(c, Math.max(5, Math.round(it.gramas)));
        else faltou.push(`${it.nome} (${Math.round(it.gramas)} g)`);
      }
      setAvisoIa(
        `Ingredientes adicionados com gramas estimadas pela IA: confira cada um.${faltou.length ? ` Não achei na tabela: ${faltou.join("; ")}. Adicione pela busca.` : ""}`,
      );
    });
  }

  const totalKcal = itens.reduce((s, i) => s + (i.kcal100 !== null ? (i.kcal100 * i.gramas) / 100 : 0), 0);
  const somaGramas = itens.reduce((s, i) => s + i.gramas, 0);
  const pesoNum = pesoFinal.trim() === "" ? null : Number(pesoFinal.replace(",", "."));
  const pesoValido = pesoNum === null || (Number.isFinite(pesoNum) && pesoNum >= 1);
  const payload = JSON.stringify({
    nome,
    porcoes,
    pesoFinalG: pesoValido ? pesoNum : null,
    itens: itens.map((i) => ({ tipo: i.tipo, alimentoId: i.id, gramas: i.gramas })),
  });

  return (
    <form
      action={acao}
      className="space-y-10"
      noValidate
      onKeyDown={(ev) => {
        if (ev.key === "Enter" && (ev.target as HTMLElement).tagName === "INPUT") ev.preventDefault(); // Enter não salva por engano
      }}
    >
      <input type="hidden" name="receita" value={payload} />
      {receitaId ? <input type="hidden" name="receitaId" value={receitaId} /> : null}

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-suave">Nome da receita</span>
        <input value={nome} onChange={(e) => setNome(e.target.value)} maxLength={120} className="min-h-12 w-full border-b-2 border-borda bg-transparent py-2 text-xl font-semibold outline-none focus:border-marca" />
      </label>

      <div className="flex items-center justify-between gap-3">
        <span className="text-suave">Rende (porções)</span>
        <Passo rotulo="porções" valor={dec(porcoes)} onMenos={() => setPorcoes((p) => Math.max(0.5, p - 0.5))} onMais={() => setPorcoes((p) => Math.min(200, p + 0.5))} />
      </div>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-suave">Peso final da receita pronta, em gramas (opcional)</span>
        <input
          value={pesoFinal}
          onChange={(e) => setPesoFinal(e.target.value.replace(/[^\d.,]/g, "").slice(0, 7))}
          inputMode="decimal"
          placeholder={`Se vazio, soma dos ingredientes (${fmt(somaGramas)} g)`}
          className="min-h-12 w-full border-b-2 border-borda bg-transparent py-2 text-lg outline-none placeholder:text-suave focus:border-marca"
        />
        <span className="mt-1 block text-sm text-suave">Pese a receita pronta se quiser mais precisão: alimentos perdem ou ganham água ao cozinhar.</span>
      </label>

      <section aria-labelledby="ingredientes" className="space-y-5">
        <h2 id="ingredientes" className="text-2xl font-bold">Ingredientes</h2>
        {itens.length === 0 ? <p className="text-suave">Nenhum ingrediente ainda. Busque abaixo{iaDisponivel ? " ou cole a lista para a IA preencher" : ""}.</p> : null}
        <ol className="space-y-4">
          {itens.map((i) => (
            <li key={i.chave} className="space-y-3 rounded-2xl border-2 border-linha p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-lg font-bold">{i.nome}</p>
                <button type="button" onClick={() => setItens((l) => l.filter((x) => x.chave !== i.chave))} className="min-h-11 shrink-0 px-2 font-semibold text-suave underline">Remover</button>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-suave">{i.kcal100 !== null ? `≈ ${fmt((i.kcal100 * i.gramas) / 100)} kcal` : "sem calorias"}</span>
                <Passo rotulo="gramas" valor={`${fmt(i.gramas)} g`} onMenos={() => mudarGramas(i.chave, i.gramas - passo(i.gramas))} onMais={() => mudarGramas(i.chave, i.gramas + passo(i.gramas))} />
              </div>
            </li>
          ))}
        </ol>

        <div className="space-y-3 rounded-2xl border-2 border-borda p-3">
          <div className="flex gap-2">
            <input
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); procurar(); } }}
              maxLength={60}
              placeholder="Buscar ingrediente"
              aria-label="Buscar ingrediente"
              className="min-h-12 min-w-0 flex-1 border-b-2 border-borda bg-transparent text-lg outline-none placeholder:text-suave focus:border-marca"
            />
            <BotaoSecundario onClick={procurar}>{buscando ? "Buscando…" : "Buscar"}</BotaoSecundario>
          </div>
          {erroBusca ? <Aviso>{erroBusca}</Aviso> : null}
          {lista && lista.length === 0 ? <p className="text-suave">Nada encontrado.</p> : null}
          <ul className="space-y-2">
            {(lista ?? []).slice(0, 8).map((r) => (
              <li key={`${r.tipo}-${r.id}`}>
                <button
                  type="button"
                  disabled={r.kcal === null}
                  onClick={() => { adicionar(r); setLista(null); setTermo(""); }}
                  className="min-h-12 w-full rounded-2xl border-2 border-borda p-3 text-left disabled:opacity-50 active:border-marca"
                >
                  <span className="font-semibold">{r.nome}</span>
                  {r.marca ? <span className="text-suave"> · {r.marca}</span> : null}
                  <span className="text-suave">{r.kcal !== null ? ` · ${fmt(r.kcal)} kcal por 100 g` : " · sem calorias (não dá para usar)"}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        {iaDisponivel ? (
          <div className="space-y-3 rounded-2xl border-2 border-borda p-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-suave">Ou cole a lista e a IA preenche (estimativa)</span>
              <textarea
                value={textoIa}
                onChange={(e) => setTextoIa(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Ex.: 3 ovos, 2 xícaras de farinha de trigo, 1 xícara de açúcar, 1 colher de fermento"
                className="w-full rounded-2xl border-2 border-borda bg-superficie p-3 text-lg outline-none placeholder:text-suave focus:border-marca"
              />
            </label>
            <p className="text-xs text-suave">O texto é enviado ao Google (Gemini). As gramas são estimativas: confira cada ingrediente.</p>
            <BotaoSecundario onClick={preencherComIa}>{pensando ? "A IA está lendo…" : "Preencher com a IA"}</BotaoSecundario>
            {avisoIa ? <p role="status" className="text-sm font-medium text-aviso"><span aria-hidden="true">! </span>{avisoIa}</p> : null}
          </div>
        ) : (
          <p className="text-sm text-suave">Para preencher com a IA, aceite o aviso em <Link href="/treino/ia" className="underline">Treino com IA</Link>.</p>
        )}
      </section>

      <section aria-labelledby="resumo-r" className="space-y-2 rounded-2xl bg-superficie p-4">
        <h2 id="resumo-r" className="text-lg font-bold">Total da receita (estimativa)</h2>
        <p className="text-3xl font-black">≈ {fmt(totalKcal)} kcal</p>
        <p className="text-suave">≈ {fmt(totalKcal / porcoes)} kcal por porção · {fmt((pesoNum && pesoValido ? pesoNum : somaGramas) / porcoes)} g cada</p>
        <p className="text-xs text-suave">Proteína, carboidrato e gordura são calculados ao salvar, com a tabela.</p>
      </section>

      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      <BotaoEnviar>{receitaId ? "Salvar alterações" : "Salvar receita"}</BotaoEnviar>
    </form>
  );
}
