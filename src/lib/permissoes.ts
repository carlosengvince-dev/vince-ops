import { hasPermissao } from './constants'
import type { Papel, Profile } from '../types'

export function isDiretorExecutivo(profile: Pick<Profile, 'papel'>): boolean {
  return profile.papel === 'diretor_executivo'
}

export function isGestorOrAbove(profile: Pick<Profile, 'papel'>): boolean {
  return profile.papel === 'gestor' || profile.papel === 'diretor_executivo'
}

export function isImortal(profile: Pick<Profile, 'papel'>): boolean {
  return hasPermissao(profile.papel, 'imortal')
}

export function canGerenciarGestores(papel: Papel): boolean {
  return hasPermissao(papel, 'gerenciar_gestores')
}
