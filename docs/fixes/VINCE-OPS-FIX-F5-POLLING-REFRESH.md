# VINCE Ops — Fix F5 + Polling do checklist + Botão de refresh
> Sem migration necessária — mudanças só de frontend.
> Três prompts, pode mandar juntos numa sessão só de Cursor.

---

## PROMPT 1 — Fix crítico: F5 jogando pra Home

```
Bug crítico: F5 dentro de um projeto redireciona para a Home, 
perdendo a navegação profunda (aba, disciplina, fase, tarefa expandida).

Causa provável: durante o F5, o app remonta do zero e a sessão 
de autenticação leva ~1s para resolver. Algum componente de 
rota protegida provavelmente verifica "usuário autenticado?" 
e redireciona para '/' ANTES da sessão terminar de carregar, 
descartando a URL original mesmo que o usuário esteja de fato 
logado.

Corrigir no componente de rota protegida (ProtectedRoute ou 
equivalente):
- Enquanto loading === true (sessão ainda resolvendo): 
  NÃO redirecionar para lugar nenhum — mostrar apenas o 
  PageLoader/skeleton já existente no lugar do conteúdo
- Só redirecionar para /login quando loading === false 
  E não houver sessão confirmada
- Não deve existir nenhum caminho que redirecione para '/' 
  (home) como parte da checagem de autenticação — o único 
  destino de "não autenticado" é /login

Verificar também: se existir qualquer lógica que reseta 
useSearchParams ou zera o estado de navegação durante o 
boot/remontagem do AuthProvider, remover — os parâmetros 
da URL (?aba=&disc=&fase=&tarefa=) devem ser lidos como 
fonte de verdade no primeiro render de ProjectDetail, 
independente de quando a sessão termina de carregar.

npm run build deve passar.
Testar: abrir um projeto em fase específica com uma tarefa 
expandida → F5 → deve permanecer exatamente na mesma tela, 
mesma aba, mesma fase, mesma tarefa expandida.
```

---

## PROMPT 2 — Polling no checklist (refletir mudanças de outros usuários)

```
Checklist do projeto não reflete mudanças feitas por outros 
usuários em tempo real — só atualiza com F5 ou saindo e 
voltando na tela. Timer e chat já têm esse comportamento 
(polling 30s); estender o mesmo padrão para o checklist.

Implementar em ChecklistPanel (ou hook equivalente):

1. A cada 25-30s, refetch das tarefas do projeto/fase/disciplina 
   ativos (mesma query já usada no carregamento inicial)

2. Merge inteligente ao aplicar o resultado:
   - Atualizar campos que mudaram: status, responsavel_id, 
     motivo_bloqueio, data_conclusao, updated_at
   - NÃO resetar scroll da página
   - NÃO fechar painéis de comentário que estejam abertos
   - NÃO interromper edição em andamento em algum campo de texto
   - Se uma tarefa está com timer ativo do usuário atual: 
     não deixar o polling sobrescrever/piscar o cronômetro visual

3. Pausar o polling quando a aba do navegador estiver em 
   background (usar visibilitychange) — retomar ao voltar o foco,
   com um fetch imediato ao retomar (não esperar o próximo ciclo)

4. Indicador visual discreto (reaproveitar o padrão já usado 
   no header para "sincronizando"): pequeno ícone ao lado do 
   nome da fase, visível só durante o fetch

npm run build deve passar.
Testar: dois navegadores logados como usuários diferentes 
no mesmo projeto — um muda status de uma tarefa, o outro 
deve ver a mudança em até 30s sem fazer nada, sem perder 
scroll ou fechar nada que estava aberto.
```

---

## PROMPT 3 — Botão de refresh manual no checklist

```
Adicionar botão de atualização manual no checklist, 
complementar ao polling automático (Prompt 2) — permite 
atualizar na hora sem esperar o próximo ciclo.

- Ícone de refresh (Lucide RefreshCw) no cabeçalho do painel 
  de checklist, próximo ao nome da fase/disciplina ativa
- Ao clicar: dispara o mesmo refetch usado no polling, 
  imediatamente
- Feedback visual: ícone gira durante o fetch (animação CSS 
  simples), disabled enquanto carrega para evitar duplo clique
- IMPORTANTE: isso não é um F5 — não recarrega a página, 
  não perde estado de navegação, não fecha comentários 
  abertos, não interrompe timer ativo. É só um refetch de dados.

npm run build deve passar.
Testar: clicar no botão → tarefas atualizam na tela → 
nenhuma outra parte da interface é afetada.
```
