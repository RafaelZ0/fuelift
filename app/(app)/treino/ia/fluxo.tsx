"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Aviso, BotaoEnviar } from "@/components/ui";
import { LIMITES_ARQUIVO } from "@/lib/ia/config";
import {
  AVISO_NAO_ENVIADO,
  EQUIPAMENTOS,
  montarEntradaImportacao,
  montarEntradaPlano,
  NIVEIS,
  OBJETIVOS,
  pedidoPlanoSchema,
  type CorpoPerfil,
  type EntradaIa,
} from "@/lib/ia/prompts";
import { gerarImagemSemMetadados } from "./imagem";
import { gerarPlanoComIa, importarTreinoComIa, type EstadoIa } from "./actions";
import { EditorRascunho } from "./editor";

type Aba = "criar" | "importar";

function Chip({ ativo, onClick, children, radio = true }: { ativo: boolean; onClick: () => void; children: React.ReactNode; radio?: boolean }) {
  return (
    <button
      type="button"
      role={radio ? "radio" : "checkbox"}
      aria-checked={ativo}
      onClick={onClick}
      className={`min-h-12 rounded-full border-2 px-4 font-semibold ${ativo ? "border-marca text-texto" : "border-borda text-suave"}`}
    >
      {ativo ? <span aria-hidden="true">✓ </span> : null}
      {children}
    </button>
  );
}

