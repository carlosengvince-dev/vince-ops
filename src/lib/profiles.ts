import { supabase } from './supabase'
import type { Papel } from '../types'

export interface ActiveProfile {
  id: string
  nome: string
  papel: Papel
}

export async function fetchActiveProfiles(): Promise<ActiveProfile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, nome, papel')
    .eq('ativo', true)
    .order('nome', { ascending: true })

  if (error) throw new Error(error.message)

  return (data ?? []) as ActiveProfile[]
}
