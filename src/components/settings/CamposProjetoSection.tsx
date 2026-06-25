import { useCallback, useEffect, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import {
  type CampoProjetoCustom,
  fetchCamposProjetoCustom,
  saveCamposProjetoCustom,
} from '../../lib/camposProjetoConfig'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import './CamposProjetoSection.css'
import './SettingsSubsection.css'

const SECAO_OPTIONS: { value: CampoProjetoCustom['secao']; label: string }[] = [
  { value: 'empreendimento', label: 'Empreendimento' },
  { value: 'projeto', label: 'Projeto' },
  { value: 'especificidades', label: 'Especificidades' },
]

const TIPO_OPTIONS: { value: CampoProjetoCustom['tipo']; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'date', label: 'Data' },
  { value: 'select', label: 'Seleção' },
]

function newId() {
  return `campo_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

const EMPTY: CampoProjetoCustom = {
  id: '',
  nome: '',
  tipo: 'text',
  secao: 'empreendimento',
  ativo: true,
  opcoes: [],
}

export function CamposProjetoSection() {
  const { profile } = useAuth()
  const [items, setItems] = useState<CampoProjetoCustom[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState<CampoProjetoCustom>(EMPTY)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setItems(await fetchCamposProjetoCustom())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function persist(next: CampoProjetoCustom[]) {
    setSaving(true)
    setError(null)
    try {
      await saveCamposProjetoCustom(next, profile?.id)
      setItems(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  function openCreate() {
    setDraft({ ...EMPTY, id: newId() })
    setModalOpen(true)
  }

  function openEdit(campo: CampoProjetoCustom) {
    setDraft({ ...campo, opcoes: campo.opcoes ? [...campo.opcoes] : [] })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!draft.nome.trim()) return
    const campo: CampoProjetoCustom = {
      ...draft,
      nome: draft.nome.trim(),
      opcoes:
        draft.tipo === 'select'
          ? (draft.opcoes ?? []).map((o) => o.trim()).filter(Boolean)
          : undefined,
    }
    const exists = items.some((c) => c.id === campo.id)
    const next = exists ? items.map((c) => (c.id === campo.id ? campo : c)) : [...items, campo]
    await persist(next)
    setModalOpen(false)
  }

  return (
    <section className="settings-subsection">
      <header className="settings-subsection__head">
        <div>
          <h2 className="settings-subsection__title">Campos personalizados do projeto</h2>
          <p className="settings-subsection__hint">
            Campos extras exibidos na Home de cada projeto (somente Diretor Executivo).
          </p>
        </div>
        <Button variant="secondary" onClick={openCreate}>
          Adicionar campo
        </Button>
      </header>

      {error ? <p className="settings-subsection__error">{error}</p> : null}
      {loading ? <p className="settings-subsection__status">Carregando…</p> : null}

      {!loading ? (
        <ul className="campos-projeto__list">
          {items.length === 0 ? (
            <li className="campos-projeto__empty">Nenhum campo personalizado.</li>
          ) : (
            items.map((campo) => (
              <li key={campo.id} className={`campos-projeto__item${!campo.ativo ? ' campos-projeto__item--off' : ''}`}>
                <div>
                  <span className="campos-projeto__nome">{campo.nome}</span>
                  <span className="campos-projeto__meta">
                    {SECAO_OPTIONS.find((s) => s.value === campo.secao)?.label} ·{' '}
                    {TIPO_OPTIONS.find((t) => t.value === campo.tipo)?.label}
                  </span>
                </div>
                <label className="campos-projeto__ativo">
                  <input
                    type="checkbox"
                    checked={campo.ativo}
                    onChange={(e) =>
                      void persist(
                        items.map((c) =>
                          c.id === campo.id ? { ...c, ativo: e.target.checked } : c,
                        ),
                      )
                    }
                  />
                  Ativo
                </label>
                <button type="button" className="campos-projeto__icon" onClick={() => openEdit(campo)}>
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  className="campos-projeto__icon"
                  onClick={() => void persist(items.filter((c) => c.id !== campo.id))}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
      {saving ? <p className="settings-subsection__status">Salvando…</p> : null}

      <Modal open={modalOpen} title={items.some((c) => c.id === draft.id) ? 'Editar campo' : 'Novo campo'} onClose={() => setModalOpen(false)}>
        <div className="campos-projeto__form">
          <Input label="Nome *" value={draft.nome} onChange={(e) => setDraft((d) => ({ ...d, nome: e.target.value }))} />
          <label className="campos-projeto__field">
            <span>Tipo</span>
            <select value={draft.tipo} onChange={(e) => setDraft((d) => ({ ...d, tipo: e.target.value as CampoProjetoCustom['tipo'] }))}>
              {TIPO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="campos-projeto__field">
            <span>Seção</span>
            <select value={draft.secao} onChange={(e) => setDraft((d) => ({ ...d, secao: e.target.value as CampoProjetoCustom['secao'] }))}>
              {SECAO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>
          {draft.tipo === 'select' ? (
            <Input
              label="Opções (separadas por vírgula)"
              value={(draft.opcoes ?? []).join(', ')}
              onChange={(e) =>
                setDraft((d) => ({
                  ...d,
                  opcoes: e.target.value.split(',').map((s) => s.trim()),
                }))
              }
            />
          ) : null}
          <div className="campos-projeto__form-actions">
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" disabled={!draft.nome.trim() || saving} onClick={() => void handleSave()}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  )
}
