"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Aviso, BotaoEnviar, Campo } from "@/components/ui";
import {
  cadastrar,
  entrar,
  pedirCodigoSenha,
  redefinirSenha,
  reenviarCodigo,
  verificar,
  type EstadoAuth,
} from "./actions";

const inicial: EstadoAuth = {};

export function FormEntrar() {
  const [estado, acao] = useActionState(entrar, inicial);
  return (
    <form action={acao} className="space-y-8" noValidate>
      <Campo nome="email" rotulo="E-mail" tipo="email" teclado="email" autoComplete="email"
        valor={estado.valores?.email} erro={estado.erros?.email} />
      <Campo nome="senha" rotulo="Senha" tipo="password" autoComplete="current-password"
        erro={estado.erros?.senha} />
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      {estado.naoVerificado ? (
        <Link href="/entrar/verificar" className="block font-semibold text-marca underline">
          Digitar código de confirmação
        </Link>
      ) : null}
      <BotaoEnviar pendente="Entrando…">Entrar</BotaoEnviar>
      <div className="flex justify-between gap-4">
        <Link href="/entrar/esqueci" className="flex min-h-12 items-center font-semibold text-suave underline">
          Esqueci a senha
        </Link>
        <Link href="/entrar/cadastro" className="flex min-h-12 items-center font-semibold text-suave underline">
          Criar conta
        </Link>
      </div>
    </form>
  );
}

export function FormEsqueci() {
  const [estado, acao] = useActionState(pedirCodigoSenha, inicial);
  return (
    <form action={acao} className="space-y-8" noValidate>
      <Campo nome="email" rotulo="E-mail" tipo="email" teclado="email" autoComplete="email"
        valor={estado.valores?.email} erro={estado.erros?.email} />
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      <BotaoEnviar pendente="Enviando…">Enviar código</BotaoEnviar>
      <Link href="/entrar" className="block text-center font-semibold text-suave underline">
        Voltar
      </Link>
    </form>
  );
}

export function FormNovaSenha() {
  const [estado, acao] = useActionState(redefinirSenha, inicial);
  if (estado.ok) {
    return (
      <div className="space-y-8">
        <Aviso tipo="ok">{estado.ok}</Aviso>
        <Link href="/entrar" className="flex min-h-14 items-center justify-center rounded-full bg-destaque text-lg font-bold text-sobre-destaque">
          Entrar
        </Link>
      </div>
    );
  }
  return (
    <form action={acao} className="space-y-8" noValidate>
      <Campo nome="email" rotulo="E-mail" tipo="email" teclado="email" autoComplete="email"
        valor={estado.valores?.email} erro={estado.erros?.email} />
      <Campo nome="codigo" rotulo="Código" teclado="numeric" autoComplete="one-time-code"
        maxLength={6} erro={estado.erros?.codigo} />
      <Campo nome="senha" rotulo="Nova senha" tipo="password" autoComplete="new-password"
        dica="Pelo menos 10 caracteres." erro={estado.erros?.senha} />
      <Campo nome="confirmacao" rotulo="Repita a nova senha" tipo="password" autoComplete="new-password"
        erro={estado.erros?.confirmacao} />
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      <BotaoEnviar pendente="Salvando…">Trocar senha</BotaoEnviar>
      <p className="text-sm text-suave">Ao trocar a senha, você sai da conta em todos os outros aparelhos.</p>
    </form>
  );
}

export function FormCadastro() {
  const [estado, acao] = useActionState(cadastrar, inicial);
  return (
    <form action={acao} className="space-y-8" noValidate>
      <Campo nome="nome" rotulo="Nome" autoComplete="given-name" maxLength={80}
        valor={estado.valores?.nome} erro={estado.erros?.nome} />
      <Campo nome="email" rotulo="E-mail" tipo="email" teclado="email" autoComplete="email"
        valor={estado.valores?.email} erro={estado.erros?.email} />
      <Campo nome="senha" rotulo="Senha" tipo="password" autoComplete="new-password"
        dica="Pelo menos 10 caracteres." erro={estado.erros?.senha} />
      {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
      <BotaoEnviar pendente="Criando…">Criar conta</BotaoEnviar>
      <Link href="/entrar" className="block text-center font-semibold text-suave underline">
        Já tenho conta
      </Link>
    </form>
  );
}

export function FormVerificar() {
  const [estado, acao] = useActionState(verificar, inicial);
  const [estadoReenvio, acaoReenvio] = useActionState(reenviarCodigo, inicial);
  return (
    <div className="space-y-12">
      <form action={acao} className="space-y-8" noValidate>
        <Campo nome="email" rotulo="E-mail" tipo="email" teclado="email" autoComplete="email"
          valor={estado.valores?.email} erro={estado.erros?.email} />
        <Campo nome="codigo" rotulo="Código" teclado="numeric" autoComplete="one-time-code"
          maxLength={6} erro={estado.erros?.codigo} />
        {estado.erro ? <Aviso>{estado.erro}</Aviso> : null}
        {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
        {estado.ok ? (
          <Link href="/entrar" className="flex min-h-14 items-center justify-center rounded-full bg-destaque text-lg font-bold text-sobre-destaque">
            Entrar
          </Link>
        ) : (
          <BotaoEnviar pendente="Confirmando…">Confirmar</BotaoEnviar>
        )}
      </form>
      <form action={acaoReenvio} className="space-y-4 border-t border-linha pt-8" noValidate>
        <p className="text-suave">Não chegou? Informe o e-mail e peça outro código.</p>
        <Campo nome="email" rotulo="E-mail" tipo="email" teclado="email" autoComplete="email"
          valor={estadoReenvio.valores?.email} erro={estadoReenvio.erros?.email} />
        {estadoReenvio.erro ? <Aviso>{estadoReenvio.erro}</Aviso> : null}
        {estadoReenvio.ok ? <Aviso tipo="ok">{estadoReenvio.ok}</Aviso> : null}
        <BotaoEnviar pendente="Enviando…">Enviar novo código</BotaoEnviar>
      </form>
    </div>
  );
}
