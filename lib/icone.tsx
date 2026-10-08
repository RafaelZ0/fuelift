import { ImageResponse } from "next/og";

// Cores da marca (o ícone é uma imagem, então não herda as variáveis CSS).
const FUNDO = "#121314";
const ANILHA = "#d93a2e";
const APOIO = "#f2d25c";
const LETRA = "#f2efe9";

/**
 * Ícone do app desenhado em código (sem arquivo binário no repositório):
 * uma anilha olímpica vermelha com aro amarelo e um "K" no centro.
 * `margem` reduz o desenho para a área segura dos ícones "maskable".
 */
export function desenharIcone(tamanho: number, margem = 0.22): ImageResponse {
  const d = tamanho * (1 - margem * 2); // diâmetro da anilha
  const x0 = (tamanho - d) / 2;
  const aro = d * 0.05;
  const miolo = d * 0.74; // diâmetro da área interna do aro
  const mx = (tamanho - miolo) / 2;
  const u = miolo / 10; // unidade do "K"
  const kx = (tamanho - miolo) / 2 + u * 3;
  const ky = (tamanho - miolo) / 2 + u * 2;
  const barra = u * 1.5;
  const L = u * 4.8;
  const w = barra * 0.9;
  const jx = kx + barra; // ponto onde os braços do K encontram a haste
  const jy = ky + u * 3;
  const dx = (L / 2) * Math.sin((40 * Math.PI) / 180);
  const dy = (L / 2) * Math.cos((40 * Math.PI) / 180);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: FUNDO }}>
        <div style={{ position: "absolute", left: x0, top: x0, width: d, height: d, borderRadius: d, background: ANILHA }} />
        <div style={{ position: "absolute", left: mx, top: mx, width: miolo, height: miolo, borderRadius: miolo, border: `${aro}px solid ${APOIO}` }} />
        <div style={{ position: "absolute", left: kx, top: ky, width: barra, height: u * 6, background: LETRA, borderRadius: u * 0.15 }} />
        <div
          style={{
            position: "absolute",
            left: jx + dx - w / 2 - u * 0.1,
            top: jy - dy - L / 2,
            width: w,
            height: L,
            background: LETRA,
            borderRadius: u * 0.15,
            transform: "rotate(40deg)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: jx + dx - w / 2 - u * 0.1,
            top: jy + dy - L / 2,
            width: w,
            height: L,
            background: LETRA,
            borderRadius: u * 0.15,
            transform: "rotate(-40deg)",
          }}
        />
      </div>
    ),
    { width: tamanho, height: tamanho },
  );
}
