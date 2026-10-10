# Kalyft – Fase 7: relatório de segurança (seção 11 do SEGURANCA.md)

Data: 10/10/2026. Escopo: **7A** resumo semanal (com texto opcional da IA), **7B** receitas e **7C** registro de comida por foto. Situação: pronta e testada nos branches `dev` e `test`; **ainda não está em produção** (as migrations 0012, 0013 e 0014 e o deploy aguardam aprovação). Fotos de progresso do corpo ficaram de fora, por decisão, e estão nos próximos passos.

## 1. Rotas e Server Actions

Nenhum Route Handler novo. Toda página e Server Action chama `exigirUsuario()` (sessão válida, acesso aprovado, `user_id` só da sessão).

### Páginas novas ou alteradas

| Rota | O que faz | Autorização |
|---|---|---|
| `/progresso/semana` | Resumo da semana (segunda a domingo), com navegação entre semanas | Só dados do próprio `user_id`; a semana vem validada (segunda-feira, não futura; o resto vira a semana atual) |
| `/comida/receitas`, `/comida/receitas/nova`, `/comida/receitas/[id]` | Lista, criação e edição de receitas | `id` validado como uuid; de outro usuário = 404 |
| `/comida/ia` (alterada) | Ganhou a aba "Foto do prato" | Mesma barreira da Fase 5 (sessão, aceite da IA) |

### Server Actions (3 novas, 1 alterada)

| Action | Verificações no servidor |
|---|---|
| `gerarResumoSemana` | Sessão; aceite da IA; semana validada; **números recalculados no servidor**; limite diário atômico (10); só números do relatório vão à IA; o texto que cita um número que o app não forneceu é **descartado**; falha do provedor devolve a chamada |
| `salvarReceita` | Sessão; Zod (nome, 0,5 a 200 porções, peso final, 1 a 40 ingredientes, gramas 0,1 a 10 000, uuid, tipo `base`/`usuario`); cada ingrediente é buscado de novo no banco (**TACO ou do próprio usuário**) e os nutrientes são calculados no servidor; ingrediente sem calorias, a própria receita como ingrediente e peso final impossível são recusados; gravação em lote único |
| `excluirReceitaAcao` | Sessão; uuid; só apaga a do próprio usuário (e o alimento gerado); registros antigos ficam com o snapshot |
| `interpretarFoto` | Sessão; aceite da IA; 1 foto de até 4 MB com tipo conferido pelos **bytes** (só JPEG, PNG, WebP; PDF recusado); observação até 200 caracteres limpa; limite diário atômico (10, tipo `foto`); resposta sanitizada; **confiança nunca "alta"**; alimento identificado só por id do banco |
| `salvarRefeicaoIa` (alterada) | Aceita `origem` só `ia_texto` ou `ia_foto` (qualquer outro valor vira `ia_texto`) |

### Defesa em profundidade no banco

- **0012** `relatorios_semanais`: chave `(user_id, inicio)`, `CHECK` de que o início é segunda-feira, texto até 2.000 caracteres e hash em hexadecimal. O texto da IA fica ligado ao **hash dos números** com que foi escrito e só é mostrado enquanto não mudaram.
- **0013** `receitas` e `receita_itens`: chaves compostas `(id, user_id)` (o banco recusa ingrediente ou receita de outro usuário), `CHECK`s de porções, peso, gramas e nutrientes. As chaves para `alimentos_usuario` têm `ON DELETE SET NULL ("alimento_usuario_id")` (editado à mão): apagar um alimento **não é bloqueado** por receita nenhuma, e o item mantém o snapshot.
- **0014**: tipo de uso `foto`. Origens `receita` (alimento) e `ia_foto` (registro).

## 2. Testes

| Suíte | Resultado |
|---|---|
| Unitários (`npm test`) | **365 passam** (novos: relatório 8, IA do resumo 7, receita 11, foto 3, e os da Fase 6) |
| Banco, branch `test` (`npm run test:banco`) | **230 passam** (novos: relatório 7, receitas 18, foto 5) |
| `tsc`, `eslint` | Sem erros nem avisos |

O que os testes cobrem: **relatório** (médias, treinos, peso, ritmos, semana em andamento, dias abaixo de 800 kcal, sem dados, datas); **IA do resumo** (aceita só números do relatório, descarta número inventado em texto e em dicas, hash muda com os números); isolamento do relatório entre usuários e `CHECK`s; **receitas** (soma, porção, parcial, ingrediente sem calorias, peso impossível, 41 ingredientes, outra receita como ingrediente, ela mesma recusada, edição mantém o mesmo alimento e uma só medida "porção", ingrediente de outro usuário recusado sem gravar, apagar ingrediente/alimento/receita sem perder registros); **foto** (imagem de verdade vs. arquivo que finge, PDF, arquivo grande, sem comida, sem aceite, falha devolve a chamada, confiança limitada, origem do registro).

