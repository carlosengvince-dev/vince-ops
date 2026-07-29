import { useCallback, useEffect, useState } from 'react'
import { Pencil } from 'lucide-react'
import { useResponsaveisTecnicos } from '../../hooks/useResponsaveisTecnicos'
import type { ResponsavelTecnico } from '../../types'
import { RtFormModal } from '../projects/RtFormModal'
import { Button } from '../ui/Button'
import { ConfirmModal } from '../ui/ConfirmModal'
import './SettingsSubsection.css'
import './ResponsaveisTecnicosSection.css'

export function ResponsaveisTecnicosSection() {
  const { items, loading, error, upsert, deactivate, reload } = useResponsaveisTecnicos()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ResponsavelTecnico | null>(null)
  const [saving, setSaving] = useState(false)
  const [deactivateTarget, setDeactivateTarget] = useState<ResponsavelTecnico | null>(null)
  const [deactivating, setDeactivating] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    void reload()
  }, [reload])

  const openNew = useCallback(() => {
    setEditing(null)
    setModalOpen(true)
    setActionError(null)
  }, [])

  const openEdit = useCallback((rt: ResponsavelTecnico) => {
    setEditing(rt)
    setModalOpen(true)
    setActionError(null)
  }, [])

  async function handleSubmit(data: { nome: string; documento: string; registro: string }) {
    setSaving(true)
    setActionError(null)
    try {
      await upsert({
        id: editing?.id ?? null,
        nome: data.nome,
        documento: data.documento,
        registro: data.registro,
        ativo: true,
      })
      setModalOpen(false)
      setEditing(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao salvar RT')
      throw err
    } finally {
      setSaving(false)
    }
  }

  async function handleConfirmDeactivate() {
    if (!deactivateTarget) return
    setDeactivating(true)
    setActionError(null)
    try {
      await deactivate(deactivateTarget)
      setDeactivateTarget(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Erro ao desativar RT')
    } finally {
      setDeactivating(false)
    }
  }

  return (
    <section className="settings-subsection">
      <div className="settings-subsection__head">
        <div>
          <h2 className="settings-subsection__title">Responsáveis Técnicos</h2>
          <p className="settings-subsection__hint">
            Cadastro de RTs para vincular nos projetos (documento e registro CREA/CAU).
          </p>
        </div>
        <Button onClick={openNew}>+ Novo RT</Button>
      </div>

      {error || actionError ? (
        <p className="settings-subsection__error" role="alert">
          {actionError ?? error}
        </p>
      ) : null}

      {loading ? (
        <p className="settings-subsection__status">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="settings-subsection__status">Nenhum responsável técnico ativo.</p>
      ) : (
        <div className="rt-settings__table-wrap">
          <table className="rt-settings__table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Documento</th>
                <th>Registro</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((rt) => (
                <tr key={rt.id}>
                  <td>{rt.nome}</td>
                  <td>{rt.documento || '—'}</td>
                  <td>{rt.registro || '—'}</td>
                  <td className="rt-settings__actions">
                    <button
                      type="button"
                      className="rt-settings__icon"
                      onClick={() => openEdit(rt)}
                      aria-label={`Editar ${rt.nome}`}
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      className="rt-settings__link-danger"
                      onClick={() => setDeactivateTarget(rt)}
                    >
                      Desativar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <RtFormModal
        open={modalOpen}
        initial={editing}
        saving={saving}
        onClose={() => {
          if (saving) return
          setModalOpen(false)
          setEditing(null)
        }}
        onSubmit={handleSubmit}
      />

      <ConfirmModal
        isOpen={deactivateTarget != null}
        title="Desativar responsável técnico"
        message={
          deactivateTarget
            ? `Desativar "${deactivateTarget.nome}"? Ele deixará de aparecer na lista e nos selects de novos vínculos.`
            : ''
        }
        confirmLabel="Desativar"
        variant="danger"
        loading={deactivating}
        onConfirm={() => void handleConfirmDeactivate()}
        onCancel={() => {
          if (deactivating) return
          setDeactivateTarget(null)
        }}
      />
    </section>
  )
}
