"use client";

import { useActionState, useState } from "react";
import { Aviso, BotaoEnviar, BotaoSecundario, Campo, Opcoes } from "@/components/ui";
import { formatarDataBr } from "@/lib/datas";
import { NIVEIS_ATIVIDADE, ROTULOS_NIVEL } from "@/lib/validacao/perfil";
import { salvarMetas, salvarPerfil, type EstadoForm } from "./actions";

export type PerfilTela = {
  nome: string | null;
  dataNascimento: string | null;
  sexo: string | null;
  alturaCm: number | null;
  nivelAtividade: string | null;
  inicioPlano: string | null;
};

export type MetaTela = {
  vigenteDesde: string;
  kcal: number | null;
  proteinaG: number | null;
  carboG: number | null;
  gorduraG: number | null;
  aguaMl: number | null;
  pesoMetaKg: number | null;
  dataMeta: string | null;
  observacao: string | null;
};

const decimal = (n: number | null) => (n === null ? "" : String(n).replace(".", ","));
const inteiro = (n: number | null) => (n === null ? "" : n.toLocaleString("pt-BR"));

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-linha py-4">
      <dt className="text-suave">{rotulo}</dt>
      <dd className="text-right text-lg font-semibold">{valor || "—"}</dd>
    </div>
  );
}

function Cabecalho({
  titulo,
  editando,
  onEditar,
}: {
  titulo: string;
  editando: boolean;
  onEditar: () => void;
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 id={titulo.toLowerCase()} className="text-2xl font-bold">{titulo}</h2>
      {!editando ? <BotaoSecundario onClick={onEditar}>Editar</BotaoSecundario> : null}
    </div>
  );
}

/** Padrão Editar → modo de edição → Salvar. Volta à leitura quando salva. */
function usePainel(acao: (e: EstadoForm, f: FormData) => Promise<EstadoForm>) {
  const [editando, setEditando] = useState(false);
  const [salvo, setSalvo] = useState(false);
  const [estado, enviar] = useActionState(async (anterior: EstadoForm, form: FormData) => {
    const r = await acao(anterior, form);
    if (r.ok) {
      setEditando(false);
      setSalvo(true);
    }
    return r;
  }, {});
  return {
    editando,
    salvo,
    estado,
    enviar,
    editar: () => {
      setSalvo(false);
      setEditando(true);
    },
    cancelar: () => setEditando(false),
  };
}

export function PainelPerfil({ perfil }: { perfil: PerfilTela }) {
  const p = usePainel(salvarPerfil);
  const erros = p.estado.erros ?? {};

  return (
    <section aria-labelledby="perfil">
      <Cabecalho titulo="Perfil" editando={p.editando} onEditar={p.editar} />
      {p.salvo ? <Aviso tipo="ok">Perfil salvo.</Aviso> : null}
      {!p.editando ? (
        <dl>
          <Linha rotulo="Nome" valor={perfil.nome ?? ""} />
          <Linha rotulo="Nascimento" valor={formatarDataBr(perfil.dataNascimento)} />
          <Linha rotulo="Sexo" valor={perfil.sexo === "masculino" ? "Masculino" : perfil.sexo === "feminino" ? "Feminino" : ""} />
          <Linha rotulo="Altura" valor={perfil.alturaCm ? `${decimal(perfil.alturaCm)} cm` : ""} />
          <Linha rotulo="Atividade" valor={perfil.nivelAtividade ? ROTULOS_NIVEL[perfil.nivelAtividade as keyof typeof ROTULOS_NIVEL] : ""} />
          <Linha rotulo="Início do plano" valor={formatarDataBr(perfil.inicioPlano)} />
        </dl>
      ) : (
        <form action={p.enviar} className="mt-6 space-y-8" noValidate>
          <Campo nome="nome" rotulo="Nome" maxLength={80} valor={perfil.nome} erro={erros.nome} />
          <Campo nome="dataNascimento" rotulo="Data de nascimento" tipo="date" valor={perfil.dataNascimento} erro={erros.dataNascimento} />
          <Opcoes nome="sexo" rotulo="Sexo" valor={perfil.sexo} erro={erros.sexo}
            opcoes={[{ valor: "masculino", rotulo: "Masculino" }, { valor: "feminino", rotulo: "Feminino" }]} />
          <Campo nome="alturaCm" rotulo="Altura" teclado="decimal" sufixo="cm" maxLength={5}
            valor={decimal(perfil.alturaCm)} erro={erros.alturaCm} />
          <Opcoes nome="nivelAtividade" rotulo="Nível de atividade" valor={perfil.nivelAtividade} erro={erros.nivelAtividade}
            opcoes={NIVEIS_ATIVIDADE.map((n) => ({ valor: n, rotulo: ROTULOS_NIVEL[n] }))} />
          <Campo nome="inicioPlano" rotulo="Início do plano" tipo="date" valor={perfil.inicioPlano} erro={erros.inicioPlano} />
          {p.estado.erro ? <Aviso>{p.estado.erro}</Aviso> : null}
          <div className="flex items-center gap-3">
            <div className="flex-1"><BotaoEnviar>Salvar</BotaoEnviar></div>
            <BotaoSecundario onClick={p.cancelar}>Cancelar</BotaoSecundario>
          </div>
        </form>
      )}
    </section>
  );
}

