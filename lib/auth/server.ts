import "server-only";

import { createNeonAuth } from "@neondatabase/auth/next/server";

const baseUrl = process.env.NEON_AUTH_BASE_URL;
const secret = process.env.NEON_AUTH_COOKIE_SECRET;
if (!baseUrl || !secret) {
  throw new Error("NEON_AUTH_BASE_URL e NEON_AUTH_COOKIE_SECRET precisam estar configuradas.");
}

// Cookies de sessão do Neon Auth: prefixo __Secure-, HttpOnly e Secure
// (definidos pelo pacote). SameSite fixado aqui em "lax".
export const auth = createNeonAuth({
  baseUrl,
  cookies: { secret, sameSite: "lax" },
  logLevel: "error",
});
