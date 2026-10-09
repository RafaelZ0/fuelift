"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Aviso, BotaoSecundario } from "@/components/ui";
import { compararComRotulo, CAMPOS_ROTULO, ROTULOS_CAMPO, type CampoRotulo, type Diferenca, type RotuloLido } from "@/lib/ia/rotulo";
import { gerarImagemSemMetadados } from "../../treino/ia/imagem";
import { lerRotuloComIa, type EstadoRotulo } from "../rotulo/actions";

const SUFIXO: Record<CampoRotulo, string> = { porcaoG: "g", kcal: "kcal", proteinaG: "g", carboG: "g", gorduraG: "g", fibraG: "g", sodioMg: "mg" };

function numeroDoCampo(form: HTMLFormElement, nome: string): number | null {
  const el = form.elements.namedItem(nome);
  if (!(el instanceof HTMLInputElement) || el.value.trim() === "") return null;
  const n = Number(el.value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Foto da tabela nutricional: a IA lê os números e o app compara com o que está digitado. Nada é salvo aqui. */
export function LerRotulo({ formRef }: { formRef: React.RefObject<HTMLFormElement | null> }) {
  // As diferenças são calculadas quando a resposta chega, com o que está digitado nesse momento.
  const [estado, acao] = useActionState<EstadoRotulo & { diferencas?: Diferenca[] }, FormData>(async (anterior, fd) => {
    const r = await lerRotuloComIa(anterior, fd);
    const form = formRef.current;
    if (!r.rotulo || !form) return r;
    const digitado = Object.fromEntries(CAMPOS_ROTULO.map((c) => [c, numeroDoCampo(form, c)])) as Record<CampoRotulo, number | null>;
    return { ...r, diferencas: compararComRotulo(digitado, r.rotulo) };
  }, {});
  const [pendente, iniciar] = useTransition();
  const [preparando, setPreparando] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);
  const [aplicado, setAplicado] = useState(false);
  const entrada = useRef<HTMLInputElement>(null);

  async function escolher(arquivo: File | undefined) {
    setErroLocal(null);
    setAplicado(false);
    if (!arquivo) return;
    setPreparando(true);
    try {
      // A foto é refeita no navegador (JPEG reduzido): isso remove localização e outros metadados.
      const pronta = await gerarImagemSemMetadados(arquivo);
      const fd = new FormData();
      fd.set("foto", pronta, "rotulo.jpg");
      iniciar(() => acao(fd));
    } catch (e) {
      setErroLocal(e instanceof Error ? e.message : "Não consegui ler essa foto.");
    } finally {
      setPreparando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  function aplicar(lido: RotuloLido) {
    const form = formRef.current;
    if (!form) return;
    const valores: Record<string, number | string | null> = { nome: lido.nome, marca: lido.marca, porcaoG: lido.porcaoG, kcal: lido.kcal, proteinaG: lido.proteinaG, carboG: lido.carboG, gorduraG: lido.gorduraG, fibraG: lido.fibraG, sodioMg: lido.sodioMg };
    for (const [nome, v] of Object.entries(valores)) {
      const el = form.elements.namedItem(nome);
      if (!(el instanceof HTMLInputElement) || v === null) continue;
      if ((nome === "nome" || nome === "marca") && el.value.trim() !== "") continue; // não sobrescreve o que a pessoa já digitou
      el.value = typeof v === "number" ? String(v).replace(".", ",") : v;
    }
    setAplicado(true);
  }

  const lido = estado.rotulo;
  const diferencas = estado.diferencas ?? [];
  const ocupado = preparando || pendente;

  return (
    <section aria-labelledby="ler-rotulo" className="space-y-4 rounded-2xl border-2 border-borda p-4">
      <h2 id="ler-rotulo" className="text-lg font-bold">Ler o rótulo por foto (IA)</h2>
      <p className="text-sm text-suave">Fotografe a tabela nutricional de perto. A IA lê os números e você confere. A foto é enviada ao Google; não fotografe nada além da embalagem.</p>
      <input ref={entrada} id="foto-rotulo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="sr-only" onChange={(ev) => void escolher(ev.target.files?.[0])} />
      <label htmlFor="foto-rotulo" className={`flex min-h-12 cursor-pointer items-center justify-center rounded-full border-2 border-borda font-semibold ${ocupado ? "opacity-60" : ""}`}>
        {ocupado ? "Lendo o rótulo…" : "Fotografar o rótulo"}
      </label>

      {erroLocal ? <Aviso>{erroLocal}</Aviso> : null}
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.precisaAceite ? <Link href="/treino/ia" className="block font-semibold underline">Abrir o aviso da IA</Link> : null}

      {lido ? (
        <div className="space-y-3" aria-live="polite">
          <p className="rounded-2xl border-2 border-aviso p-3 font-medium text-aviso"><span aria-hidden="true">! </span>Estimativa de leitura por IA. Confira com a embalagem antes de salvar.</p>
          <dl className="space-y-1">
            {CAMPOS_ROTULO.map((c) => (lido[c] === null ? null : (
              <div key={c} className="flex justify-between gap-4">
                <dt className="text-suave">{ROTULOS_CAMPO[c]}</dt>
                <dd className="font-semibold">{String(lido[c]).replace(".", ",")} {SUFIXO[c]}</dd>
              </div>
            )))}
          </dl>
          {diferencas.length > 0 ? (
            <div role="alert" className="rounded-2xl border-2 border-aviso p-3 text-aviso">
              <p className="font-semibold"><span aria-hidden="true">! </span>O que você digitou é diferente da foto:</p>
              <ul className="mt-1 space-y-1">
                {diferencas.map((d) => (
                  <li key={d.campo}>{ROTULOS_CAMPO[d.campo]}: você digitou {String(d.digitado).replace(".", ",")} e a foto mostra {String(d.lido).replace(".", ",")} {SUFIXO[d.campo]}</li>
                ))}
              </ul>
              <p className="mt-1 text-sm">Veja qual está certo na embalagem.</p>
            </div>
          ) : null}
          {estado.descartados ? <p className="text-sm text-suave">{estado.descartados} valor(es) fora do normal foram ignorados.</p> : null}
          <BotaoSecundario onClick={() => aplicar(lido)}>Usar estes valores no formulário</BotaoSecundario>
          {aplicado ? <p role="status" className="font-medium text-ok"><span aria-hidden="true">✓ </span>Valores colocados no formulário. Confira e salve.</p> : null}
        </div>
      ) : null}
    </section>
  );
}
