"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/hoje", rotulo: "Hoje", icone: "M4 12h16M12 4v16" },
  { href: "/comida", rotulo: "Comida", icone: "M7 3v8a3 3 0 0 0 6 0V3M10 3v18M17 3c-1.5 2-2 4-2 7h3v11" },
  { href: "/treino", rotulo: "Treino", icone: "M3 9v6M6 6v12M18 6v12M21 9v6M6 12h12" },
  { href: "/progresso", rotulo: "Progresso", icone: "M3 20h18M5 16l5-5 4 3 6-8" },
  { href: "/ajustes", rotulo: "Ajustes", icone: "M4 6h16M4 12h16M4 18h16M9 4v4M15 10v4M8 16v4" },
] as const;

export function BarraAbas() {
  const caminho = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-linha bg-fundo/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <ul className="mx-auto grid max-w-lg grid-cols-5">
        {ABAS.map((aba) => {
          const ativa = caminho === aba.href || caminho.startsWith(`${aba.href}/`);
          return (
            <li key={aba.href}>
              <Link
                href={aba.href}
                aria-current={ativa ? "page" : undefined}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-xs font-semibold ${
                  ativa ? "text-marca" : "text-suave"
                }`}
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-6 w-6 fill-none stroke-current [stroke-linecap:round] [stroke-linejoin:round] [stroke-width:2]"
                >
                  <path d={aba.icone} />
                </svg>
                {aba.rotulo}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
