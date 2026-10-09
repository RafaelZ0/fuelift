import type { NextConfig } from "next";

// A Content-Security-Policy é montada no proxy.ts, com nonce por requisição.
const cabecalhosSeguranca = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    // Câmera só para o próprio site (leitor de código de barras e foto do rótulo).
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Importação de treino por imagem/PDF: até 6 MB de arquivos + margem do multipart. Vale para todas as
  // Server Actions, que continuam exigindo sessão e validando a entrada.
  experimental: { serverActions: { bodySizeLimit: "7mb" } },
  async headers() {
    return [{ source: "/:path*", headers: cabecalhosSeguranca }];
  },
};

export default nextConfig;