export function PainelMetas({ meta, historico }: { meta: MetaTela | null; historico: MetaTela[] }) {
  const p = usePainel(salvarMetas);
  const erros = p.estado.erros ?? {};
  const m = meta;

  return (
    <section aria-labelledby="metas">
      <Cabecalho titulo="Metas" editando={p.editando} onEditar={p.editar} />
      <p className="mb-2 text-sm text-suave">
        Use as metas combinadas com seu nutricionista. O app não calcula metas por você.
      </p>
      {p.salvo ? <Aviso tipo="ok">Metas salvas a partir de hoje.</Aviso> : null}
      {!p.editando ? (
        <>
          <dl>
            <Linha rotulo="Calorias" valor={m?.kcal ? `${inteiro(m.kcal)} kcal` : ""} />
            <Linha rotulo="Proteína" valor={m?.proteinaG != null ? `${m.proteinaG} g` : ""} />
            <Linha rotulo="Carboidrato" valor={m?.carboG != null ? `${m.carboG} g` : ""} />
            <Linha rotulo="Gordura" valor={m?.gorduraG != null ? `${m.gorduraG} g` : ""} />
            <Linha rotulo="Água" valor={m?.aguaMl != null ? `${inteiro(m.aguaMl)} ml` : ""} />
            <Linha rotulo="Peso-meta" valor={m?.pesoMetaKg ? `${decimal(m.pesoMetaKg)} kg` : ""} />
            <Linha rotulo="Data da meta" valor={formatarDataBr(m?.dataMeta)} />
            <Linha rotulo="Observação" valor={m?.observacao ?? ""} />
          </dl>
          {m ? <p className="mt-3 text-sm text-suave">Em vigor desde {formatarDataBr(m.vigenteDesde)}.</p> : null}
        </>
      ) : (
        <form action={p.enviar} className="mt-6 space-y-8" noValidate>
          <p className="text-sm text-suave">
            As novas metas valem a partir de hoje. Os dias anteriores continuam com as metas antigas.
          </p>
          <Campo nome="kcal" rotulo="Calorias por dia" teclado="numeric" sufixo="kcal" maxLength={5} valor={m?.kcal?.toString()} erro={erros.kcal} />
          <Campo nome="proteinaG" rotulo="Proteína" teclado="numeric" sufixo="g" maxLength={3} valor={m?.proteinaG?.toString()} erro={erros.proteinaG} />
          <Campo nome="carboG" rotulo="Carboidrato" teclado="numeric" sufixo="g" maxLength={4} valor={m?.carboG?.toString()} erro={erros.carboG} />
          <Campo nome="gorduraG" rotulo="Gordura" teclado="numeric" sufixo="g" maxLength={3} valor={m?.gorduraG?.toString()} erro={erros.gorduraG} />
          <Campo nome="aguaMl" rotulo="Água" teclado="numeric" sufixo="ml" maxLength={5} valor={m?.aguaMl?.toString()} erro={erros.aguaMl} />
          <Campo nome="pesoMetaKg" rotulo="Peso-meta" teclado="decimal" sufixo="kg" maxLength={5} valor={decimal(m?.pesoMetaKg ?? null)} erro={erros.pesoMetaKg} />
          <Campo nome="dataMeta" rotulo="Data desejada (opcional)" tipo="date" valor={m?.dataMeta} erro={erros.dataMeta} />
          <Campo nome="observacao" rotulo="Observação" maxLength={500} valor={m?.observacao} erro={erros.observacao} />
          {erros._ ? <Aviso>{erros._}</Aviso> : null}
          {p.estado.erro ? <Aviso>{p.estado.erro}</Aviso> : null}
          <div className="flex items-center gap-3">
            <div className="flex-1"><BotaoEnviar>Salvar</BotaoEnviar></div>
            <BotaoSecundario onClick={p.cancelar}>Cancelar</BotaoSecundario>
          </div>
        </form>
      )}
      {historico.length > 1 ? (
        <details className="mt-6">
          <summary className="flex min-h-12 cursor-pointer items-center font-semibold text-suave">Histórico de metas</summary>
          <ul>
            {historico.map((h) => (
              <li key={h.vigenteDesde} className="flex justify-between border-b border-linha py-3 text-sm">
                <span>desde {formatarDataBr(h.vigenteDesde)}</span>
                <span className="text-suave">
                  {h.kcal ? `${inteiro(h.kcal)} kcal` : "—"} · {h.proteinaG != null ? `${h.proteinaG} g prot.` : "—"}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}
