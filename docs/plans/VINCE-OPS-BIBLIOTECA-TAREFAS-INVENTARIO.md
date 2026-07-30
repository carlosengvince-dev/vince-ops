# Biblioteca de Tarefas — Inventário (Fase 0) + Sync ME

Data inventário inicial: 2026-07-30  
Sync piloto ME → catálogo: 2026-07-30  
Fonte: Supabase produção `hmjppouvwhjxxwgnxppz`  
Migration: `supabase/migrations/030_sync_templates_from_me.sql`  
Piloto: `ME` / MARINO ESTALEIRO (`5738da74-39b9-4098-adb8-49fafac2a9f6`)

## Modelo (catálogo vs instância)

| Camada | Tabela | Onde | Comportamento |
|--------|--------|------|---------------|
| Catálogo | `templates_checklist` | Configurações → Templates → Templates de checklist | Padrão para *próximos* imports |
| Instância | `tarefas` | Checklist do projeto | Snapshot; edições locais **não** alteram a biblioteca |

**Exceção por projeto:** editar nome/descrição/criticidade/fase/ordem numa tarefa fica só naquele projeto. Não criamos “variação” na biblioteca. Biblioteca só muda com ação explícita (sync do piloto, UI futura “Promover / Empurrar”, ou edição em Configurações).

**Sync catálogo → projetos existentes:** não automático (Fase 3, se algum dia).

## Métricas pré-sync (Fase 0)

| Métrica | Valor |
|---------|------:|
| Templates vivos | 441 |
| Templates ativos | 441 |
| Templates inativos | 0 |
| Templates HID / PPCI | 255 / 186 |
| Manuais em projetos ativo/em_revisão | 3 |
| Órfãs (template excluído) | 1 |

## Sync ME → biblioteca (executado)

RPC interna `_sync_templates_from_projeto_impl` + wrapper `sync_templates_from_projeto` (assert gestor/diretor + GRANT).

| Resultado pós-sync | Valor |
|--------------------|------:|
| Tarefas ME | 433 |
| Manuais ME | **0** (todas religadas) |
| Divergências conteúdo ME ↔ template | **0** |
| Templates ativos HID+PPCI sem uso no ME | **0** |
| Templates ativos HID+PPCI | **433** |
| Templates inativos HID+PPCI | **10** (itens que o ME removeu; ETE etc.) |
| Tarefas ORO (intactas) | 436 |
| Tarefas EHP/Escala (intactas) | 30 |

Promovidos/religados no ME: `ETAC - Consumo`, `VIABILIDADE - Formulário`, `VIABILIDADE - Protocolo`.  
`ETE - Aplicabilidade` (e demais EP removidos no ME) ficaram **inativos** no catálogo — não entram em `fetchActiveTemplates` / criação nova.

## Implicações

- Novos projetos bebem do padrão ME.
- ORO / Escala / demais existentes permanecem com seus snapshots.
- Rótulo da aba permanece **"Templates de checklist"** até decisão explícita de rename.
