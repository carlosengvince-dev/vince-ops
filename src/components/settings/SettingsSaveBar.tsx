import './SettingsSaveBar.css'

interface SettingsSaveBarProps {
  dirtyCount: number
  saving?: boolean
  onSave: () => void
  hint?: string
}

export function SettingsSaveBar({
  dirtyCount,
  saving = false,
  onSave,
  hint,
}: SettingsSaveBarProps) {
  if (dirtyCount <= 0) return null

  return (
    <div className="settings-save-bar" role="region" aria-label="Salvar alterações">
      <p className="settings-save-bar__hint">
        {hint ?? 'Você tem alterações não salvas nesta seção.'}
      </p>
      <div className="settings-save-bar__actions">
        <button
          type="button"
          className="settings-save-bar__btn"
          disabled={saving}
          onClick={onSave}
        >
          {saving ? 'Salvando…' : 'Salvar alterações'}
          <span className="settings-save-bar__badge" aria-label={`${dirtyCount} alterações`}>
            {dirtyCount}
          </span>
        </button>
      </div>
    </div>
  )
}
