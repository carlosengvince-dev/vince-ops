/**
 * Testa se usuário autenticado consegue atualizar status de tarefa (RLS).
 *
 * Uso:
 *   node scripts/test-tarefas-rls.mjs <email> <senha>
 *
 * Requer VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (lê de .env.local).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')

function loadEnvLocal() {
  const path = resolve(root, '.env.local')
  const text = readFileSync(path, 'utf8')
  const env = {}
  for (const line of text.split('\n')) {
    const m = line.match(/^([^#=]+)=(.*)$/)
    if (m) env[m[1].trim()] = m[2].trim()
  }
  return env
}

const [email, password] = process.argv.slice(2)
if (!email || !password) {
  console.error('Uso: node scripts/test-tarefas-rls.mjs <email> <senha>')
  process.exit(1)
}

const env = loadEnvLocal()
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local')
  process.exit(1)
}

const supabase = createClient(url, anonKey)

const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
  email,
  password,
})

if (authError) {
  console.error('Login falhou:', authError.message)
  process.exit(1)
}

const userId = authData.user.id

const { data: profile, error: profileError } = await supabase
  .from('profiles')
  .select('nome, papel')
  .eq('id', userId)
  .single()

if (profileError) {
  console.error('Perfil:', profileError.message)
  process.exit(1)
}

console.log(`Logado como ${profile.nome} (${profile.papel})`)

const { data: tarefa, error: fetchError } = await supabase
  .from('tarefas')
  .select('id, nome, status')
  .is('deleted_at', null)
  .limit(1)
  .maybeSingle()

if (fetchError || !tarefa) {
  console.error('Nenhuma tarefa encontrada:', fetchError?.message ?? 'vazio')
  process.exit(1)
}

const originalStatus = tarefa.status
const testStatus = originalStatus === 'pendente' ? 'em_elaboracao' : 'pendente'

console.log(`Tarefa: ${tarefa.nome}`)
console.log(`Atualizando status: ${originalStatus} → ${testStatus}`)

const { error: updateError } = await supabase
  .from('tarefas')
  .update({
    status: testStatus,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  })
  .eq('id', tarefa.id)

if (updateError) {
  console.error('UPDATE bloqueado pelo RLS:', updateError.message)
  process.exit(1)
}

console.log('UPDATE OK — RLS permite atualização.')

const { error: revertError } = await supabase
  .from('tarefas')
  .update({
    status: originalStatus,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  })
  .eq('id', tarefa.id)

if (revertError) {
  console.warn('Aviso: não foi possível reverter status:', revertError.message)
} else {
  console.log('Status revertido ao original.')
}

await supabase.auth.signOut()
console.log('Teste concluído com sucesso.')
