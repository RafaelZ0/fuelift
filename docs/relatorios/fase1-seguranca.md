# FuelLift – Fase 1: relatório de segurança (seção 11 do SEGURANCA.md)

Data: 07/10/2026. Situação: código pronto e testado no branch `dev`. **Deploy ainda não feito** (15 commits locais, não enviados ao GitHub).

## 1. Rotas, Server Actions e endpoints

Não há Route Handlers que recebam dados (não existe `/api/*`). A API do Neon Auth não é exposta pelo app.

**Camadas de verificação de sessão**
- `proxy.ts`: só redireciona quem não tem cookie de sessão e gera o nonce da CSP. **Não é** a barreira de segurança.
- `exigirUsuario()` (`lib/auth/sessao.ts`): lê a sessão no servidor, recusa sessões anteriores à última troca de senha, exige acesso **aprovado** e devolve o `user_id`. É chamada em toda página e Server Action do app.
- `lib/dal/`: toda função exige um `user_id` em formato uuid e filtra **todas** as consultas por ele (`where user_id = ?`, inclusive em update e delete).
- Banco: o app usa o papel `fuelift_app` (só SELECT/INSERT/UPDATE/DELETE, sem acesso ao schema `neon_auth`). Os CHECKs repetem os limites do Zod.

### Páginas

| Rota | Sessão | Autorização |
|---|---|---|
| `/` | — | Só redireciona para `/hoje` |
| `/entrar`, `/entrar/cadastro`, `/entrar/verificar`, `/entrar/esqueci`, `/entrar/nova-senha` | Públicas (`/entrar` vai para `/hoje` se já houver sessão) | — |
| `/aguardando` | `exigirLogin()` | Mostra só o status do próprio usuário |
| `/hoje`, `/comida`, `/treino`, `/progresso` | `exigirUsuario()` no layout e na página | Acesso aprovado |
| `/ajustes` | `exigirUsuario()` | Dados do próprio `user_id`; "Cadastros pendentes" só para admin (`ADMIN_EMAILS` + e-mail confirmado) |
| `/manifest.webmanifest`, `/icon`, `/apple-icon`, `/icon-192.png`, `/icon-512.png`, `/icon-maskable.png` | Públicos | Conteúdo estático, sem dados (GET) |

### Server Actions (tratadas como endpoints públicos)

| Action | Sessão | Validação (Zod no servidor) | Autorização / limite |
|---|---|---|---|
| `entrar` | Pública | e-mail (≤254), senha (1–128) | 5/15 min por e-mail e 20/15 min por IP |
| `cadastrar` | Pública | nome (1–80), e-mail, senha (10–128) | 5/h por IP; resposta genérica (não revela e-mail existente) |
| `verificar` | Pública | e-mail, código de 6 dígitos | 5/15 min por e-mail e limite por IP |
| `reenviarCodigo` | Pública | e-mail | 3/h por e-mail e 5/h por IP; resposta sempre igual |
| `pedirCodigoSenha` | Pública | e-mail | 3/h por e-mail e 5/h por IP; resposta sempre igual |
| `redefinirSenha` | Pública | e-mail, código, senha (10–128), confirmação | 5/15 min por e-mail e limite por IP; ao trocar, encerra as outras sessões |
| `sair` | — | — | Encerra a sessão atual |
| `salvarPerfil` | `exigirUsuario()` | Esquema de perfil (mesmos limites do banco) | Só o perfil do `user_id` da sessão |
| `salvarMetas` | `exigirUsuario()` | Esquema de metas (mesmos limites do banco) | Só o `user_id` da sessão; cria a linha de hoje e preserva o histórico |
| `decidirCadastro` | `exigirAdmin()` | alvo = uuid, decisão = aprovar ou recusar | Só admin; o admin não altera o próprio acesso |

- Em nenhuma action o `user_id` vem do formulário. O único id recebido é o `alvo` do admin, validado como uuid.
- O Next.js confere o `Origin` das Server Actions automaticamente.

## 2. Testes