**Testes reais no Gemini:** o resumo semanal (7A) foi coberto na Fase 6 pelo mesmo mecanismo de números; para a foto (7C), uma imagem de prato (arroz, feijão, frango e salada) foi identificada corretamente, com gramas estimadas e confiança "média".

**Defeitos encontrados nos testes e corrigidos:**
1. **Apagar alimento usado em receita falharia**: as chaves geradas pelo Drizzle eram `NO ACTION`. Corrigidas na migration para `SET NULL` por coluna, e o teste cobre o caso. O schema foi mantido sem a ação para o Drizzle não gerar diff errado numa próxima migration (comentário no código).
2. **Texto da IA desatualizado**: se os registros da semana mudassem depois do resumo, o texto antigo continuaria aparecendo. Agora ele só aparece enquanto o hash dos números for o mesmo.
3. Dois testes do meu lado tinham expectativa velha (opções de meta unificadas; redirecionamento da exclusão); ajustados.

## 3. `npm audit`

Nenhum pacote novo na Fase 7. Igual às anteriores.

| | Moderadas | Altas |
|---|---|---|
| tudo | 4 | 5 |
| `--omit=dev` | 4 | 0 |

## 4. Segredos e código provisório

Busca por chaves, URLs de banco com senha, chaves privadas e tokens `kly_…` nos arquivos versionados: nada encontrado. Os logs da IA continuam só com contexto, tipo do erro e status. A foto do prato **não é guardada** em lugar nenhum (nem em banco, nem em armazenamento): é enviada ao Google apenas para a interpretação.

## 5. Regras não cumpridas ou parciais

1. **Foto de comida**: porção por foto é imprecisa. Mitigações: confiança nunca "alta", aviso fixo e reforçado na revisão ("de preferência pesando"), calorias sempre do banco, botões − e +, e nada é salvo sem o clique. **Risco residual:** a IA pode identificar mal um prato misto (ensopados, molhos); o app mostra o alimento escolhido e pede conferência, mas não impede um erro plausível.
2. **Foto vai ao Google** (plano gratuito: pode ser usada para melhorar produtos e lida por revisores). A tela mostra o que vai (a foto e a observação), diz para não fotografar documentos nem rostos, e a imagem perde a localização no próprio aparelho antes do envio. **Risco residual:** a pessoa pode, mesmo assim, fotografar algo sensível; o app não consegue detectar.
3. **Receitas**: os nutrientes de cada ingrediente são gravados na hora de salvar (snapshot); se a tabela mudar depois, a receita não muda sozinha (editar e salvar recalcula). Ingrediente sem alguns nutrientes deixa a receita com valores **parciais**, e a tela avisa.
4. **Resumo semanal**: números são estimativas e dependem do registro de comida e das pesagens; a tela avisa quando há poucos dias ou pesagens.
5. **Limites diários** (10 resumos, 10 fotos) são escolha minha, ajustáveis em `lib/ia/config.ts`.

## 6. Como testar no iPhone (depois do deploy)

1. **Progresso → Resumo da semana**: veja os números da semana, navegue entre semanas e toque em "Gerar resumo com a IA". Confira que o texto só cita números da tela.
2. **Comida → Receitas → Nova receita**: dê um nome, busque ingredientes (ou cole a lista para a IA preencher), ajuste as gramas, informe quantas porções rende (e o peso final, se pesou). Salve e use "Registrar no diário": a medida "porção" já existe.
3. **Comida → Adicionar → Registrar com IA → Foto do prato**: fotografe um prato, confira o que a IA listou e as gramas (− e +), troque o que estiver errado e salve.
4. Confira que a origem "ia_foto" aparece como qualquer registro e pode ser editado.

## 7. Pendências e próximos passos

- **Produção (precisa de aprovação):** aplicar as migrations 0012, 0013 e 0014 e fazer o deploy (migrations antes do push).
- **Fotos de progresso do corpo** (SPEC 3.8): ficaram de fora. Precisam de armazenamento **privado** de arquivos (por exemplo, Vercel Blob privado), URL assinada de curta duração, exclusão pelo usuário, limite de tamanho e revisão de privacidade própria.
- Conferir no aparelho: passo a passo do Atalhos (Fase 6) e câmera do código de barras (Fase 4).
- Base compartilhada entre usuários (comunidade), com moderação.
- Antigas: importar o backup do "Meu Treino"; e-mail próprio (SMTP) no Neon Auth; licenças do IBGE e do Open Food Facts antes de vender; plano pago do Gemini para uso comercial.
