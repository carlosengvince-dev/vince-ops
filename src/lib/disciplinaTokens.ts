import type { CSSProperties } from 'react'
import { getCachedDisciplinaByCodigo, isSystemDisciplina } from './disciplinaConfig'
import type { Disciplina } from '../types'

/**
 * Espelha os tokens CSS em :root (index.css) para HID/PPCI/SPK.
 * Disciplinas custom usam cores de disciplinas_config (inline ou CSS vars).
 */
export const DISCIPLINA_CSS_VARS = {
  HID: { bg: '--hid-bg', text: '--hid-text', border: '--hid-border' },
  PPCI: { bg: '--ppci-bg', text: '--ppci-text', border: '--ppci-border' },
  SPK: { bg: '--spk-bg', text: '--spk-text', border: '--spk-border' },
} as const

/** Origem de tarefa alinhada ao tom da disciplina (EMASA→HID, CBMSC→PPCI, NBR→SPK). */
export const ORIGEM_DISCIPLINA_TONE: Record<string, Disciplina | null> = {
  emasa: 'HID',
  cbmsc: 'PPCI',
  nbr: 'SPK',
  interno: null,
}

export function discToneClasses(disciplina: Disciplina | string, on = true): string {
  if (isSystemDisciplina(disciplina)) {
    const slug = disciplina.toLowerCase()
    return on ? `disc-tone disc-tone--${slug} disc-tone--on` : `disc-tone disc-tone--${slug}`
  }
  return on ? 'disc-tone disc-tone--custom disc-tone--on' : 'disc-tone disc-tone--custom'
}

export function discToneStyle(disciplina: Disciplina | string): CSSProperties | undefined {
  if (isSystemDisciplina(disciplina)) return undefined
  const row = getCachedDisciplinaByCodigo(disciplina, false)
  if (!row) return undefined
  return {
    backgroundColor: row.cor_bg,
    color: row.cor_texto,
    borderColor: row.cor_texto,
  }
}

export function disciplinaTabStyle(
  disciplina: Disciplina | string,
  selected: boolean,
): CSSProperties | undefined {
  if (!selected || isSystemDisciplina(disciplina)) return undefined
  const row = getCachedDisciplinaByCodigo(disciplina, false)
  if (!row) return undefined
  return {
    backgroundColor: row.cor_bg,
    color: row.cor_texto,
    borderColor: row.cor_texto,
  }
}
