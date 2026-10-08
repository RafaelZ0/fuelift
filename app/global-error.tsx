"use client";

import "./globals.css";

export default function ErroGlobal({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-dvh bg-fundo text-texto">
        <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
          <h1 className="text-4xl font-black">Algo deu errado.</h1>
          <p className="mt-4 text-lg text-suave">Tente de novo em instantes.</p>
          <button
            type="button"
            onClick={reset}
            className="mt-10 min-h-14 rounded-full bg-destaque text-lg font-bold text-sobre-destaque"
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
