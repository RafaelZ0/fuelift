import { describe, expect, it } from "vitest";
import { formatoDeTokenValido, gerarToken, hashDoToken, PREFIXO_TOKEN, tokenDoCabecalho } from "@/lib/token-api";

describe("token da API de passos", () => {
  it("gera tokens únicos, longos e no formato esperado", () => {
    const a = gerarToken();
    const b = gerarToken();
    expect(a).not.toBe(b);
    expect(a.startsWith(PREFIXO_TOKEN)).toBe(true);
    expect(a).toHaveLength(PREFIXO_TOKEN.length + 43);
    expect(formatoDeTokenValido(a)).toBe(true);
  });
  it("o hash é SHA-256 em hexadecimal e não revela o token", () => {
    const t = gerarToken();
    const h = hashDoToken(t);
    expect(h).toMatch(/^[0-9a-f]{64}$/);
    expect(hashDoToken(t)).toBe(h);
    expect(hashDoToken(gerarToken())).not.toBe(h);
  });
  it("extrai só um Bearer válido", () => {
    const t = gerarToken();
    expect(tokenDoCabecalho(`Bearer ${t}`)).toBe(t);
    expect(tokenDoCabecalho(`  Bearer ${t}  `)).toBe(t);
    for (const ruim of [null, "", t, `Basic ${t}`, `Bearer ${t}x`, "Bearer kly_curto", `Bearer ${t} extra`, "Bearer '; drop table"]) {
      expect(tokenDoCabecalho(ruim)).toBeNull();
    }
  });
  it("recusa o que não é token", () => {
    for (const v of [null, undefined, 123, "kly_", "abc", `kly_${"a".repeat(42)}`, `kly_${"a".repeat(44)}`, `kly_${"!".repeat(43)}`]) {
      expect(formatoDeTokenValido(v)).toBe(false);
    }
  });
});
