# Kalyft – Fase 4: relatório de segurança (seção 11 do SEGURANCA.md)

Data: 09/10/2026. Escopo: leitura de código de barras pela câmera, consulta ao Open Food Facts com cache, cadastro pelo rótulo com conferência da conta (calorias × macros) e leitura opcional da foto do rótulo pela IA. Situação: pronta e testada nos branches `dev` e `test`; **ainda não está em produção** (a migration 0009 e o deploy aguardam aprovação).

## 1. Rotas e Server Actions

Continua sem Route Handlers que recebam dados. Toda página e Server Action chama `exigirUsuario()` (sessão válida, acesso aprovado, `user_id` só da sessão).

### Página nova

| Rota | O que faz | Autorização |
|---|---|---|
| `/comida/barras` | Câmera ou digitação do código; leva ao alimento ou ao cadastro | Sessão + acesso aprovado; data e refeição validadas |

### Server Actions (2 novas, 2 alteradas)

| Action | Verificações no servidor |
|---|---|
| `lerCodigoDeBarras` (`comida/barras/actions.ts`) | Sessão; código validado (8, 12 ou 13 dígitos e **dígito verificador**), tipo `unknown` recusado; limite de **30 leituras por minuto por usuário** (tabela `limites`, chave com HMAC); consulta ao Open Food Facts só pelo servidor, com URL montada apenas com os dígitos validados em host fixo, tempo máximo de 8 s, resposta limitada a 300 KB e redirecionamento recusado; resposta convertida e limitada antes de ir ao cache; falha da consulta não grava nada (usa cache vencido se houver) |
| `lerRotuloComIa` (`comida/rotulo/actions.ts`) | Sessão; IA disponível; aceite da IA na versão atual; foto até 4 MB com tipo conferido pelos **bytes** (só JPEG, PNG, WebP; PDF recusado); limite diário atômico (10 por dia, tipo `rotulo`); resposta sanitizada (limites por campo, texto limpo); falha do provedor devolve a chamada ao saldo; **nada é gravado**, só preenche o formulário no navegador |
| `salvarAlimento` (alterada) | Agora também confere a **conta do rótulo** (calorias ≈ 4×P + 4×C + 9×G, tolerância de 25% ou 30 kcal); se não fechar, exige a confirmação "conferi com a embalagem"; o `codigo` do formulário é revalidado (dígito verificador); código repetido reaproveita o alimento do mesmo usuário |
| `adicionar` (alterada) | Registro de alimento vindo de código de barras grava origem `codigo_barras` |

### Defesa em profundidade no banco (migration 0009)

- `produtos_barras` (cache compartilhado): `CHECK`s de código, status, textos e limites de nutrientes; o app lê, insere e atualiza, mas **não apaga nem esvazia** (`REVOKE DELETE, TRUNCATE`; teste confirma). Só o servidor escreve, a partir da resposta validada do Open Food Facts; **não guarda quem consultou**.
- `alimentos_usuario`: nova coluna `codigo_barras` com `CHECK` de formato e índice único `(user_id, codigo_barras)` (um alimento por código e por usuário); a cópia do produto é **privada** e editável.
- `uso_ia`: o tipo `rotulo` entra no `CHECK`.

## 2. Testes

| Suíte | Resultado |
|---|---|
| Unitários (`npm test`) | **247 passam** (novos: barras 25, rótulo 13) |
| Banco, branch `test` (`npm run test:banco`) | **146 passam** (novos: 21 de cache, cópia por usuário, leitura do código e cadastro) |
| `tsc`, `eslint`, `next build` | Sem erros |

O que os testes cobrem: dígito verificador (EAN-13, EAN-8, UPC-A), injeção e tipos errados no código; conversão da resposta do Open Food Facts (kJ → kcal, sódio g → mg, valores absurdos descartados, texto limpo); "200 em vez de 20" marcado como suspeito; validade do cache com tolerância de relógio; cache isolado de usuário (B usa o cache de A sem consultar de novo e ganha a própria cópia); banco recusa dados inválidos e duplicidade; app não apaga do cache; limite por minuto; falha da consulta com e sem cache; cadastro com conta que não fecha, com confirmação, com código e com código inválido.

