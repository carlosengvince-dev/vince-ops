import type { Disciplina } from '../types'

/**
 * Espelha os tokens CSS em :root (index.css).
 * Futura fonte dinâmica: configuracoes no Supabase.
 */
export const DISCIPLINA_CSS_VARS = {
  HID: { bg: '--hid-bg', text: '--hid-text', border: '--hid-border' },
  PPCI: { bg: '--ppci-bg', text: '--ppci-text', border: '--ppci-border' },
  SPK: { bg: '--spk-bg', text: '--spk-text', border: '--spk-border' },
} as const satisfies Record<Disciplina, { bg: string; text: string; border: string }>

/** Origem de tarefa alinhada ao tom da disciplina (EMASA→HID, CBMSC→PPCI, NBR→SPK). */
export const ORIGEM_DISCIPLINA_TONE: Record<string, Disciplina | null> = {
  emasa: 'HID',
  cbmsc: 'PPCI',
  nbr: 'SPK',
  interno: null,
}

export function discToneClasses(disciplina: Disciplina | string, on = true): string {
  const slug = disciplina.toLowerCase()
  return on ? `disc-tone disc-tone--${slug} disc-tone--on` : `disc-tone disc-tone--${slug}`
}
