import type { ModoCriacao } from '../../types'
import type { ProjectFormData } from '../../types/project-create'
import { useCodigoValidation } from '../../hooks/useCodigoValidation'
import { DISCIPLINA_LABELS, PROJETO_STATUS_LABELS } from '../../lib/constants'
import type { Disciplina, Metodologia, ProjetoStatus } from '../../types'
import { disciplinaTabClass } from '../ui/DisciplinaTabs'
import { ClientSelect } from '../clients/ClientSelect'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import './StepProjectData.css'

const DISCIPLINAS: Disciplina[] = ['HID', 'PPCI', 'SPK']
const METODOLOGIAS: Metodologia[] = ['2D', '3D', 'BIM']

const HISTORICO_STATUS: ProjetoStatus[] = ['concluido', 'cancelado', 'suspenso']

const TIPOS_EDIFICACAO = [
  'Residencial',
  'Comercial',
  'Industrial',
  'Misto',
  'Institucional',
  'Outro',
]

interface StepProjectDataProps {
  modo: ModoCriacao
  form: ProjectFormData
  onChange: (form: ProjectFormData) => void
  fieldErrors: Partial<Record<keyof ProjectFormData | 'codigo_dup', string>>
}

export function validateProjectFormStep(
  modo: ModoCriacao,
  form: ProjectFormData,
  isDuplicate: boolean,
): Partial<Record<keyof ProjectFormData | 'codigo_dup', string>> {
  const errors: Partial<Record<keyof ProjectFormData | 'codigo_dup', string>> = {}

  if (!form.codigo.trim()) {
    errors.codigo = 'Código é obrigatório.'
  } else if (isDuplicate) {
    errors.codigo_dup = 'Código já utilizado em outro projeto'
  }

  if (!form.nome.trim()) {
    errors.nome = 'Nome do projeto é obrigatório.'
  }

  if (form.disciplinas.length === 0) {
    errors.disciplinas = 'Selecione ao menos uma disciplina.'
  }

  if (modo === 'historico') {
    if (form.status === 'cancelado' && !form.justificativa_cancelamento.trim()) {
      errors.justificativa_cancelamento = 'Justificativa é obrigatória para projetos cancelados.'
    }
  }

  return errors
}

