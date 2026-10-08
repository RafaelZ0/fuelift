"use client";

import { useFormStatus } from "react-dom";

type CampoProps = {
  nome: string;
  rotulo: string;
  valor?: string | null;
  erro?: string;
  tipo?: "text" | "email" | "password" | "date";
  teclado?: "numeric" | "decimal" | "email" | "text";
  sufixo?: string;
  autoComplete?: string;
  maxLength?: number;
  dica?: string;
};

/** Campo de texto grande para toque. Números usam teclado numérico, sem setinhas. */
export function Campo({
  nome,
  rotulo,
  valor,
  erro,
  tipo = "text",
  teclado,
  sufixo,
  autoComplete = "off",
  maxLength,
  dica,
}: CampoProps) {
  const idErro = erro ? `${nome}-erro` : undefined;
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-suave">{rotulo}</span>
      <span className="flex items-center gap-3 border-b-2 border-borda focus-within:border-marca">
        <input
          name={nome}
          type={tipo}
          inputMode={teclado}
          defaultValue={valor ?? ""}
          autoComplete={autoComplete}
          maxLength={maxLength}
          aria-invalid={erro ? true : undefined}
          aria-describedby={idErro}
          className="min-h-12 w-full bg-transparent py-2 text-xl font-semibold outline-none placeholder:text-suave"
        />
        {sufixo ? <span className="shrink-0 text-suave">{sufixo}</span> : null}
      </span>
      {dica && !erro ? <span className="mt-1 block text-sm text-suave">{dica}</span> : null}
      {erro ? (
        <span id={idErro} className="mt-1 block text-sm text-erro">
          <span aria-hidden="true">⚠ </span>{erro}
        </span>
      ) : null}
    </label>
  );
}

type OpcoesProps = {
  nome: string;
  rotulo: string;
  opcoes: ReadonlyArray<{ valor: string; rotulo: string }>;
  valor?: string | null;
  erro?: string;
};

/** Escolha única em botões grandes (radio estilizado). */
export function Opcoes({ nome, rotulo, opcoes, valor, erro }: OpcoesProps) {
  return (
    <fieldset>
      <legend className="mb-2 block text-sm font-medium text-suave">{rotulo}</legend>
      <div className="flex flex-wrap gap-2">
        {opcoes.map((o) => (
          <label key={o.valor} className="cursor-pointer">
            <input
              type="radio"
              name={nome}
              value={o.valor}
              defaultChecked={valor === o.valor}
              className="peer sr-only"
            />
            <span className="flex min-h-12 items-center rounded-full border-2 border-borda px-4 font-semibold text-suave peer-checked:border-marca peer-checked:text-texto peer-focus-visible:outline-2 peer-focus-visible:outline-destaque">
              {o.rotulo}
            </span>
          </label>
        ))}
      </div>
      {erro ? <span className="mt-1 block text-sm text-erro"><span aria-hidden="true">⚠ </span>{erro}</span> : null}
    </fieldset>
  );
}

export function BotaoEnviar({ children, pendente }: { children: React.ReactNode; pendente?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="min-h-14 w-full rounded-full bg-destaque px-6 text-lg font-bold text-sobre-destaque disabled:opacity-60"
    >
      {pending ? (pendente ?? "Salvando…") : children}
    </button>
  );
}

export function BotaoSecundario({
  children,
  onClick,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      className="min-h-12 rounded-full border-2 border-borda px-5 font-semibold text-texto active:border-texto"
    >
      {children}
    </button>
  );
}

export function Aviso({ children, tipo = "erro" }: { children: React.ReactNode; tipo?: "erro" | "ok" }) {
  return (
    <p
      role={tipo === "erro" ? "alert" : "status"}
      className={tipo === "erro" ? "text-base font-medium text-erro" : "text-base font-medium text-ok"}
    >
      <span aria-hidden="true">{tipo === "erro" ? "⚠ " : "✓ "}</span>{children}
    </p>
  );
}
