import { NextRequest, type NextResponse } from "next/server";
import { auth } from "@/lib/auth/server";

// O proxy só faz duas coisas: gera o nonce da CSP e redireciona quem não está
// logado para /entrar. Ele NÃO é a verificação de segurança: toda página e
// Server Action verifica a sessão de novo no servidor (lib/auth/sessao.ts).

const protegerRotas = auth.middleware({ loginUrl: "/entrar" });

function montarCsp(nonce: string): string {
  const dev = process.env.NODE_ENV === "development";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    // Fotos dos exercícios: só o repositório público do Free Exercise DB (raw.githubusercontent.com).
    "img-src 'self' blob: data: https://raw.githubusercontent.com",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self'",
    ...(dev ? [] : ["upgrade-insecure-requests"]),
  ].join("; ");
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = montarCsp(nonce);

  const cabecalhos = new Headers(request.headers);
  cabecalhos.set("x-nonce", nonce);
  cabecalhos.set("Content-Security-Policy", csp);

  // O middleware do Neon Auth repassa os cabeçalhos da requisição adiante,
  // então o Next.js recebe o nonce e o aplica nos scripts.
  const resposta = await protegerRotas(new NextRequest(request, { headers: cabecalhos }));
  resposta.headers.set("Content-Security-Policy", csp);
  return resposta;
}

export const config = {
  matcher: [
    {
      // Fora do proxy: arquivos estáticos, os arquivos que o iPhone busca para instalar o app
      // (manifest e ícones) e /api/passos, que se autentica por token pessoal (não por cookie).
      source:
        "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icon|apple-icon|robots.txt|api/passos).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
