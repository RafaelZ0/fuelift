import { describe, expect, it } from "vitest";
import { dataEmSaoPaulo, formatarDataBr } from "@/lib/datas";

describe("datas no fuso de São Paulo", () => {
  it("02:30 UTC ainda é o dia anterior em São Paulo (UTC-3)", () => {
    expect(dataEmSaoPaulo(new Date("2026-10-07T02:30:00Z"))).toBe("2026-10-06");
  });

  it("03:00 UTC já é o dia seguinte em São Paulo", () => {
    expect(dataEmSaoPaulo(new Date("2026-10-07T03:00:00Z"))).toBe("2026-10-07");
  });

  it("virada do ano", () => {
    expect(dataEmSaoPaulo(new Date("2027-01-01T02:59:59Z"))).toBe("2026-12-31");
  });

  it("formata para o padrão brasileiro", () => {
    expect(formatarDataBr("2026-03-09")).toBe("09/03/2026");
    expect(formatarDataBr(null)).toBe("");
  });
});