function Previa({ entrada }: { entrada: EntradaIa | null }) {
  return (
    <section aria-labelledby="previa" className="space-y-2 rounded-2xl border-2 border-borda p-4">
      <h2 id="previa" className="text-lg font-bold">O que será enviado ao Google</h2>
      {entrada ? (
        <dl className="space-y-1">
          {entrada.linhas.map((l, i) => (
            <div key={`${l.rotulo}-${i}`} className="flex justify-between gap-4">
              <dt className="text-suave">{l.rotulo}</dt>
              <dd className="text-right font-semibold">{l.valor}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-suave">Preencha o pedido para ver o que será enviado.</p>
      )}
      <p className="text-sm text-suave">{AVISO_NAO_ENVIADO}</p>
    </section>
  );
}

export function FluxoIa({ corpo, restantePlano, restanteImportacao }: { corpo: CorpoPerfil; restantePlano: number; restanteImportacao: number }) {
  const [aba, setAba] = useState<Aba>("criar");
  const [rascunho, setRascunho] = useState<EstadoIa | null>(null);

  if (rascunho?.rascunho) {
    return <EditorRascunho inicial={rascunho.rascunho} descartados={rascunho.descartados ?? 0} onCancelar={() => setRascunho(null)} />;
  }
  return (
    <div className="space-y-8">
      <div role="tablist" aria-label="O que você quer fazer" className="flex gap-2">
        {(["criar", "importar"] as const).map((a) => (
          <button
            key={a}
            type="button"
            role="tab"
            aria-selected={aba === a}
            onClick={() => setAba(a)}
            className={`min-h-12 flex-1 rounded-full border-2 font-semibold ${aba === a ? "border-marca text-texto" : "border-borda text-suave"}`}
          >
            {a === "criar" ? "Criar plano" : "Importar"}
          </button>
        ))}
      </div>
      {aba === "criar" ? (
        <FormCriar corpo={corpo} restante={restantePlano} aoGerar={setRascunho} />
      ) : (
        <FormImportar restante={restanteImportacao} aoGerar={setRascunho} />
      )}
    </div>
  );
}

// ─── Criar plano com a IA ───

function FormCriar({ corpo, restante, aoGerar }: { corpo: CorpoPerfil; restante: number; aoGerar: (e: EstadoIa) => void }) {
  const [objetivo, setObjetivo] = useState("");
  const [nivel, setNivel] = useState("");
  const [dias, setDias] = useState(3);
  const [minutos, setMinutos] = useState(60);
  const [equip, setEquip] = useState<string[]>(["academia"]);
  const [limitacoes, setLimitacoes] = useState("");
  const [corpoMarcado, setCorpoMarcado] = useState({ sexo: false, idade: false, altura: false, peso: false });

  const [estado, acao] = useActionState<EstadoIa, FormData>(async (anterior, form) => {
    const r = await gerarPlanoComIa(anterior, form);
    if (r.rascunho) aoGerar(r);
    return r;
  }, {});

  const parsed = pedidoPlanoSchema.safeParse({
    objetivo, nivel, dias, minutos, equipamentos: equip, limitacoes,
    enviarSexo: corpoMarcado.sexo, enviarIdade: corpoMarcado.idade, enviarAltura: corpoMarcado.altura, enviarPeso: corpoMarcado.peso,
  });
  const entrada = parsed.success ? montarEntradaPlano(parsed.data, corpo) : null;
  const e = estado.erros ?? {};
  const alternar = (c: string) => setEquip((l) => (l.includes(c) ? l.filter((x) => x !== c) : [...l, c]));
  const dadosCorpo: Array<[keyof typeof corpoMarcado, string, string | null]> = [
    ["sexo", "Sexo", corpo.sexo],
    ["idade", "Idade", corpo.idadeAnos !== null ? `${corpo.idadeAnos} anos` : null],
    ["altura", "Altura", corpo.alturaCm !== null ? `${corpo.alturaCm} cm` : null],
    ["peso", "Peso", corpo.pesoKg !== null ? `${corpo.pesoKg} kg` : null],
  ];

  return (
    <form action={acao} className="space-y-8" noValidate>
      <input type="hidden" name="objetivo" value={objetivo} />
      <input type="hidden" name="nivel" value={nivel} />
      <input type="hidden" name="dias" value={dias} />
      <input type="hidden" name="minutos" value={minutos} />
      {equip.map((c) => <input key={c} type="hidden" name="equipamentos" value={c} />)}
      {corpoMarcado.sexo ? <input type="hidden" name="enviarSexo" value="on" /> : null}
      {corpoMarcado.idade ? <input type="hidden" name="enviarIdade" value="on" /> : null}
      {corpoMarcado.altura ? <input type="hidden" name="enviarAltura" value="on" /> : null}
      {corpoMarcado.peso ? <input type="hidden" name="enviarPeso" value="on" /> : null}

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium text-suave">Objetivo</legend>
        <div role="radiogroup" aria-label="Objetivo" className="flex flex-wrap gap-2">
          {Object.entries(OBJETIVOS).map(([k, v]) => <Chip key={k} ativo={objetivo === k} onClick={() => setObjetivo(k)}>{v}</Chip>)}
        </div>
        {e.objetivo ? <Aviso>{e.objetivo}</Aviso> : null}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium text-suave">Nível</legend>
        <div role="radiogroup" aria-label="Nível" className="flex flex-wrap gap-2">
          {Object.entries(NIVEIS).map(([k, v]) => <Chip key={k} ativo={nivel === k} onClick={() => setNivel(k)}>{v}</Chip>)}
        </div>
        {e.nivel ? <Aviso>{e.nivel}</Aviso> : null}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium text-suave">Dias de treino por semana</legend>
        <div role="radiogroup" aria-label="Dias por semana" className="flex flex-wrap gap-2">
          {[2, 3, 4, 5, 6].map((n) => <Chip key={n} ativo={dias === n} onClick={() => setDias(n)}>{n}</Chip>)}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium text-suave">Tempo por treino</legend>
        <div role="radiogroup" aria-label="Minutos por treino" className="flex flex-wrap gap-2">
          {[30, 45, 60, 75, 90].map((n) => <Chip key={n} ativo={minutos === n} onClick={() => setMinutos(n)}>{n} min</Chip>)}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="mb-2 text-sm font-medium text-suave">Equipamento disponível</legend>
        <div role="group" aria-label="Equipamento" className="flex flex-wrap gap-2">
          {Object.entries(EQUIPAMENTOS).map(([k, v]) => <Chip key={k} radio={false} ativo={equip.includes(k)} onClick={() => alternar(k)}>{v}</Chip>)}
        </div>
        {e.equipamentos ? <Aviso>{e.equipamentos}</Aviso> : null}
      </fieldset>

      <label className="block">
        <span className="mb-2 block text-sm font-medium text-suave">Limitações ou lesões (opcional)</span>
        <textarea
          name="limitacoes"
          value={limitacoes}
          onChange={(ev) => setLimitacoes(ev.target.value)}
          maxLength={300}
          rows={3}
          className="w-full rounded-2xl border-2 border-borda bg-superficie p-4 text-lg outline-none focus:border-marca"
        />
        {e.limitacoes ? <Aviso>{e.limitacoes}</Aviso> : null}
      </label>

      <fieldset className="space-y-3">
        <legend className="mb-1 text-sm font-medium text-suave">Enviar dados do meu corpo? (opcional, ajuda a IA)</legend>
        <div className="flex flex-wrap gap-2">
          {dadosCorpo.map(([k, rotulo, valor]) =>
            valor === null ? null : (
              <Chip key={k} radio={false} ativo={corpoMarcado[k]} onClick={() => setCorpoMarcado((m) => ({ ...m, [k]: !m[k] }))}>
                {rotulo}: {valor}
              </Chip>
            ),
          )}
        </div>
      </fieldset>

      <Previa entrada={entrada} />
      <p className="text-sm text-suave">Restam {restante} gerações hoje.</p>
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      <BotaoEnviar pendente="A IA está montando…">Montar rascunho</BotaoEnviar>
    </form>
  );
}

// ─── Importar de imagem ou PDF ───

type ArquivoPronto = { nome: string; bytes: number; arquivo: File };

function FormImportar({ restante, aoGerar }: { restante: number; aoGerar: (e: EstadoIa) => void }) {
  const [arquivos, setArquivos] = useState<ArquivoPronto[]>([]);
  const [nota, setNota] = useState("");
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const entradaRef = useRef<HTMLInputElement>(null);

  const [estado, acao] = useActionState<EstadoIa, FormData>(async (anterior, form) => {
    const r = await importarTreinoComIa(anterior, form);
    if (r.rascunho) aoGerar(r);
    return r;
  }, {});

  async function escolher(lista: FileList | null) {
    setErroLocal(null);
    if (!lista || lista.length === 0) return;
    if (lista.length > LIMITES_ARQUIVO.quantidade) return setErroLocal(`Escolha no máximo ${LIMITES_ARQUIVO.quantidade} arquivos.`);
    setProcessando(true);
    try {
      const prontos: ArquivoPronto[] = [];
      for (const f of Array.from(lista)) {
        // Imagens são refeitas no navegador (JPEG reduzido): isso remove localização e outros metadados da foto.
        const final = f.type === "application/pdf" ? f : await gerarImagemSemMetadados(f);
        if (final.size > LIMITES_ARQUIVO.bytesPorArquivo) throw new Error("Cada arquivo pode ter no máximo 4 MB.");
        prontos.push({ nome: f.name, bytes: final.size, arquivo: final });
      }
      if (prontos.reduce((s, p) => s + p.bytes, 0) > LIMITES_ARQUIVO.bytesTotal) throw new Error("Os arquivos juntos passam de 6 MB.");
      setArquivos(prontos);
    } catch (err) {
      setArquivos([]);
      setErroLocal(err instanceof Error ? err.message : "Não consegui ler esse arquivo. Use imagem (JPEG, PNG, WebP) ou PDF.");
    } finally {
      setProcessando(false);
    }
  }

  const entrada = arquivos.length ? montarEntradaImportacao(arquivos.map((a) => ({ nome: a.nome, tipo: a.arquivo.type, bytes: a.bytes })), nota) : null;

  function enviar(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const fd = new FormData();
    fd.set("nota", nota);
    for (const a of arquivos) fd.append("arquivos", a.arquivo, a.nome);
    iniciar(() => acao(fd));
  }

  return (
    <form onSubmit={enviar} className="space-y-8" noValidate>
      <p className="text-lg text-suave">Envie prints, fotos ou PDF do seu treino. A IA monta um rascunho e você confere antes de salvar.</p>
      <div className="space-y-3">
        <input
          ref={entradaRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          multiple
          className="sr-only"
          id="arquivos"
          onChange={(ev) => void escolher(ev.target.files)}
        />
        <label htmlFor="arquivos" className="flex min-h-14 cursor-pointer items-center justify-center rounded-full border-2 border-borda text-lg font-semibold">
          {arquivos.length ? "Trocar arquivos" : "Escolher imagens ou PDF"}
        </label>
        <p className="text-sm text-suave">Até {LIMITES_ARQUIVO.quantidade} arquivos, 4 MB cada. Não envie documentos com nome, CPF ou exames.</p>
        {processando ? <p role="status" className="text-suave">Preparando as imagens…</p> : null}
      </div>
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-suave">Observação (opcional)</span>
        <input
          value={nota}
          onChange={(ev) => setNota(ev.target.value)}
          maxLength={300}
          className="min-h-12 w-full border-b-2 border-borda bg-transparent py-2 text-lg outline-none focus:border-marca"
        />
      </label>
      <Previa entrada={entrada} />
      <p className="text-sm text-suave">Restam {restante} importações hoje.</p>
      {erroLocal ? <Aviso>{erroLocal}</Aviso> : null}
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      <button
        type="submit"
        disabled={pendente || processando || arquivos.length === 0}
        className="min-h-14 w-full rounded-full bg-destaque px-6 text-lg font-bold text-sobre-destaque disabled:opacity-60"
      >
        {pendente ? "A IA está lendo…" : "Montar rascunho"}
      </button>
    </form>
  );
}
