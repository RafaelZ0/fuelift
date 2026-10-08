import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  axes: ["wdth"],
});

// Todas as páginas dependem da sessão e do nonce da CSP: renderização dinâmica.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Kalyft",
  description: "Treino e nutrição.",
  applicationName: "Kalyft",
  appleWebApp: { capable: true, title: "Kalyft", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#121314" },
    { media: "(prefers-color-scheme: light)", color: "#f6f3ec" },
  ],
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} antialiased`}>
      <body className="min-h-dvh bg-fundo text-texto">{children}</body>
    </html>
  );
}
