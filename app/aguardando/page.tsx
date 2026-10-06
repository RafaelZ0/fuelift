import { redirect } from "next/navigation";
import { exigirLogin } from "@/lib/auth/sessao";
import { registrarAcesso } from "@/lib/dal/acessos";
import { sair } from "../acoes";

export const metadata = { title: "Aguardando aprovação · FuelLift" };

export default async function PaginaAguardando() {
  const usuario = await exigirLogin();
  // Não é admin aqui de propósito: o admin é aprovado em exigirUsuario().
  const acesso = await registrarAcesso(usuario.id, usuario.email, false);
  if (acesso.status === "aprovado") redirect("/hoje");

  const recusado = acesso.status === "recusado";
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <h1 className="text-4xl font-black leading-tight">
        {recusado ? "Acesso não liberado." : "Quase lá."}
      </h1>
      <p className="mt-4 text-lg text-suave">
        {recusado
          ? "Seu cadastro não foi aprovado."
          : "Sua conta foi criada e está aguardando aprovação. Volte mais tarde."}
      </p>
      <form action={sair} className="mt-12">
        <button type="submit" className="min-h-12 rounded-full border-2 border-linha px-5 font-semibold">
          Sair
        </button>
      </form>
    </main>
  );
}
