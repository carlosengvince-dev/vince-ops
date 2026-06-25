import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import {
  DEFAULT_TIPOS_EDIFICACAO,
  fetchConfiguracaoLista,
  saveConfiguracao,
} from '../../lib/configuracoes'
import { SortableStringList } from './SortableStringList'
import './SettingsSubsection.css'

export function TiposEdificacaoSection() {
  const { profile } = useAuth()
  const [items, setItems] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchConfiguracaoLista('tipos_edificacao', DEFAULT_TIPOS_EDIFICACAO))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function persist(next: string[]) {
    setSaving(true)
    setError(null)
    try {
      await saveConfiguracao('tipos_edificacao', next, profile?.id)
      setItems(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
      await load()
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="settings-subsection">
      <header className="settings-subsection__head">
        <div>
          <h2 className="settings-subsection__title">Tipos de edificação</h2>
          <p className="settings-subsection__hint">
            Opções do campo Finalidade na Home do projeto.
          </p>
        </div>
      </header>

      {error ? <p className="settings-subsection__error">{error}</p> : null}
      {loading ? <p className="settings-subsection__status">Carregando…</p> : null}

      {!loading ? (
        <SortableStringList items={items} onChange={(next) => void persist(next)} addLabel="Novo tipo" />
      ) : null}
      {saving ? <p className="settings-subsection__status">Salvando…</p> : null}
    </section>
  )
}