export function StepProjectData({ modo, form, onChange, fieldErrors }: StepProjectDataProps) {
  const codigoValidation = useCodigoValidation(form.codigo)
  const isHistorico = modo === 'historico'

  const codigoError =
    fieldErrors.codigo ??
    fieldErrors.codigo_dup ??
    codigoValidation.duplicateMessage ??
    codigoValidation.error ??
    null

  function patch(partial: Partial<ProjectFormData>) {
    onChange({ ...form, ...partial })
  }

  function toggleDisciplina(disciplina: Disciplina) {
    const has = form.disciplinas.includes(disciplina)
    const disciplinas = has
      ? form.disciplinas.filter((d) => d !== disciplina)
      : [...form.disciplinas, disciplina]

    const metodologia = { ...form.metodologia }
    if (!has) {
      metodologia[disciplina] = metodologia[disciplina] ?? '2D'
    } else {
      delete metodologia[disciplina]
    }

    patch({ disciplinas, metodologia })
  }

  function setMetodologia(disciplina: Disciplina, value: Metodologia) {
    patch({ metodologia: { ...form.metodologia, [disciplina]: value } })
  }

  return (
    <div className="step-project-data">
      <div className="step-project-data__section">
        <h2 className="step-project-data__section-title">Identificação</h2>
        <div className="step-project-data__grid step-project-data__grid--2">
          <div className="step-project-data__codigo">
            <Input
              label="Código *"
              name="codigo"
              value={form.codigo}
              onChange={(e) => patch({ codigo: e.target.value.toUpperCase().replace(/\s/g, '') })}
              onBlur={() => codigoValidation.validateNow()}
              placeholder="Ex: AUR, CVN"
              error={codigoError}
              className={codigoValidation.isDuplicate ? 'step-project-data__input--duplicate' : ''}
            />
            {codigoValidation.checking ? (
              <span className="step-project-data__codigo-hint">Verificando código…</span>
            ) : null}
          </div>
          <Input
            label="Nome do projeto *"
            name="nome"
            value={form.nome}
            onChange={(e) => patch({ nome: e.target.value })}
            placeholder="Nome completo ou identificação da obra"
            error={fieldErrors.nome}
          />
        </div>

        <ClientSelect
          value={form.cliente_id}
          onChange={(id) => patch({ cliente_id: id })}
        />
      </div>

      <div className="step-project-data__section">
        <h2 className="step-project-data__section-title">Disciplinas *</h2>
        {fieldErrors.disciplinas ? (
          <p className="step-project-data__field-error">{fieldErrors.disciplinas}</p>
        ) : null}
        <div className="step-project-data__disciplinas">
          {DISCIPLINAS.map((disc) => {
            const active = form.disciplinas.includes(disc)
            return (
              <div key={disc} className="step-project-data__disc-block">
                <button
                  type="button"
                  className={disciplinaTabClass(disc, active)}
                  onClick={() => toggleDisciplina(disc)}
                  aria-pressed={active}
                >
                  {DISCIPLINA_LABELS[disc]}
                </button>
                {active ? (
                  <label className="step-project-data__metodologia">
                    <span>Metodologia</span>
                    <select
                      value={form.metodologia[disc] ?? '2D'}
                      onChange={(e) => setMetodologia(disc, e.target.value as Metodologia)}
                    >
                      {METODOLOGIAS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      {isHistorico ? (
        <div className="step-project-data__section">
          <h2 className="step-project-data__section-title">Situação do registro</h2>
          <div className="step-project-data__grid step-project-data__grid--2">
            <label className="step-project-data__select-field">
              <span className="step-project-data__select-label">Status *</span>
              <select
                value={form.status}
                onChange={(e) => patch({ status: e.target.value as ProjetoStatus })}
              >
                {HISTORICO_STATUS.map((s) => (
                  <option key={s} value={s}>
                    {PROJETO_STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <Input
              label="Data de conclusão real"
              name="data_conclusao_real"
              type="date"
              value={form.data_conclusao_real}
              onChange={(e) => patch({ data_conclusao_real: e.target.value })}
            />
          </div>
          {form.status === 'cancelado' ? (
            <Textarea
              label="Justificativa do cancelamento *"
              name="justificativa_cancelamento"
              value={form.justificativa_cancelamento}
              onChange={(e) => patch({ justificativa_cancelamento: e.target.value })}
              error={fieldErrors.justificativa_cancelamento}
            />
          ) : null}
        </div>
      ) : (
        <>
          <div className="step-project-data__section">
            <h2 className="step-project-data__section-title">Obra</h2>
            <div className="step-project-data__grid step-project-data__grid--2">
              <label className="step-project-data__select-field">
                <span className="step-project-data__select-label">Tipo de edificação</span>
                <select
                  value={form.tipo_edificacao}
                  onChange={(e) => patch({ tipo_edificacao: e.target.value })}
                >
                  <option value="">Selecione…</option>
                  {TIPOS_EDIFICACAO.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="Área (m²)"
                name="area_m2"
                type="number"
                min="0"
                step="0.01"
                value={form.area_m2}
                onChange={(e) => patch({ area_m2: e.target.value })}
                placeholder="Ex: 1250"
              />
            </div>
            <Input
              label="Endereço"
              name="endereco"
              value={form.endereco}
              onChange={(e) => patch({ endereco: e.target.value })}
              placeholder="Endereço completo da obra"
            />
          </div>

          <div className="step-project-data__section">
            <h2 className="step-project-data__section-title">Datas e estimativas</h2>
            <div className="step-project-data__grid step-project-data__grid--3">
              <Input
                label="Data de início"
                name="data_inicio"
                type="date"
                value={form.data_inicio}
                onChange={(e) => patch({ data_inicio: e.target.value })}
              />
              <Input
                label="Protocolo previsto"
                name="data_protocolo_prevista"
                type="date"
                value={form.data_protocolo_prevista}
                onChange={(e) => patch({ data_protocolo_prevista: e.target.value })}
              />
              <Input
                label="Entrega prevista"
                name="data_entrega_prevista"
                type="date"
                value={form.data_entrega_prevista}
                onChange={(e) => patch({ data_entrega_prevista: e.target.value })}
              />
            </div>
            <div className="step-project-data__grid step-project-data__grid--2">
              {form.disciplinas.includes('HID') ? (
                <Input
                  label="Horas estimadas HID"
                  name="horas_estimadas_hid"
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.horas_estimadas_hid}
                  onChange={(e) => patch({ horas_estimadas_hid: e.target.value })}
                  placeholder="Ex: 40"
                />
              ) : null}
              {form.disciplinas.includes('PPCI') ? (
                <Input
                  label="Horas estimadas PPCI"
                  name="horas_estimadas_ppci"
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.horas_estimadas_ppci}
                  onChange={(e) => patch({ horas_estimadas_ppci: e.target.value })}
                  placeholder="Ex: 32"
                />
              ) : null}
            </div>
          </div>
        </>
      )}

      {isHistorico ? (
        <div className="step-project-data__section">
          <h2 className="step-project-data__section-title">Datas e horas (opcional)</h2>
          <div className="step-project-data__grid step-project-data__grid--2">
            <Input
              label="Data de início"
              name="data_inicio"
              type="date"
              value={form.data_inicio}
              onChange={(e) => patch({ data_inicio: e.target.value })}
            />
            <Input
              label="Entrega prevista"
              name="data_entrega_prevista"
              type="date"
              value={form.data_entrega_prevista}
              onChange={(e) => patch({ data_entrega_prevista: e.target.value })}
            />
          </div>
          <div className="step-project-data__grid step-project-data__grid--2">
            <Input
              label="Horas totais HID"
              name="horas_estimadas_hid"
              type="number"
              min="0"
              step="0.5"
              value={form.horas_estimadas_hid}
              onChange={(e) => patch({ horas_estimadas_hid: e.target.value })}
            />
            <Input
              label="Horas totais PPCI"
              name="horas_estimadas_ppci"
              type="number"
              min="0"
              step="0.5"
              value={form.horas_estimadas_ppci}
              onChange={(e) => patch({ horas_estimadas_ppci: e.target.value })}
            />
          </div>
        </div>
      ) : null}

      <p className="step-project-data__note">
        O número sequencial (ex: VNC-2026-001) será gerado automaticamente ao salvar — não é
        editável.
      </p>
    </div>
  )
}