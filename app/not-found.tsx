import Link from "next/link";

export default function NaoEncontrado() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <h1 className="text-4xl font-black">Página não encontrada.</h1>
      <Link
        href="/hoje"
        className="mt-10 flex min-h-14 items-center justify-center rounded-full bg-destaque text-lg font-bold text-fundo"
      >
        Voltar ao início
      </Link>
    </main>
  );
}
