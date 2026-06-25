import type { ClienteFormData } from '../../hooks/useClients'
import { Input } from '../ui/Input'
import { Textarea } from '../ui/Textarea'
import './ClientForm.css'

interface ClientFormProps {
  form: ClienteFormData
  onChange: (form: ClienteFormData) => void
  readOnly?: boolean
  fieldError?: string | null
}

export function ClientForm({ form, onChange, readOnly = false, fieldError }: ClientFormProps) {
  function updateField<K extends keyof ClienteFormData>(key: K, value: ClienteFormData[K]) {
    onChange({ ...form, [key]: value })
  }

  return (
    <div className="client-form">
      <Input
        label="Nome *"
        name="nome"
        value={form.nome}
        onChange={(e) => updateField('nome', e.target.value)}
        placeholder="Razão social ou nome do cliente"
        required
        disabled={readOnly}
        error={fieldError}
      />
      <Input
        label="Contato"
        name="contato"
        value={form.contato}
        onChange={(e) => updateField('contato', e.target.value)}
        placeholder="Nome da pessoa de contato"
        disabled={readOnly}
      />
      <div className="client-form__row">
        <Input
          label="E-mail"
          name="email"
          type="email"
          value={form.email}
          onChange={(e) => updateField('email', e.target.value)}
          placeholder="contato@empresa.com"
          disabled={readOnly}
        />
        <Input
          label="Telefone"
          name="telefone"
          value={form.telefone}
          onChange={(e) => updateField('telefone', e.target.value)}
          placeholder="(47) 99999-9999"
          disabled={readOnly}
        />
      </div>
      <Input
        label="CNPJ / CPF"
        name="cnpj_cpf"
        value={form.cnpj_cpf}
        onChange={(e) => updateField('cnpj_cpf', e.target.value)}
        placeholder="00.000.000/0001-00"
        disabled={readOnly}
      />
      <Textarea
        label="Observações"
        name="observacoes"
        value={form.observacoes}
        onChange={(e) => updateField('observacoes', e.target.value)}
        placeholder="Notas internas sobre o cliente"
        disabled={readOnly}
      />
    </div>
  )
}
