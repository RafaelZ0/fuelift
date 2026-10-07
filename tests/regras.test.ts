import { describe, expect, it } from "vitest";
import { chaveDoLimite, chaveHmacLimites } from "@/lib/regras-limites";
import { sessaoAindaValida, TOLERANCIA_RELOGIO_MS } from "@/lib/regras-sessao";

const K1 = "k".repeat(32);
const K2 = "z".repeat(32);

describe("HMAC da tabela limites", () => {
  it("não contém o e-mail e é estável (ignora maiúsculas)", () => {
    const a = chaveDoLimite("entrarPorEmail", "Rafa@Exemplo.com", K1);
    expect(a).not.toContain("rafa");
    expect(a).not.toContain("exemplo");
    expect(a).toBe(chaveDoLimite("entrarPorEmail", "rafa@exemplo.com", K1));
  });

  it("muda com a chave e com o tipo", () => {
    const a = chaveDoLimite("entrarPorEmail", "a@b.com", K1);
    expect(a).not.toBe(chaveDoLimite("entrarPorEmail", "a@b.com", K2));
    expect(a).not.toBe(chaveDoLimite("verificarPorEmail", "a@b.com", K1));
  });

  it("falha fechada sem chave ou com chave curta", () => {
    // String vazia = variável ausente. (undefined usaria o valor padrão do .env.)
    expect(() => chaveHmacLimites("")).toThrow();
    expect(() => chaveHmacLimites("curta")).toThrow();
    expect(chaveHmacLimites(K1)).toBe(K1);
  });
});

describe("sessões após troca de senha", () => {
  const troca = new Date("2026-10-06T12:00:00Z");

  it("sem troca registrada, a sessão vale", () => {
    expect(sessaoAindaValida("2020-01-01T00:00:00Z", null)).toBe(true);
  });

  it("sessão anterior à troca é recusada", () => {
    expect(sessaoAindaValida("2026-10-06T11:00:00Z", troca)).toBe(false);
    expect(sessaoAindaValida(new Date(troca.getTime() - TOLERANCIA_RELOGIO_MS - 1), troca)).toBe(false);
  });

  it("sessão criada depois da troca vale (com tolerância de relógio)", () => {
    expect(sessaoAindaValida("2026-10-06T12:00:01Z", troca)).toBe(true);
    expect(sessaoAindaValida(new Date(troca.getTime() - 1000), troca)).toBe(true);
  });

  it("data inválida é recusada", () => {
    expect(sessaoAindaValida("lixo", troca)).toBe(false);
  });
});
