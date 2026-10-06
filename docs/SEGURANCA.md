# Segurança – regras obrigatórias do FuelLift

O FuelLift guarda dados de saúde (peso, alimentação, medicação), que a LGPD trata como dados pessoais sensíveis. Estas regras valem para todas as fases. Se alguma não puder ser cumprida, pare e me explique o motivo antes de seguir.

As regras atacam as falhas mais comuns em apps gerados por IA: segredos expostos ou repetidos, controle de acesso ausente ou quebrado, entrada sem validação, falta de limite de requisições, código provisório esquecido e dependências inexistentes ou vulneráveis.

## 1. Segredos

- `.env*` no `.gitignore` antes do primeiro commit. Commitar só o `.env.example`, sem valores reais.
- Nenhum segredo com prefixo `NEXT_PUBLIC_`. Esse prefixo envia o valor para o navegador.
- Arquivos que usam segredos (banco, Gemini, auth) importam o pacote `server-only`, para o build falhar se forem parar no navegador.
- Nunca usar segredos de exemplo ("secret", "supersecretkey", "changeme"). Se precisar gerar um, use um gerador criptográfico e me diga para salvá-lo nas variáveis de ambiente.
- Nunca imprimir segredos em logs, mensagens de erro ou respostas.

## 2. Autenticação e autorização

- A verificação de login no `proxy.ts`/`middleware.ts` serve só para redirecionar. **Toda** Server Action, Route Handler e consulta de dados verifica a sessão de novo, no servidor. Já houve falha crítica no Next.js (CVE-2025-29927) que permitia pular o middleware.
- O `user_id` vem **sempre** da sessão no servidor, nunca de parâmetros, formulários, URL ou corpo da requisição.
- Todo acesso ao banco passa por uma camada de dados (`lib/dal/`). Cada função recebe o `user_id` da sessão e filtra por ele, inclusive em `update` e `delete` (`where id = ? and user_id = ?`).
- Ids de registros são UUID, não números sequenciais.
- Testes automatizados provando que o usuário A não consegue ler, alterar nem apagar dados do usuário B.
- Server Actions são endpoints públicos: tratar cada uma como uma API aberta (sessão + validação + autorização).

## 3. Validação de entrada

- Validar com Zod no servidor toda entrada vinda do cliente, da IA ou de APIs externas. A validação do formulário no navegador é só conforto, não segurança.
- Limites realistas: carga de 0 a 1.000 kg, peso corporal de 20 a 400 kg, calorias por item de 0 a 10.000, textos com tamanho máximo.
- Consultas sempre parametrizadas pelo ORM. Proibido montar SQL concatenando texto.
- Proibido `dangerouslySetInnerHTML`. Texto do usuário e da IA é exibido como texto puro.
- Uploads (fases futuras): validar tipo real e tamanho e renomear o arquivo.

## 4. Banco de dados

- Produção no branch `main` do Neon. Desenvolvimento e previews num branch separado.
- O app usa um papel (role) do Postgres com só as permissões necessárias. As migrations usam outro, com permissão de alterar o schema. **Verificar** na documentação do Neon como criar e usar os dois.
- `CHECK` constraints no banco reforçando os limites da seção 3.
- Nada de apagar ou recriar tabelas com dados sem me pedir confirmação.

## 5. Limite de requisições

- Limitar tentativas de login, chamadas à IA (por usuário e por dia), o endpoint de passos e a importação de backup.
- Solução gratuita: contador em tabela do Postgres. Não adicionar serviço pago.
- **Verificar** se o Neon Auth já limita tentativas de login, para não duplicar.

## 6. Cabeçalhos e cookies

- Configurar cabeçalhos de segurança: Content-Security-Policy, `frame-ancestors 'none'`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (câmera só quando chegar a fase de código de barras) e HSTS.
- Cookies de sessão `HttpOnly`, `Secure` e `SameSite`. Confirmar que o Neon Auth configura isso.
- Route Handlers que recebem POST com cookie conferem o cabeçalho `Origin`.

## 7. Erros e logs

- O usuário vê mensagens genéricas. Detalhes técnicos ficam só no log do servidor.
- Logs nunca contêm dados de saúde (peso, alimentos, medicação), e-mail, tokens ou senhas.

## 8. Dependências

- Antes de instalar um pacote, confirmar que ele existe no npm, é o oficial (nome exato, mantenedor, downloads) e é necessário. IAs às vezes inventam nomes de pacotes, e atacantes registram esses nomes com código malicioso.
- Preferir poucas dependências e bem conhecidas.
- Commitar o lockfile. Rodar `npm audit` ao fim de cada fase e me mostrar o resultado.
- Manter o Next.js e o pacote de auth atualizados com as correções de segurança.

## 9. IA (Gemini)

- Chamada só pelo servidor, com a chave em variável de ambiente.
- Enviar o mínimo necessário: nunca nome, e-mail ou id do usuário.
- A resposta da IA é dado não confiável: validar com Zod pelo esquema esperado e descartar o que não bater.
- A IA não executa ações. Ela só sugere itens, e o usuário confirma antes de salvar.
- Texto do usuário pode tentar manipular a IA (prompt injection). Separar claramente instruções e conteúdo do usuário no prompt e nunca dar à IA acesso a dados de outras pessoas.

## 10. Código provisório

- Proibido deixar TODO de segurança, rota de teste, usuário de teste, senha padrão ou bypass de login no código que vai para produção.
- Ao fim de cada fase, procurar e listar qualquer código provisório que tenha ficado.

## 11. Revisão ao fim de cada fase

Antes de eu fazer o deploy, entregar um relatório com:

1. Lista de rotas, Server Actions e endpoints, dizendo como cada um verifica sessão, valida entrada e autoriza.
2. Resultado dos testes de isolamento entre usuários.
3. Resultado do `npm audit`.
4. Busca por segredos no código e no histórico do git.
5. Qualquer item deste documento que não foi cumprido, com o motivo.
