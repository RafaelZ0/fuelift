# TACO – Tabela Brasileira de Composição de Alimentos

- **Arquivo:** `Taco-4a-Edicao.xlsx`, planilha oficial do NEPA/UNICAMP (menu Publicações → "Tabela TACO (Excel)" em https://nepa.unicamp.br/publicacoes/).
- **SHA-256:** `a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14` (conferido pelo script de importação).
- **Edição:** 4ª edição revisada e ampliada, 2011. 597 alimentos. A aba usada é a 1 ("CMVCol taco3": centesimal, minerais, vitaminas e colesterol). Os valores conferem com o PDF oficial.
- **Termos de uso (do PDF oficial):** "É permitida a reprodução parcial ou total desta obra, desde que citada a fonte."
- **Citação:** NÚCLEO DE ESTUDOS E PESQUISAS EM ALIMENTAÇÃO (NEPA/UNICAMP). *Tabela brasileira de composição de alimentos – TACO*. 4. ed. rev. e ampl. Campinas: NEPA-UNICAMP, 2011. 161 p.

## Marcações (legenda da própria planilha)

| Marca | Significado oficial | Como o Kalyft guarda |
|---|---|---|
| `Tr` | traço (abaixo do limite de quantificação) | 0 |
| `NA` | não aplicável | 0 |
| `*` | "as análises estão sendo reavaliadas" | desconhecido (null) |
| em branco | "análises não solicitadas" | desconhecido (null) |

Carboidrato negativo (artefato do cálculo por diferença) vira 0. A marcação original fica em `alimentos_base.marcacoes`. O carboidrato da TACO é calculado por diferença e inclui a fibra.

Importação: `npm run taco:importar -- --alvo dev` (ver `scripts/importar-taco.mjs`).

## Valores complementares (`complementos.json`)

Preenchem só campos desconhecidos (`*`) e ficam marcados com a fonte em `marcacoes`. Aprovados pelo usuário em 08/10/2026.

| Código | Alimento | Fonte |
|---|---|---|
| 458 | Leite, de vaca, integral | USDA FoodData Central, FDC 172217 (domínio público) |
| 457 | Leite, de vaca, desnatado, UHT | USDA FoodData Central, FDC 173432 (domínio público) |
| 450 | Iogurte, sabor abacaxi | média dos iogurtes sabor morango (451) e pêssego (452) da própria TACO |

Sem fonte confiável, o 591 (Coco, verde, cru) continua sem calorias e não pode ser adicionado ao diário.
