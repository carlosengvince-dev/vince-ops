# Biblioteca de Tarefas — Inventário (Fase 0)

Data: 2026-07-30  
Fonte: Supabase produção `hmjppouvwhjxxwgnxppz`  
Guia de revisão: `D:\VINCE\docs\VINCE-OPS-REVISAO-BIBLIOTECA-TAREFAS-v2.md`

## Modelo (catálogo vs instância)

| Camada | Tabela | Onde | Comportamento |
|--------|--------|------|---------------|
| Catálogo | `templates_checklist` | Configurações → Templates → Templates de checklist | Editável; base do *próximo* import |
| Instância | `tarefas` | Checklist do projeto | Snapshot com `template_id` opcional; status/responsável locais |

Editar o catálogo **não** atualiza projetos já criados (snapshot). Sync para projetos ativos fica para Fase 3 (explícito).

## Métricas (snapshot)

| Métrica | Valor |
|---------|------:|
| Templates vivos (`deleted_at` null) | 441 |
| Templates ativos | 441 |
| Templates inativos | 0 |
| Templates HID | 255 |
| Templates PPCI | 186 |
| Tarefas manuais (`template_id` null) em projetos ativo/em_revisão | 3 |
| Tarefas órfãs (`template_id` aponta a template excluído) em projetos ativo/em_revisão | **1** |
| Templates com uso em ≥1 projeto ativo/em_revisão | 436 |
| Pares (template × projeto) com vínculo | 896 |

## Implicações para Fase 2+

- Órfãs (1 hoje) e manuais (3) dimensionam a urgência de **religar / promover** — baixo volume agora, mas o mecanismo importa.
- Contador de uso na UI deve ser **agregado (GROUP BY)**, nunca N+1 por linha.
- Rótulo da aba permanece **"Templates de checklist"** até decisão explícita de rename (V2 §6).
