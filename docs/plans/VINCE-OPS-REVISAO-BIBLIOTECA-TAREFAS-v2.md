# VINCE Ops — Revisão do plano "Task library flexibility" (v2)
> Base confirmada via relatório de estado (30/07/2026): Recebimento,
> Desativar fases na criação, RT/ART e o fix de flash/F5 estão TODOS
> prontos e em produção. A plataforma está estável — pode avançar.

---

## Correção da v1

O ponto que eu havia levantado sobre "a premissa do plano está errada,
as outras frentes não estão prontas" **estava incorreto** — elas já
estavam, sim, concluídas quando o plano foi escrito. Retirado. A lógica
de risco original do próprio plano ("não competir com estabilização")
está satisfeita: a estabilização já aconteceu.

**Conclusão prática:** dá pra avançar com a Fase 0-1 (biblioteca com
lista filtrável) sem esperar mais nada.

---

## 1. Toda RPC nova segue o padrão já estabelecido

Para `promote_tarefa_to_template`, `relink_tarefa_template` e
`apply_template_to_projetos` (esta última só na Fase 3, mais adiante):

- `security definer` + `perform assert_papel(array[...])`
- `grant execute ... to authenticated` — já esquecemos isso 2x neste
  projeto, gerou erro silencioso nas duas vezes
- Testar a RPC isolada (SQL direto) antes de plugar na UI

---

## 2. Deduplicação por nome precisa ser mais robusta

"Avisar se já existe template com mesmo nome+disciplina+fase" — usar
comparação case-insensitive e com trim (ignorar espaços nas pontas).
Já fomos mordidos por variação de acento/maiúscula gerando duplicata
mais de uma vez neste projeto (ex.: o caso "Enquadramento" vs "PCI -
Enquadramento"). Se for viável, avisar também em nomes muito parecidos,
não só idênticos.

---

## 3. Confirmar isolamento de projetos concluídos/cancelados

Nenhuma ação nova (promover, religar, aplicar sync) deve ter efeito ou
estar disponível em projetos com status `concluido`/`cancelado` — eles
já usam modo leitura + retrato congelado (snapshot). Confirmar
explicitamente isso na implementação, não assumir que "não vai
acontecer porque ninguém vai tentar".

---

## 4. Contador de uso não pode ser N+1

"N projetos ativos com template_id = este" precisa vir de uma única
query agregada (GROUP BY), não de subconsulta por linha — já são 437+
tarefas de template entre HID e PPCI, crescendo.

---

## 5. Métrica extra útil pra Fase 0

Adicionar ao inventário inicial: quantas tarefas em projetos ativos têm
`template_id` apontando pra um template já excluído (órfãs). Isso
dimensiona o problema real antes de desenhar a Fase 2 (religar).

---

## 6. Rename "Templates de checklist" → "Biblioteca de tarefas" é decisão sua

Não é chamada técnica do Cursor tomar sozinho. Você decide se troca o
rótulo ou só adiciona a visão em lista mantendo o nome atual.

---

## Recomendação final

**Pode aprovar Fase 0 + Fase 1** (inventário + lista filtrável em
Configurações) agora — baixo risco, sem migration obrigatória, base do
sistema está sólida. A Fase 2 (promover/religar) entra na sequência
natural depois, sem precisar de mais nenhuma espera.

A Fase 3 (sync catálogo → projetos ativos) continua sendo a parte mais
arriscada do roadmap inteiro — só considerar depois de Fase 1-2
validadas em uso real por algumas semanas.
