# VINCE Ops — Função reutilizável: limpar todos os projetos (fase de testes)
> Execute a migration UMA VEZ. Depois disso, "limpar tudo" vira um comando
> só, para sempre — sem precisar copiar SQL de novo.

---

## ⚠️ Leia antes de usar

Esta função apaga **TODOS os projetos ativos**, sem distinguir teste de
real. É para ser usada **enquanto você ainda está testando** a ferramenta.

**No dia em que lançar o primeiro projeto real: pare de usar esta função.**
Ela continua existindo no banco, mas não deve mais ser chamada — rodar ela
depois de ter projetos reais apagaria tudo, inclusive o que é de verdade.

---

## PASSO 0 — Criar a função (rodar uma vez só)

```sql
create or replace function public.limpar_todos_projetos(p_confirmar text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_projetos int;
  v_tarefas int;
begin
  perform public.assert_papel(array['gestor','diretor_executivo']);

  if p_confirmar <> 'CONFIRMO LIMPEZA TOTAL' then
    raise exception 'Confirmação inválida. Chame com: select limpar_todos_projetos(''CONFIRMO LIMPEZA TOTAL'');';
  end if;

  update comentarios set deleted_at = now()
  where deleted_at is null and tarefa_id in (
    select id from tarefas where projeto_id in (select id from projetos where deleted_at is null)
  );

  update registros_tempo set deleted_at = now()
  where deleted_at is null and tarefa_id in (
    select id from tarefas where projeto_id in (select id from projetos where deleted_at is null)
  );

  update chat_mensagens set deleted_at = now()
  where deleted_at is null and projeto_id in (select id from projetos where deleted_at is null);

  update pendencias_externas set deleted_at = now()
  where deleted_at is null and projeto_id in (select id from projetos where deleted_at is null);

  update revisoes set deleted_at = now()
  where deleted_at is null and projeto_id in (select id from projetos where deleted_at is null);

  update documentos_projeto set deleted_at = now()
  where deleted_at is null and projeto_id in (select id from projetos where deleted_at is null);

  -- Tabelas sem soft delete — apagadas de vez (são só log/histórico)
  delete from liberacoes_fase
  where projeto_id in (select id from projetos where deleted_at is null);

  delete from activity_log
  where projeto_id in (select id from projetos where deleted_at is null);

  update tarefas set deleted_at = now()
  where deleted_at is null and projeto_id in (select id from projetos where deleted_at is null);
  get diagnostics v_tarefas = row_count;

  delete from projeto_fases
  where projeto_id in (select id from projetos where deleted_at is null);

  delete from config_snapshots where automatico = true;

  update projetos set deleted_at = now() where deleted_at is null;
  get diagnostics v_projetos = row_count;

  alter sequence if exists projetos_numero_sequencial_seq restart with 1;

  return jsonb_build_object(
    'projetos_removidos', v_projetos,
    'tarefas_removidas', v_tarefas
  );
end;
$$;
```

---

## A partir de agora — sempre que quiser limpar

Um comando só, sempre que precisar (enquanto ainda for fase de testes):

```sql
select limpar_todos_projetos('CONFIRMO LIMPEZA TOTAL');
```

Retorna algo como:
```json
{"projetos_removidos": 3, "tarefas_removidas": 47}
```

Se você chamar sem o texto de confirmação exato (ou digitar errado), a
função recusa e não apaga nada — trava de segurança contra clique/execução
acidental.

---

## O que NÃO é tocado

- `templates_checklist`, `categorias_config`, `fases_config`,
  `disciplinas_config` — toda a estrutura do HID e PPCI
- `configuracoes` — tipos de edificação, documentos padrão etc.
- `config_snapshots` manuais (só os automáticos de teste são removidos)
- `profiles` — usuários e papéis continuam intactos
- `clientes` — não é afetado (se quiser limpar clientes de teste também,
  me avisa que preparo uma função separada, já que clientes reais e de
  teste costumam se misturar mais)

---

## Quando parar de usar

No dia em que o primeiro projeto real for lançado no sistema, considere
esta função "aposentada". Se quiser reforçar essa trava tecnicamente
(impedir execução de vez), me avisa nesse momento que preparo o comando
para remover a função do banco.