**Isolamento entre usuários (branch `test`, papel `fuelift_app`): 24 de 24 passaram.**
- A não lê dados de B: perfil, meta por id, histórico e meta vigente.
- A não altera dados de B: perfil, meta na mesma data, decisão de acesso.
- A não apaga dados de B: excluir com o id de B não apaga nada.
- Ids inválidos e chamadas sem `user_id` são barrados antes de consultar o banco.
- O histórico de metas é preservado, com uma linha por dia.
- CHECKs do banco recusam valores fora dos limites (10 casos).
- A troca de senha de A encerra só as sessões de A.

**Unitários: 54 de 54 passaram.** Cobrem os limites de validação de perfil, metas e login, as datas no fuso de São Paulo, o HMAC da tabela de limites e a regra de sessão após troca de senha.

**Teste manual (roteiro, feito por você no `dev`):** você informou que deu tudo certo.

**Simulação de sessão (branch `dev`, conta sintética criada e apagada no fim)**

| Cenário | Resultado |
|---|---|
| Sessão "de ontem" (recuada 25 h no banco) | Continua logado. O Neon Auth renovou a sessão sozinho: validade de mais **7 dias** a partir do acesso. |
| Sessão vencida | Logo após vencer, o app ainda abre por até 5 min (cache do Neon Auth). Depois vai para "Entrar". |
| Tela de login com sessão vencida | **Defeito encontrado e corrigido.** Antes, a tela mostrava "Algo deu errado." (o Next.js bloqueava a limpeza dos cookies dentro da página). Agora abre normalmente, e o login seguinte funciona com os cookies velhos ainda no navegador. |

## 3. `npm audit`

| | Moderadas | Altas | Críticas |
|---|---|---|---|
| `npm audit` (tudo) | 4 | 5 | 0 |
| `npm audit --omit=dev` | 4 | 0 | 0 |

- **Altas (5):** `braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next` e `eslint-config-next`. Ficam só na ferramenta de lint, usada em desenvolvimento.
- **Moderadas (4):** `esbuild` antigo, via `@esbuild-kit/*` e `drizzle-kit`. Afeta só o servidor de desenvolvimento do esbuild, que não é usado. Aparecem com `--omit=dev` porque o `better-auth` declara o `drizzle-kit` como dependência opcional. O rastreamento do build confirma que nenhum desses pacotes vai para o Vercel.
- **Não apliquei `npm audit fix --force`:** ele rebaixaria `eslint-config-next` e `drizzle-kit` para versões antigas e incompatíveis.

## 4. Segredos no código e no histórico

- **Código atual:** nenhuma URL com senha, chave ou token encontrada. O único `.env*` no git é o `.env.example`, sem valores.
- **Histórico (todos os commits):** nada encontrado.
- `.env.local`, `.env.test.local`, `.env.main.local` e `.vercel` estão no `.gitignore`.
- Nenhuma variável `NEXT_PUBLIC_`. Todo arquivo que lê segredo importa `server-only` (o `proxy.ts` só lê `NODE_ENV`).
- No Vercel, as variáveis secretas estão como "sensitive" (não podem ser lidas de volta). A `NEON_AUTH_BASE_URL` está como "config", porque é só um endereço.
- **Atenção:** os segredos de produção foram gerados no ambiente do Claude Code e não aparecem na conversa. Mesmo assim, por precaução, a troca manual antes do deploy está no seu plano (passo 4). Inclua a senha do `neondb_owner` do `production`.

## 5. Código provisório

- Nenhum TODO, rota de teste, usuário de teste, senha padrão ou bypass no código.
- Os usuários de teste existem só dentro dos testes automáticos (uuids aleatórios, apagados no fim de cada execução).
- A conta sintética da simulação foi apagada do `dev`: 0 usuários `simulacao-*` e 0 sessões dela.

## 6. Regras do SEGURANCA.md não cumpridas ou parciais

