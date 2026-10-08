# IBGE – Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil (POF 2008-2009)

- **Arquivo oficial:** `tabelamedidas_bd.zip` (versão "banco de dados"), do FTP do IBGE:
  `https://ftp.ibge.gov.br/Orcamentos_Familiares/Pesquisa_de_Orcamentos_Familiares_2008_2009/Tabela_de_Medidas_Referidas_para_os_Alimentos_Consumidos_no_Brasil/tabelamedidas_bd.zip`
  - SHA-256: `3d0ff06acf0b55c22a621f57e6fb218d4505af204ed2be1571bfbe02fbab17c9`
- **CSV usado na importação:** `tabela-medidas-referidas-pof2008.csv` é a aba "Tab_Medidas Caseiras" do `.xls` oficial, convertida pelo Excel (macros desativadas, sem edição), separada por `;`, decimais com vírgula.
  - SHA-256: `5221d3b8a999637605db6a26d1d055534f43a40d42a66a85acb54ce25083fbad` (conferido pelo script).
- **Citação (dos próprios arquivos):** "Fonte: IBGE, Diretoria de Pesquisas, Coordenação de Trabalho e Rendimento, Pesquisa de Orçamentos Familiares 2008-2009."
- **Licença:** os arquivos não trazem texto de licença. Dados públicos do IBGE, usados com citação da fonte. Confirmar com o IBGE antes de uso comercial (ver SPEC, "Antes de vender").

## Como o Kalyft usa

- Só as linhas em que a medida relatada é a própria medida padrão (ex.: UNIDADE → UNIDADE), sem "grama" e "quilo".
- A medida e o alimento vêm da coluna "descrição do alimento na referência" (ex.: "Pão francês - unidade" = 50 g).
- No app, essas medidas aparecem como **sugestões** na tela de cada alimento, sempre com o nome de origem do IBGE, para o usuário escolher se servem.

Importação: `npm run ibge:importar -- --alvo dev` (ver `scripts/importar-ibge.mjs`).
