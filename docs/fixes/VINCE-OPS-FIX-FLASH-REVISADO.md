# VINCE Ops — Fix definitivo do flash "Carregando..." (revisado)
> Diagnóstico e solução base do Cursor: CORRETOS, sem alteração.
> 4 reforços adicionados abaixo antes de aprovar a execução.

---

## Diagnóstico (mantido, sem mudança)

`TOKEN_REFRESHED` dispara ao recuperar o foco do navegador. O
`onAuthStateChange` liga `profileLoading=true` para qualquer evento com
usuário — inclusive esse. O `useEffect` que desliga esse flag só reage a
mudança de `user.id`, que não muda num refresh de token. Resultado:
`profileLoading` fica preso ligado (ou pisca), os guards de rota
(`ProtectedRoute`/`PermittedRoute`) desmontam a árvore inteira e mostram
"Carregando...", perdendo scroll e qualquer estado que não esteja na URL.

## Solução base (mantida, sem mudança)

### 1. `useAuth.tsx`
- Continuar atualizando `session` em todo evento, incluindo `TOKEN_REFRESHED`
- **Não** chamar `setProfileLoading(true)` em `TOKEN_REFRESHED`, nem em
  qualquer refresh onde já existe `profile` para o mesmo `user.id`
- Só ligar `profileLoading` em boot / login / troca de usuário real
  (`INITIAL_SESSION`, `SIGNED_IN` sem profile ainda, ou `user.id` diferente)
- Manter o failsafe de timeout já existente

### 2. `ProtectedRoute.tsx` e `PermittedRoute.tsx`
- Trocar o gate de `if (loading || profileLoading)` para
  `if ((loading || profileLoading) && !profile)`
- Um refresh de token em segundo plano nunca mais troca a árvore
  inteira por "Carregando..." se já existe um profile carregado

---

## 4 reforços adicionados (novo)

### Reforço 1 — Garantir que `session` nunca passa por um estado nulo
Ao processar `TOKEN_REFRESHED`, confirmar que o código faz
`setSession(novaSession)` diretamente, num único passo — **nunca**
`setSession(null)` seguido de `setSession(novaSession)` logo em seguida.
Se houver esse padrão de "limpar e repor", qualquer componente que
renderize durante essa janela (por menor que seja) pode interpretar como
"deslogado" momentaneamente e disparar redirecionamentos indevidos.

### Reforço 2 — Polling do checklist não deve tratar refresh de token como falha
O polling do checklist (`visibilitychange` em `useProjectDetail.ts`) e o
refresh automático de token do Supabase disparam pelo mesmo gatilho:
o navegador recuperando o foco. Se os dois competirem, o fetch do
checklist pode acontecer no meio da troca de token e receber um erro
transitório de autenticação.
Confirmar que esse fetch trata erro de auth transitório com um retry
silencioso (uma nova tentativa após ~1s), em vez de propagar como falha
visível ao usuário.

### Reforço 3 — Teste explícito de troca real de usuário
A correção depende de comparar `user.id` para decidir se é "refresh do
mesmo usuário" ou "usuário diferente". É essencial validar que o caso
oposto ainda funciona: logout de um usuário → login de outro usuário
diferente, no mesmo navegador → deve mostrar "Carregando..." normalmente
e buscar o profile novo corretamente. Esse é o caso que a otimização
poderia quebrar por engano se a comparação de `user.id` tiver alguma
falha sutil.

### Reforço 4 — Regressão do fix de F5 anterior
Como esses mesmos componentes (`ProtectedRoute`/`PermittedRoute`) foram
alterados na sessão anterior para resolver o bug de F5 jogando para a
Home, validar explicitamente que aquele comportamento continua correto
depois desta mudança: F5 numa URL profunda (`/projetos/:id?aba=...`)
deve permanecer exatamente na mesma tela, sem redirecionar para
`/login` nem para a Home antes da sessão terminar de resolver.

---

## O que não mexer (mantido do plano original)
- Polling do checklist (lógica de merge está correta)
- Cache / `initialLoading` de `useProjectDetail`
- Query params de abas (`aba`/`disc`/`fase`) — já resolvem remontagem real

---

## Validação completa (original + reforços)

1. Abrir um projeto, navegar para outra aba/fase, rolar o checklist
2. Minimizar o navegador (ou trocar de app) por alguns segundos e voltar
   → esperado: zero tela "Carregando...", mesma aba/fase/scroll, sync
   discreto do checklist ok
3. F5 na URL profunda `/projetos/:id?...` → deve permanecer na mesma
   tela, sem redirecionar cedo demais (regressão do fix anterior)
4. Logout → login com usuário diferente → deve mostrar "Carregando..."
   normalmente e carregar o profile correto do novo usuário
5. Minimizar durante um refresh do checklist em andamento → sem erro
   visível, sem tela de falha
6. `npm run build` deve passar