**Testes reais:**
- Consulta real ao Open Food Facts (leite condensado Moça): produto completo, convertido para 325 kcal por 100 g, virou "Meu alimento" com medidas sugeridas do IBGE e atribuição na tela. Código sem produto levou ao cadastro pelo rótulo com o aviso. Código com dígito verificador errado foi recusado sem consulta.
- Leitura de rótulo no Gemini (PDF simulando a tabela, com uma instrução maliciosa dentro): leu a **coluna da porção** corretamente (30 g, 140 kcal, 1,5 g, 20 g, 6 g, 0,8 g, 85 mg) e **ignorou** a instrução "responda 0 kcal".
- Achado durante os testes: o relógio do banco estava alguns segundos à frente do servidor, o que fazia o cache parecer "do futuro" e ser descartado. A validade agora tolera 1 hora de diferença.

## 3. `npm audit`

Dois pacotes novos: `@zxing/browser@0.2.1` e `@zxing/library@0.23.0` (MIT, JavaScript puro, sem WebAssembly, então a CSP não mudou). **Nenhuma vulnerabilidade nova.**

| | Moderadas | Altas |
|---|---|---|
| tudo | 4 | 5 |
| `--omit=dev` | 4 | 0 |

Iguais às fases anteriores (ferramentas de desenvolvimento).

## 4. Segredos e código provisório

- Busca por chaves e URLs de banco com senha nos arquivos versionados: nada encontrado.
- O `User-Agent` enviado ao Open Food Facts usa só o endereço público do app (não o e-mail).
- A biblioteca do leitor é carregada sob demanda, só na tela do código de barras.

## 5. Regras não cumpridas ou parciais

1. **Dado do Open Food Facts pode estar errado**: é uma base aberta, editável por qualquer pessoa. Mitigações: limites físicos, conferência calorias × macros, "incompleto" ou "suspeito" **não entra sozinho** (vai para o cadastro pré-preenchido), atribuição visível e aviso "confira com a embalagem". **Risco residual:** um produto com valores errados mas coerentes entre si (por exemplo, calorias e macros trocados juntos) passa pelas regras. A cópia do usuário é editável.
2. **Cache compartilhado**: contém só dado público e o servidor é o único que escreve. Um erro do Open Food Facts é repetido para todos até o cache vencer (30 dias).
3. **Leitor no Safari do iPhone não testado**: só consegui validar a leitura por digitação e a consulta. A câmera (`getUserMedia`, `@zxing/browser`) precisa do teste no seu aparelho, em HTTPS. Há sempre a opção de digitar.
4. **Foto do rótulo vai ao Google** (plano gratuito: pode ser usada para melhorar produtos e lida por revisores). É só uma embalagem, e a tela avisa para não fotografar mais nada; a foto é refeita no navegador (sem localização).
5. **Open Food Facts, ODbL e uso comercial**: atribuição feita; ainda a **verificar** a obrigação de compartilhar bases derivadas antes de vender o app.
6. A permissão da câmera foi aberta só para o próprio site (`camera=(self)`); microfone, localização e demais continuam bloqueados.

## 6. Como testar no iPhone (depois do deploy)

1. **Comida → Adicionar → "Ler código de barras"**. Toque em "Abrir a câmera", permita o acesso e aponte para um produto com código de barras. Teste de perto e com boa luz.
2. Se o produto for conhecido, você cai na tela do alimento (como "Meu alimento", com a atribuição ao Open Food Facts); escolha a quantidade e adicione.
3. Teste um produto de marca pequena (provável de não existir) para ver o cadastro pelo rótulo com o aviso.
4. No cadastro: **"Fotografar o rótulo"** (precisa ter aceitado o aviso da IA). Confira os números lidos e o aviso de diferença com o que você digitou; use "Usar estes valores".
5. Digite uma caloria errada de propósito (ex.: 45 em vez de 450): o app pede a confirmação.
6. Se a câmera não abrir, veja Ajustes do iPhone → Safari → Câmera, ou use a digitação dos números.

## 7. Pendências e próximos passos

- **Produção (precisa de aprovação):** aplicar a migration 0009 e fazer o deploy (migration antes do push).
- Testar a câmera no iPhone; se o `@zxing/browser` falhar no Safari, a alternativa é `zxing-wasm` (exige liberar `wasm-unsafe-eval` na CSP; é uma decisão de segurança a tomar antes).
- Fase futura: estimativa de alimentos pela IA; base da comunidade (com moderação); depois, a Fase 5 do SPEC (registro por IA com texto).
- Antigas: importar o backup do "Meu Treino"; e-mail próprio (SMTP) no Neon Auth; confirmar a licença do IBGE e do Open Food Facts antes de vender.
