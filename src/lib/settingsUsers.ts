import { supabase } from './supabase'
import type { Papel } from '../types'

export interface SettingsUserRow {
  id: string
  nome: string
  papel: Papel
  ativo: boolean
  email: string | null
  created_at: string
  updated_at: string
}

export const EDITABLE_PAPEIS_GESTOR: Papel[] = ['projetista', 'administrador', 'proprietario']

export const EDITABLE_PAPEIS_DIRETOR: Papel[] = [
  'gestor',
  'projetista',
  'administrador',
  'proprietario',
]

/** @deprecated use getEditablePapeisForActor */
export const EDITABLE_PAPEIS = EDITABLE_PAPEIS_GESTOR

export function getEditablePapeisForActor(actorPapel: Papel): Papel[] {
  if (actorPapel === 'diretor_executivo') return EDITABLE_PAPEIS_DIRETOR
  if (actorPapel === 'gestor') return EDITABLE_PAPEIS_GESTOR
  return []
}

export function isProtectedPapel(papel: Papel): boolean {
  return papel === 'diretor_executivo'
}

export function canActorEditUserPapel(actorPapel: Papel, targetPapel: Papel): boolean {
  if (isProtectedPapel(targetPapel)) return false
  return getEditablePapeisForActor(actorPapel).includes(targetPapel)
}

export function canActorAssignPapel(actorPapel: Papel, papel: Papel): boolean {
  if (isProtectedPapel(papel)) return false
  return getEditablePapeisForActor(actorPapel).includes(papel)
}

export function papelAvatarClass(papel: Papel): string {
  return `settings-user-avatar--${papel}`
}

export function buildProfileInsertSql(nome: string, papel: Papel, uuid: string): string {
  const safeNome = nome.replace(/'/g, "''")
  return `insert into profiles (id, nome, papel)\nvalues ('${uuid}', '${safeNome}', '${papel}');`
}

export async function fetchSettingsUsers(): Promise<SettingsUserRow[]> {
  const { data, error } = await supabase.rpc('list_profiles_with_email')

  if (error) throw new Error(error.message)

  return (data ?? []).map((row: Record<string, unknown>) => ({
    id: row.id as string,
    nome: row.nome as string,
    papel: row.papel as Papel,
    ativo: row.ativo as boolean,
    email: (row.email as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  }))
}

export async function updateUserPapel(userId: string, papel: Papel): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ papel, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw new Error(error.message)
}

export async function deactivateUser(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ ativo: false, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw new Error(error.message)
}

export async function createUserProfile(
  id: string,
  nome: string,
  papel: Papel,
): Promise<void> {
  const trimmedId = id.trim()
  const trimmedNome = nome.trim()

  if (!trimmedId) throw new Error('Informe o UUID do usuário.')
  if (!trimmedNome) throw new Error('Informe o nome do usuário.')

  const { error } = await supabase.from('profiles').insert({
    id: trimmedId,
    nome: trimmedNome,
    papel,
    ativo: true,
  })

  if (error) throw new Error(error.message)
}
