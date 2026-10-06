# Fase 1 – roteiro de teste manual (login real)

Ambiente: sua máquina, branch `dev` do Neon. Anote em cada passo: **OK** ou **FALHOU** + o que apareceu na tela (sem colar senhas ou códigos).

Preparação:
- `.env.local` (dev) e migrations: já prontos. O admin é `zoppe@outlook.com.br`.
- O branch `dev` começa sem nenhum usuário.
- Duas contas de e-mail. No Outlook, dá para usar o mesmo endereço com sufixo: `seuemail+teste@outlook.com.br` chega na mesma caixa.
- Rode o app (o `.env.local` já aponta para o branch `dev`):

```bash
npm run dev
```

Abra `http://localhost:3000` no **Chrome** (o Chrome aceita os cookies de sessão em localhost; o Safari não, sem HTTPS).

## A. Conta do administrador (e-mail principal)

1. Sem login, abra `http://localhost:3000/ajustes`. **Esperado:** vai para "Entrar".
2. "Criar conta": nome, e-mail principal, senha com 9 caracteres. **Esperado:** "A senha precisa ter pelo menos 10 caracteres."
3. Repita com senha de 10+ caracteres. **Esperado:** vai para "Confirme seu e-mail".
4. Digite um código errado (ex.: 000000). **Esperado:** "Código inválido ou vencido."
5. Digite o código que chegou no e-mail. **Esperado:** "E-mail confirmado. Agora é só entrar."
6. Entre com e-mail e senha. **Esperado:** abre "Hoje", com a barra de 5 abas embaixo. Você é aprovado automaticamente por estar em `ADMIN_EMAILS`.
7. Toque em cada aba. **Esperado:** Hoje, Comida, Treino e Progresso mostram "em breve". Ajustes tem conteúdo.

## B. Ajustes

8. Perfil → "Editar". Altura `99`, Salvar. **Esperado:** "Altura: mínimo 100." e continua em edição.
9. Preencha nome, nascimento, sexo, altura `175,5`, atividade e início do plano. Salvar. **Esperado:** "Perfil salvo." e volta ao modo leitura, com "175,5 cm".
10. Metas → "Editar". Calorias `499`. **Esperado:** "Calorias: mínimo 500."
11. Calorias `1800`, proteína `150`, água `3000`. Salvar. **Esperado:** "Metas salvas a partir de hoje." e "Em vigor desde <hoje>".
12. Edite de novo (calorias `1900`) e salve. **Esperado:** mostra 1900. O histórico **não** ganha uma segunda linha de hoje.
13. Confira que os campos numéricos não têm setinhas e que o teclado do celular (se testar no iPhone) é numérico.
14. Recarregue a página. **Esperado:** os dados continuam lá.

## C. Segunda conta e aprovação

15. "Sair da conta". **Esperado:** volta para "Entrar". Abrir `/ajustes` leva de novo para "Entrar".
16. Crie a segunda conta (`+teste`), confirme o código e entre. **Esperado:** tela "Quase lá… aguardando aprovação". Tentar abrir `/ajustes` ou `/hoje` volta para essa tela.
17. Saia e entre com a conta principal. Ajustes → "Cadastros pendentes". **Esperado:** aparece o e-mail `+teste`. Toque em **Aprovar**.
18. Saia e entre com a conta `+teste`. **Esperado:** abre "Hoje". Em Ajustes, **não** aparece "Cadastros pendentes", e perfil e metas estão vazios (não aparecem os dados da conta principal).

## D. Recuperação de senha e encerramento de sessões

Use duas janelas: uma normal e uma anônima.

19. Na janela **anônima**, entre com a conta `+teste` e deixe aberta em Ajustes.
20. Na janela **normal** (sem login): "Esqueci a senha", e-mail `+teste`. **Esperado:** vai para "Nova senha", e o código chega no e-mail.
21. Código errado + senha nova. **Esperado:** "Código inválido ou vencido."
22. Senha e confirmação diferentes. **Esperado:** "As senhas não são iguais."
23. Código certo + senha nova válida. **Esperado:** entra direto em "Hoje" (ou mostra "Senha alterada. Entre com a senha nova."). **Anote qual dos dois.**
24. Volte à janela **anônima** e recarregue Ajustes. **Esperado:** vai para "Entrar" (a sessão antiga foi encerrada).
25. Na anônima, entre com a senha **antiga**. **Esperado:** "E-mail ou senha incorretos." Com a senha **nova**: entra.
26. "Esqueci a senha" com um e-mail que não tem conta. **Esperado:** mesma tela de "Nova senha" (não revela se a conta existe).

## E. Limite de tentativas

27. Saia. Em "Entrar", use o e-mail principal com senha errada **6 vezes**. **Esperado:** da 1ª à 5ª, "E-mail ou senha incorretos."; na 6ª, "Muitas tentativas. Espere alguns minutos e tente de novo."
28. Logo em seguida, tente com a senha **certa**. **Esperado:** continua bloqueado (o bloqueio dura até 15 minutos).
29. "Esqueci a senha" com o mesmo e-mail **4 vezes**. **Esperado:** na 4ª, "Muitas tentativas…".
30. Depois de 15 minutos, entre com a senha certa. **Esperado:** entra.

## F. Ao terminar

31. Me devolva a lista de OK / FALHOU e o que apareceu nos passos que falharam.
32. Não apague as contas: eu uso a conta `+teste` para a simulação da sessão "no dia seguinte" no branch dev.
