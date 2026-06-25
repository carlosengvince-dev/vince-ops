/** @deprecated Use projectHome.ts */
export {
  parseProjetoHomeMetadata as parseMetadataTecnico,
  updateProjetoMetadataField,
  type ProjetoHomeMetadata as ProjetoMetadataTecnico,
  type ProjetoHomeMetadataField,
} from './projectHome'

export const METADATA_TECNICO_KEYS = [
  'protocolo_emasa',
  'processo_cbmsc',
  'data_protocolo_real',
  'numero_art',
  'numero_crea',
  'observacoes_tecnicas',
] as const
