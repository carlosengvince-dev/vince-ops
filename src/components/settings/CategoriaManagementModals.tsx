import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Modal } from '../ui/Modal'
import type { CategoriaConfig, RenameCategoriaEscopo } from '../../lib/categoriaConfig'

interface CategoriaManagementModalsProps {
  renameTarget: CategoriaConfig | null
  renameNome: string
  renameEscopo: RenameCategoriaEscopo
  renamePreview: { templates: number; tarefas: number } | null
  renaming: boolean
  onRenameNomeChange: (value: string) => void
  onRenameEscopoChange: (value: RenameCategoriaEscopo) => void
  onCloseRename: () => void
  onConfirmRename: () => void
  deleteTarget: CategoriaConfig | null
  deleteTemplateCount: number
  deleteCascadeTemplates: boolean
  deleting: boolean
  onDeleteCascadeChange: (value: boolean) => void
  onConfirmDelete: () => void
  onCloseDelete: () => void
}

export function CategoriaManagementModals({
  renameTarget,
  renameNome,
  renameEscopo,
  renamePreview,
  renaming,
  onRenameNomeChange,
  onRenameEscopoChange,
  onCloseRename,
  onConfirmRename,
  deleteTarget,
  deleteTemplateCount,
  deleteCascadeTemplates,
  deleting,
  onDeleteCascadeChange,
  onConfirmDelete,
  onCloseDelete,
}: CategoriaManagementModalsProps) {
  return (
    <>
      <Modal
        open={renameTarget != null}
        title="Renomear categoria"
        onClose={() => {
          if (!renaming) onCloseRename()
        }}
      >
        <div className="categorias-section__rename">
          <Input
            label="Novo nome"
            value={renameNome}
            onChange={(e) => onRenameNomeChange(e.target.value)}
          />

          {renamePreview ? (
            <p className="categorias-section__preview">
              Impacto atual: {renamePreview.templates} template(s) e {renamePreview.tarefas}{' '}
              tarefa(s) em projetos ativos usam &quot;{renameTarget?.nome}&quot;.
            </p>
          ) : null}

          <fieldset className="categorias-section__radio-group">
            <legend>Escopo da renomeação</legend>
            <label className="categorias-section__radio">
              <input
                type="radio"
                name="rename-escopo"
                checked={renameEscopo === 'config'}
                onChange={() => onRenameEscopoChange('config')}
              />
              Só a lista de categorias
            </label>
            <label className="categorias-section__radio">
              <input
                type="radio"
                name="rename-escopo"
                checked={renameEscopo === 'config_templates'}
                onChange={() => onRenameEscopoChange('config_templates')}
              />
              Lista + templates
            </label>
            <label className="categorias-section__radio">
              <input
                type="radio"
                name="rename-escopo"
                checked={renameEscopo === 'tudo'}
                onChange={() => onRenameEscopoChange('tudo')}
              />
              Lista + templates + tarefas de projetos ativos
            </label>
          </fieldset>

          <div className="settings-subsection__actions">
            <Button type="button" variant="secondary" disabled={renaming} onClick={onCloseRename}>
              Cancelar
            </Button>
            <Button type="button" disabled={renaming} onClick={onConfirmRename}>
              {renaming ? 'Renomeando…' : 'Renomear'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteTarget != null}
        title="Excluir categoria"
        onClose={() => {
          if (!deleting) onCloseDelete()
        }}
      >
        <div className="categorias-section__rename">
          <p className="categorias-section__preview">
            {deleteTarget ? `Como deseja excluir "${deleteTarget.nome}"?` : ''}
          </p>

        <fieldset className="categorias-section__radio-group">
          <label className="categorias-section__radio">
            <input
              type="radio"
              checked={!deleteCascadeTemplates}
              onChange={() => onDeleteCascadeChange(false)}
            />
            Só remover da lista de categorias
          </label>
          <label className="categorias-section__radio">
            <input
              type="radio"
              checked={deleteCascadeTemplates}
              onChange={() => onDeleteCascadeChange(true)}
            />
            Remover e excluir as {deleteTemplateCount} tarefas de template desta categoria
          </label>
        </fieldset>
          <div className="settings-subsection__actions">
            <Button type="button" variant="secondary" disabled={deleting} onClick={onCloseDelete}>
              Cancelar
            </Button>
            <Button type="button" disabled={deleting} onClick={onConfirmDelete}>
              {deleting ? 'Excluindo…' : 'Confirmar exclusão'}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
