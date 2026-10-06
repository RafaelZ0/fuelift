import "server-only";

import { handleAuthRequest, NEON_AUTH_SESSION_COOKIE_NAME } from "@neondatabase/auth/server";
import { cookies, headers } from "next/headers";
import { auth } from "./server";

type Resultado = { ok: true } | { ok: false; status: number; codigo?: string };

/**
 * Troca a senha com o código de 6 números enviado por e-mail.
 *
 * O método do SDK (`auth.emailOtp.resetPassword`) chama o caminho
 * `email-otp/passcode`, que não existe no Better Auth 1.6 (lá a rota é
 * `email-otp/reset-password`). Se o Neon responder 404, chamamos a rota do
 * Better Auth pelo kit de servidor público do pacote (@neondatabase/auth/server).
 */
export async function redefinirSenhaComCodigo(email: string, otp: string, senha: string): Promise<Resultado> {
  const r = await auth.emailOtp.resetPassword({ email, otp, password: senha });
  if (!r.error) return { ok: true };
  if (r.error.status !== 404) return { ok: false, status: r.error.status, codigo: r.error.code };

  const h = await headers();
  const origem = h.get("origin") ?? `https://${h.get("host")}`;
  const resposta = await handleAuthRequest(
    process.env.NEON_AUTH_BASE_URL!,
    new Request(`${origem}/api/auth/email-otp/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: origem, "user-agent": h.get("user-agent") ?? "" },
      body: JSON.stringify({ email, otp, password: senha }),
    }),
    "email-otp/reset-password",
  );
  if (resposta.ok) return { ok: true };
  const corpo = (await resposta.json().catch(() => null)) as { code?: string } | null;
  return { ok: false, status: resposta.status, codigo: corpo?.code };
}

/**
 * Encerra no Neon Auth todas as sessões do usuário (inclusive tokens que
 * alguém pudesse usar direto na API do Neon) e abre uma sessão nova neste
 * aparelho. Exige a senha nova recém-definida.
 */
export async function encerrarSessoesNoNeon(email: string, senha: string): Promise<boolean> {
  // 1. Entra com a senha nova para ter uma sessão que autorize a revogação.
  const primeira = await auth.signIn.email({ email, password: senha });
  if (primeira.error) return false;

  // 2. Revoga todas as sessões. O SDK lê os cookies da requisição original,
  //    não os recém-gravados, então o cookie novo é repassado explicitamente.
  const token = (await cookies()).get(NEON_AUTH_SESSION_COOKIE_NAME)?.value;
  if (!token) return false;
  const h = await headers();
  const origem = h.get("origin") ?? `https://${h.get("host")}`;
  const revogacao = await handleAuthRequest(
    process.env.NEON_AUTH_BASE_URL!,
    new Request(`${origem}/api/auth/revoke-sessions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: origem,
        cookie: `${NEON_AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
      },
      body: "{}",
    }),
    "revoke-sessions",
  );
  if (!revogacao.ok) return false;

  // 3. Abre uma sessão nova neste aparelho.
  const nova = await auth.signIn.email({ email, password: senha });
  return !nova.error;
}
