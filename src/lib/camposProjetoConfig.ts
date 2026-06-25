import { fetchConfiguracaoJson, saveConfiguracao, type CampoProjetoCustom } from './configuracoes'

export type { CampoProjetoCustom }

export function customFieldMetadataKey(id: string): string {
  return `custom_${id}`
}

export async function fetchCamposProjetoCustom(): Promise<CampoProjetoCustom[]> {
  const raw = await fetchConfiguracaoJson<CampoProjetoCustom[] | null>('campos_projeto_custom', null)
  if (!raw || !Array.isArray(raw)) return []
  return raw.filter((c) => c && typeof c.id === 'string' && typeof c.nome === 'string')
}

export async function saveCamposProjetoCustom(
  campos: CampoProjetoCustom[],
  userId?: string,
): Promise<void> {
  await saveConfiguracao('campos_projeto_custom', campos, userId)
}

export function camposAtivosPorSecao(
  campos: CampoProjetoCustom[],
  secao: CampoProjetoCustom['secao'],
): CampoProjetoCustom[] {
  return campos.filter((c) => c.ativo && c.secao === secao)
}
