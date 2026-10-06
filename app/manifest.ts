import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fuelift",
    short_name: "Fuelift",
    description: "Treino e nutrição.",
    lang: "pt-BR",
    start_url: "/hoje",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0a",
    theme_color: "#0b0b0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