| Regra | Situação | Motivo / próximo passo |
|---|---|---|
| §5 Limitar tentativas de login | **Parcial** | O app limita tudo que passa por ele. Mas a Auth URL do Neon é um endpoint público: quem souber o endereço pode chamar o Neon direto, sem passar pelos limites do app. O endereço não vai para o navegador. A documentação do Neon só confirma limite para os códigos de e-mail, sem números. Risco residual baixo, aceito. |
| §5 IA, passos, importação | Não se aplica ainda | Fases futuras. |
| §3 Uploads | Não se aplica ainda | Fases futuras. |
| §2 Revogação imediata | **Parcial** | Uma sessão revogada ou vencida pode continuar valendo por até 5 min (cache do Neon Auth). Na troca de senha, o app fecha essa janela na hora. Na recusa de um cadastro, também (o app confere o status a cada acesso). |
| E-mails de autenticação em produção | **Pendente** | Hoje usa o provedor compartilhado do Neon, que tem limite de envio. O checklist de produção do Neon pede um provedor próprio (SMTP) antes de uso real. |
| §8 Pacote de auth atualizado | Atenção | `@neondatabase/auth` está em **0.5.0-beta**. O SDK tem um caminho errado para trocar senha (`email-otp/passcode`), contornado pelo kit de servidor oficial do pacote. Revisar a cada atualização. |

Todas as outras regras foram cumpridas: segredos, `server-only`, `user_id` só da sessão, `lib/dal/`, UUIDs, Zod no servidor, consultas parametrizadas, sem `dangerouslySetInnerHTML`, papel com permissão mínima, CHECKs, cabeçalhos de segurança, cookies, logs e páginas de erro genéricas.

**Cabeçalhos e cookies (§6), conferidos em resposta real:**
- CSP com nonce por requisição e `frame-ancestors 'none'`.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `Permissions-Policy` com câmera bloqueada.
- HSTS e `X-Frame-Options: DENY`.
- Cookies `__Secure-` com `HttpOnly` e `Secure` (código do pacote) e `SameSite=Lax` (configurado no app).

## 7. Observações operacionais

- **Lentidão:** um login no `dev` levou 16,6 s, e uma renovação do cache de sessão estourou o tempo limite uma vez. Parece instabilidade do Neon Auth. Vale observar em produção.
- **Proteção do Vercel:** o projeto está com "Vercel Authentication" em `all_except_custom_domains`. No primeiro deploy, confira se `fuellift.vercel.app` abre sem pedir login do Vercel. Se pedir, é preciso ajustar essa opção.
- **Logins abertos nesta máquina:** as ferramentas do Neon e do Vercel continuam logadas. Deslogue depois do deploy, se preferir.
- **MCP do Neon:** fica configurado no projeto (OAuth) e pede login no primeiro uso.

## 8. Como testar no iPhone (depois do deploy)

1. No Safari, abra `https://fuellift.vercel.app`, crie sua conta, digite o código e entre. Você é aprovado automaticamente como admin.
2. Toque em Compartilhar → **Adicionar à Tela de Início** e abra pelo ícone.
3. Confira:
   - o topo abaixo do notch;
   - a barra de 5 abas acima da barra inferior do iPhone;
   - o teclado numérico nos campos de metas;
   - nenhum campo com setinhas;
   - o padrão Editar → Salvar em Ajustes.
4. No dia seguinte, abra pelo ícone. Deve continuar logado (a sessão vale 7 dias e se renova a cada uso).

## 9. Pendências antes e depois do deploy

1. Você revisa este relatório.
2. Você troca os segredos de produção: senha do `fuelift_app` e do `neondb_owner` no `production` do Neon; `DATABASE_URL`, `NEON_AUTH_COOKIE_SECRET` e `LIMITES_HMAC_KEY` no Vercel Production.
3. Enviar os 15 commits ao GitHub. O Vercel publica em `fuellift.vercel.app`.
4. Conferir a proteção do Vercel e fazer o teste rápido de produção (login com senha errada deve mostrar "E-mail ou senha incorretos.").
5. Configurar um provedor de e-mail próprio no Neon Auth antes de uso real com outras pessoas.
6. Teste no iPhone (seção 8).
