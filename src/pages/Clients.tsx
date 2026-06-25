import { useMemo, useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { ClientCard } from '../components/clients/ClientCard'
import { ClientForm } from '../components/clients/ClientForm'
import { ClientSelect } from '../components/clients/ClientSelect'
import { PageWrapper } from '../components/layout/PageWrapper'
import { Button } from '../components/ui/Button'
import { ConfirmModal } from '../components/ui/ConfirmModal'
import { Modal } from '../components/ui/Modal'
import { useAuth } from '../hooks/useAuth'
import {
  EMPTY_CLIENTE_FORM,
  type ClienteFormData,
  type ClienteWithStats,
  useClients,
} from '../hooks/useClients'
import { hasPermissao } from '../lib/constants'
import './Clients.css'

function clienteToForm(cliente: ClienteWithStats): ClienteFormData {
  return {
    nome: cliente.nome,
    contato: cliente.contato ?? '',
    email: cliente.email ?? '',
    telefone: cliente.telefone ?? '',
    cnpj_cpf: cliente.cnpj_cpf ?? '',
    observacoes: cliente.observacoes ?? '',
  }
}

export default function Clients() {
  const { profile } = useAuth()
  const { clientes, loading, error, createCliente, updateCliente, deleteCliente } = useClients()

  const canEdit = profile ? hasPermissao(profile.papel, 'editar_projeto') : false

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selected, setSelected] = useState<ClienteWithStats | null>(null)
  const [form, setForm] = useState<ClienteFormData>(EMPTY_CLIENTE_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [fieldError, setFieldError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [demoClientId, setDemoClientId] = useState<string | null>(null)

  const isEditing = selected !== null
  const readOnly = isEditing && !canEdit

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return clientes
    return clientes.filter(
      (c) =>
        c.nome.toLowerCase().includes(term) ||
        c.email?.toLowerCase().includes(term) ||
        c.contato?.toLowerCase().includes(term) ||
        c.cnpj_cpf?.toLowerCase().includes(term),
    )
  }, [clientes, search])

  function openCreate() {
    setSelected(null)
    setForm(EMPTY_CLIENTE_FORM)
    setFormError(null)
    setFieldError(null)
    setFormOpen(true)
  }

  function openClient(cliente: ClienteWithStats) {
    setSelected(cliente)
    setForm(clienteToForm(cliente))
    setFormError(null)
    setFieldError(null)
    setFormOpen(true)
  }

  function closeForm() {
    setFormOpen(false)
    setSelected(null)
    setForm(EMPTY_CLIENTE_FORM)
    setFormError(null)
    setFieldError(null)
  }

  async function handleSave() {
    if (!form.nome.trim()) {
      setFieldError('Nome é obrigatório.')
      return
    }

    setSaving(true)
    setFormError(null)
    setFieldError(null)

    try {
      if (isEditing && selected) {
        await updateCliente(selected.id, form)
      } else {
        await createCliente(form)
      }
      closeForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao salvar cliente.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!selected) return

    setSaving(true)
    setFormError(null)

    try {
      await deleteCliente(selected.id)
      setDeleteOpen(false)
      closeForm()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Erro ao excluir cliente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <PageWrapper title="Clientes">
      <div className="clients-page">
        <div className="clients-page__toolbar">
          <div className="clients-page__search">
            <Search size={16} />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, e-mail ou CNPJ…"
            />
          </div>
          {canEdit ? (
            <Button type="button" onClick={openCreate}>
              <Plus size={16} />
              Novo cliente
            </Button>
          ) : null}
        </div>

        {error ? (
          <p className="clients-page__error" role="alert">
            {error}
          </p>
        ) : null}

        {loading ? (
          <p className="clients-page__status">Carregando clientes…</p>
        ) : filtered.length === 0 ? (
          <div className="clients-page__empty">
            <p>{search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado ainda.'}</p>
            {canEdit && !search ? (
              <Button type="button" onClick={openCreate}>
                Cadastrar primeiro cliente
              </Button>
            ) : null}
          </div>
        ) : (
          <div className="clients-page__grid">
            {filtered.map((cliente) => (
              <ClientCard key={cliente.id} cliente={cliente} onOpen={openClient} />
            ))}
          </div>
        )}

        {canEdit ? (
          <section className="clients-page__demo">
            <h2 className="clients-page__demo-title">Prévia — ClientSelect</h2>
            <p className="clients-page__demo-desc">
              Componente reutilizável para a criação de projetos (Fase 4).
            </p>
            <ClientSelect
              value={demoClientId}
              onChange={setDemoClientId}
              onNewClient={openCreate}
              clientes={clientes}
            />
          </section>
        ) : null}
      </div>

      <Modal
        open={formOpen}
        title={
          readOnly ? selected?.nome ?? 'Cliente' : isEditing ? 'Editar cliente' : 'Novo cliente'
        }
        onClose={closeForm}
        footer={
          readOnly ? (
            <Button type="button" variant="secondary" onClick={closeForm}>
              Fechar
            </Button>
          ) : (
            <>
              {isEditing && canEdit ? (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDeleteOpen(true)}
                  disabled={saving}
                >
                  Excluir
                </Button>
              ) : null}
              <Button type="button" variant="secondary" onClick={closeForm} disabled={saving}>
                Cancelar
              </Button>
              <Button type="button" onClick={() => void handleSave()} loading={saving}>
                Salvar
              </Button>
            </>
          )
        }
      >
        {formError ? (
          <p className="clients-page__form-error" role="alert">
            {formError}
          </p>
        ) : null}
        <ClientForm
          form={form}
          onChange={setForm}
          readOnly={readOnly}
          fieldError={fieldError}
        />
        {readOnly && selected ? (
          <div className="clients-page__detail-stats">
            <span>{selected.projetosAtivos} projetos ativos</span>
            <span>{selected.projetosTotal} projetos no total</span>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        isOpen={deleteOpen}
        title="Excluir cliente"
        message={
          selected
            ? `Tem certeza que deseja excluir ${selected.nome}? Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Confirmar exclusão"
        variant="danger"
        loading={saving}
        onConfirm={() => void handleDelete()}
        onCancel={() => {
          if (!saving) setDeleteOpen(false)
        }}
      />
    </PageWrapper>
  )
}
