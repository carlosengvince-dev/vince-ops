import { supabase } from './supabase'

export async function updateOwnProfileNome(userId: string, nome: string): Promise<void> {
  const trimmed = nome.trim()
  if (!trimmed) throw new Error('Informe um nome válido.')

  const { error } = await supabase
    .from('profiles')
    .update({ nome: trimmed, updated_at: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw new Error(error.message)
}

export async function requestEmailChange(newEmail: string): Promise<void> {
  const trimmed = newEmail.trim().toLowerCase()
  if (!trimmed) throw new Error('Informe o novo e-mail.')

  const { error } = await supabase.auth.updateUser({ email: trimmed })
  if (error) throw new Error(error.message)
}

export async function updateOwnPassword(newPassword: string): Promise<void> {
  if (newPassword.length < 8) {
    throw new Error('A senha deve ter no mínimo 8 caracteres.')
  }

  const { error } = await supabase.auth.updateUser({ password: newPassword })
  if (error) throw new Error(error.message)
}
