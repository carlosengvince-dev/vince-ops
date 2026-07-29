import { supabase } from './supabase'
import type { ResponsavelTecnico } from '../types'

export interface UpsertResponsavelTecnicoParams {
  id?: string | null
  nome: string
  documento?: string | null
  registro?: string | null
  ativo?: boolean
}

export async function fetchResponsaveisTecnicosAtivos(): Promise<ResponsavelTecnico[]> {
  const { data, error } = await supabase
    .from('responsaveis_tecnicos')
    .select('*')
    .is('deleted_at', null)
    .eq('ativo', true)
    .order('nome', { ascending: true })

  if (error) throw new Error(error.message)
  return (data ?? []) as ResponsavelTecnico[]
}

export async function fetchResponsavelTecnicoById(
  id: string,
): Promise<ResponsavelTecnico | null> {
  const { data, error } = await supabase
    .from('responsaveis_tecnicos')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return (data as ResponsavelTecnico | null) ?? null
}

export async function upsertResponsavelTecnicoRpc(
  params: UpsertResponsavelTecnicoParams,
): Promise<string> {
  const { data, error } = await supabase.rpc('upsert_responsavel_tecnico', {
    p_id: params.id ?? null,
    p_nome: params.nome.trim(),
    p_documento: params.documento?.trim() || null,
    p_registro: params.registro?.trim() || null,
    p_ativo: params.ativo ?? true,
  })

  if (error) throw new Error(error.message)
  if (!data) throw new Error('upsert_responsavel_tecnico não retornou id')
  return data as string
}

/** Desativa RT (ativo=false). Soft-delete via delete_responsavel_tecnico fica só no banco nesta v1. */
export async function deactivateResponsavelTecnico(rt: ResponsavelTecnico): Promise<void> {
  await upsertResponsavelTecnicoRpc({
    id: rt.id,
    nome: rt.nome,
    documento: rt.documento,
    registro: rt.registro,
    ativo: false,
  })
}
