import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { fetchHistoricoProjects, type HistoricoProjetoRow } from '../lib/historico'
import {
  aggregateHorasMesPorDisciplina,
  fetchHorasPorProjetos,
  type HorasMesPorDisciplina,
} from '../lib/projectHoras'
import { createProject } from '../lib/projects'
import { patchProjetoRpc } from '../lib/projetoRpc'
import {
  getHorasChartVersion,
  subscribeHorasChartVersion,
} from '../lib/horasChartVersion'
import type {
  CalendarProjectDates,
  CreateProjectPayload,
  DashboardMetrics,
  HorasPorMesItem,
  ProjetoListItem,
  TarefaHojeItem,
  TarefasPorStatusCounts,
} from '../types/project-create'
import type { Projeto, TarefaStatus } from '../types'

const ACTIVE_STATUSES = ['ativo', 'em_revisao'] as const
const DASHBOARD_STATUSES = [...ACTIVE_STATUSES] as string[]

const MONTH_LABELS = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
] as const

function buildLast6MonthKeys(): HorasPorMesItem[] {
  const now = new Date()
  const items: HorasPorMesItem[] = []

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`
    items.push({ label, key, segundos: 0 })
  }

  return items
}

function mapProjetoRow(row: Record<string, unknown>): ProjetoListItem {
  const cliente = row.clientes as { nome: string } | null | undefined
  return {
    id: row.id as string,
    codigo: row.codigo as string,
    numero_sequencial: row.numero_sequencial as number,
    nome: row.nome as string,
    status: row.status as ProjetoListItem['status'],
    disciplinas: row.disciplinas as ProjetoListItem['disciplinas'],
    metodologia: (row.metodologia ?? {}) as ProjetoListItem['metodologia'],
    fases_atuais: (row.fases_atuais ?? {}) as ProjetoListItem['fases_atuais'],
    cliente_id: row.cliente_id as string | null,
    cliente_nome: cliente?.nome ?? null,
    data_inicio: row.data_inicio as string | null,
    data_entrega_prevista: row.data_entrega_prevista as string | null,
    created_at: row.created_at as string,
  }
}

const EMPTY_TAREFAS_STATUS: TarefasPorStatusCounts = {
  concluido: 0,
  em_elaboracao: 0,
  em_revisao: 0,
  bloqueado: 0,
  pendente: 0,
  nao_aplica: 0,
}

export interface TarefaProgressRow {
  projeto_id: string
  disciplina: string
  fase: string
  status: string
}

const EMPTY_HORAS_MES_DISCIPLINA: HorasMesPorDisciplina = {}

interface DashboardCache {
  ativos: ProjetoListItem[]
  suspensos: ProjetoListItem[]
  tarefasProgress: TarefaProgressRow[]
  metrics: DashboardMetrics
  horasPorMes: HorasPorMesItem[]
  horasMesPorDisciplina: HorasMesPorDisciplina
  horasPorProjeto: Record<string, number>
  tarefasPorStatus: TarefasPorStatusCounts
  tarefasHoje: TarefaHojeItem[]
  calendarProjects: CalendarProjectDates[]
}

let dashboardCache: DashboardCache | null = null

export function useProjects() {
  const [ativos, setAtivos] = useState<ProjetoListItem[]>(() => dashboardCache?.ativos ?? [])
  const [suspensos, setSuspensos] = useState<ProjetoListItem[]>(() => dashboardCache?.suspensos ?? [])
  const [tarefasProgress, setTarefasProgress] = useState<TarefaProgressRow[]>(
    () => dashboardCache?.tarefasProgress ?? [],
  )
  const [metrics, setMetrics] = useState<DashboardMetrics>(
    () =>
      dashboardCache?.metrics ?? {
        projetosAtivos: 0,
        tarefasAbertas: 0,
        horasMesSegundos: 0,
        projetosConcluidos: 0,
      },
  )
  const [horasPorMes, setHorasPorMes] = useState<HorasPorMesItem[]>(
    () => dashboardCache?.horasPorMes ?? buildLast6MonthKeys(),
  )
  const [horasMesPorDisciplina, setHorasMesPorDisciplina] = useState<HorasMesPorDisciplina>(
    () => dashboardCache?.horasMesPorDisciplina ?? EMPTY_HORAS_MES_DISCIPLINA,
  )
  const [horasPorProjeto, setHorasPorProjeto] = useState<Record<string, number>>(
    () => dashboardCache?.horasPorProjeto ?? {},
  )
  const [tarefasPorStatus, setTarefasPorStatus] = useState<TarefasPorStatusCounts>(
    () => dashboardCache?.tarefasPorStatus ?? EMPTY_TAREFAS_STATUS,
  )
  const [tarefasHoje, setTarefasHoje] = useState<TarefaHojeItem[]>(
    () => dashboardCache?.tarefasHoje ?? [],
  )
  const [calendarProjects, setCalendarProjects] = useState<CalendarProjectDates[]>(
    () => dashboardCache?.calendarProjects ?? [],
  )
  const [initialLoading, setInitialLoading] = useState(() => dashboardCache === null)
  const [error, setError] = useState<string | null>(null)
  const [horasChartVersion, setHorasChartVersion] = useState(getHorasChartVersion)
  const horasChartSkipRef = useRef(true)

  const fetchDashboard = useCallback(async () => {
    const isFirstLoad = dashboardCache === null
    if (isFirstLoad) setInitialLoading(true)
    setError(null)

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

    const [
      ativosRes,
      suspensosRes,
      concluidosRes,
      tarefasRes,
      horasRes,
      horas6Res,
      tarefasStatusRes,
      tarefasHojeRes,
      calendarRes,
    ] = await Promise.all([
      supabase
        .from('projetos')
        .select('*, clientes(nome)')
        .in('status', DASHBOARD_STATUSES)
        .neq('modo_criacao', 'historico')
        .is('deleted_at', null)
        .order('updated_at', { ascending: false }),
      supabase
        .from('projetos')
        .select('*, clientes(nome)')
        .eq('status', 'suspenso')
        .is('deleted_at', null)
        .order('nome', { ascending: true }),
      supabase
        .from('projetos')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'concluido')
        .is('deleted_at', null),
      supabase
        .from('tarefas')
        .select('id, projetos!inner(status)', { count: 'exact', head: true })
        .in('status', ['pendente', 'em_elaboracao', 'em_revisao', 'bloqueado'])
        .in('projetos.status', ['ativo', 'em_revisao'])
        .is('deleted_at', null),
      supabase
        .from('registros_tempo')
        .select('duracao_segundos, inicio, fim, disciplina')
        .gte('inicio', monthStart)
        .is('deleted_at', null),
      supabase
        .from('registros_tempo')
        .select('duracao_segundos, inicio, fim')
        .gte('inicio', sixMonthsStart)
        .is('deleted_at', null),
      supabase.from('tarefas').select('status').is('deleted_at', null),
      supabase
        .from('tarefas')
        .select(
          'id, nome, status, updated_at, responsavel_id, projetos(codigo), profiles!responsavel_id(nome)',
        )
        .in('status', ['em_elaboracao', 'em_revisao'])
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(30),
      supabase
        .from('projetos')
        .select('data_inicio, data_entrega_prevista')
        .neq('modo_criacao', 'historico')
        .is('deleted_at', null),
    ])

    if (ativosRes.error || suspensosRes.error) {
      setError(ativosRes.error?.message ?? suspensosRes.error?.message ?? 'Erro ao carregar projetos')
      if (isFirstLoad) setInitialLoading(false)
      return
    }

    const nextAtivos = (ativosRes.data ?? []).map((r) => mapProjetoRow(r as Record<string, unknown>))
    const nextSuspensos = (suspensosRes.data ?? []).map((r) =>
      mapProjetoRow(r as Record<string, unknown>),
    )
    setAtivos(nextAtivos)
    setSuspensos(nextSuspensos)

    const projectIds = [
      ...(ativosRes.data ?? []).map((r) => (r as { id: string }).id),
      ...(suspensosRes.data ?? []).map((r) => (r as { id: string }).id),
    ]

    let nextTarefasProgress: TarefaProgressRow[] = []
    let nextHorasPorProjeto: Record<string, number> = {}

    if (projectIds.length > 0) {
      const [tarefasData, horasProjetoData] = await Promise.all([
        supabase
          .from('tarefas')
          .select('projeto_id, disciplina, fase, status')
          .in('projeto_id', projectIds)
          .is('deleted_at', null),
        fetchHorasPorProjetos(projectIds),
      ])

      nextTarefasProgress = (tarefasData.data ?? []) as TarefaProgressRow[]
      nextHorasPorProjeto = horasProjetoData
      setTarefasProgress(nextTarefasProgress)
      setHorasPorProjeto(nextHorasPorProjeto)
    } else {
      setTarefasProgress([])
      setHorasPorProjeto({})
    }

    let horasMesSegundos = 0
    let nextHorasMesPorDisciplina = EMPTY_HORAS_MES_DISCIPLINA
    if (!horasRes.error && horasRes.data) {
      for (const reg of horasRes.data) {
        if (reg.duracao_segundos != null) {
          horasMesSegundos += reg.duracao_segundos
        } else if (reg.fim == null && reg.inicio >= todayStart) {
          horasMesSegundos += Math.floor((Date.now() - new Date(reg.inicio).getTime()) / 1000)
        }
      }
      nextHorasMesPorDisciplina = aggregateHorasMesPorDisciplina(horasRes.data, todayStart)
      setHorasMesPorDisciplina(nextHorasMesPorDisciplina)
    } else {
      setHorasMesPorDisciplina(EMPTY_HORAS_MES_DISCIPLINA)
    }

    const monthBuckets = buildLast6MonthKeys()
    if (!horas6Res.error && horas6Res.data) {
      for (const reg of horas6Res.data) {
        const d = new Date(reg.inicio)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const bucket = monthBuckets.find((b) => b.key === key)
        if (!bucket) continue

        if (reg.duracao_segundos != null) {
          bucket.segundos += reg.duracao_segundos
        } else if (reg.fim == null) {
          bucket.segundos += Math.floor((Date.now() - d.getTime()) / 1000)
        }
      }
    }
    setHorasPorMes(monthBuckets)

    const statusCounts: TarefasPorStatusCounts = { ...EMPTY_TAREFAS_STATUS }
    if (!tarefasStatusRes.error && tarefasStatusRes.data) {
      for (const row of tarefasStatusRes.data) {
        const s = row.status as TarefaStatus
        if (s in statusCounts) {
          statusCounts[s as keyof TarefasPorStatusCounts] += 1
        }
      }
    }
    setTarefasPorStatus(statusCounts)

    const nextTarefasHoje = !tarefasHojeRes.error && tarefasHojeRes.data
      ? tarefasHojeRes.data.map((row) => {
          const r = row as Record<string, unknown>
          const projeto = r.projetos as { codigo: string } | null
          const responsavel = r.profiles as { nome: string } | null
          return {
            id: r.id as string,
            nome: r.nome as string,
            projeto_codigo: projeto?.codigo ?? '—',
            responsavel_id: (r.responsavel_id as string | null) ?? null,
            responsavel_nome: responsavel?.nome ?? null,
            status: r.status as TarefaHojeItem['status'],
          }
        })
      : []
    setTarefasHoje(nextTarefasHoje)

    const nextCalendarProjects = !calendarRes.error && calendarRes.data
      ? calendarRes.data.map((r) => ({
          data_inicio: r.data_inicio,
          data_entrega_prevista: r.data_entrega_prevista,
        }))
      : []
    setCalendarProjects(nextCalendarProjects)

    const nextMetrics = {
      projetosAtivos: ativosRes.data?.length ?? 0,
      tarefasAbertas: tarefasRes.count ?? 0,
      horasMesSegundos,
      projetosConcluidos: concluidosRes.count ?? 0,
    }
    setMetrics(nextMetrics)

    dashboardCache = {
      ativos: nextAtivos,
      suspensos: nextSuspensos,
      tarefasProgress: nextTarefasProgress,
      metrics: nextMetrics,
      horasPorMes: monthBuckets,
      horasMesPorDisciplina: nextHorasMesPorDisciplina,
      horasPorProjeto: nextHorasPorProjeto,
      tarefasPorStatus: statusCounts,
      tarefasHoje: nextTarefasHoje,
      calendarProjects: nextCalendarProjects,
    }

    setInitialLoading(false)
  }, [])

  useEffect(() => {
    void fetchDashboard()
  }, [fetchDashboard])

  const refreshHorasChart = useCallback(async () => {
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const sixMonthsStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

    const ativosIds = ativos.map((p) => p.id)

    const [horasRes, horas6Res, horasProjetoData] = await Promise.all([
      supabase
        .from('registros_tempo')
        .select('duracao_segundos, inicio, fim, disciplina')
        .gte('inicio', monthStart)
        .is('deleted_at', null),
      supabase
        .from('registros_tempo')
        .select('duracao_segundos, inicio, fim')
        .gte('inicio', sixMonthsStart)
        .is('deleted_at', null),
      ativosIds.length > 0 ? fetchHorasPorProjetos(ativosIds) : Promise.resolve({}),
    ])

    let horasMesSegundos = 0
    if (!horasRes.error && horasRes.data) {
      for (const reg of horasRes.data) {
        if (reg.duracao_segundos != null) {
          horasMesSegundos += reg.duracao_segundos
        } else if (reg.fim == null && reg.inicio >= todayStart) {
          horasMesSegundos += Math.floor((Date.now() - new Date(reg.inicio).getTime()) / 1000)
        }
      }
      setHorasMesPorDisciplina(aggregateHorasMesPorDisciplina(horasRes.data, todayStart))
    }

    const monthBuckets = buildLast6MonthKeys()
    if (!horas6Res.error && horas6Res.data) {
      for (const reg of horas6Res.data) {
        const d = new Date(reg.inicio)
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
        const bucket = monthBuckets.find((b) => b.key === key)
        if (!bucket) continue

        if (reg.duracao_segundos != null) {
          bucket.segundos += reg.duracao_segundos
        } else if (reg.fim == null) {
          bucket.segundos += Math.floor((Date.now() - d.getTime()) / 1000)
        }
      }
    }

    setHorasPorMes(monthBuckets)
    setMetrics((prev) => ({ ...prev, horasMesSegundos }))
    setHorasPorProjeto(horasProjetoData)
  }, [ativos])

  useEffect(() => {
    return subscribeHorasChartVersion(() => {
      setHorasChartVersion(getHorasChartVersion())
    })
  }, [])

  useEffect(() => {
    if (horasChartSkipRef.current) {
      horasChartSkipRef.current = false
      return
    }
    void refreshHorasChart()
  }, [horasChartVersion, refreshHorasChart])

  const create = useCallback(async (payload: CreateProjectPayload): Promise<Projeto> => {
    const projeto = await createProject(payload)
    await fetchDashboard()
    return projeto
  }, [fetchDashboard])

  const reactivateProject = useCallback(
    async (id: string): Promise<void> => {
      await patchProjetoRpc(id, { status: 'ativo' })
      await fetchDashboard()
    },
    [fetchDashboard],
  )

  return {
    ativos,
    suspensos,
    tarefasProgress,
    metrics,
    horasPorMes,
    horasMesPorDisciplina,
    horasPorProjeto,
    tarefasPorStatus,
    tarefasHoje,
    calendarProjects,
    loading: initialLoading,
    initialLoading,
    error,
    horasChartVersion,
    refresh: fetchDashboard,
    refreshHorasChart,
    createProject: create,
    reactivateProject,
  }
}

export function useHistoricoProjects() {
  const [projetos, setProjetos] = useState<HistoricoProjetoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchHistorico = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const rows = await fetchHistoricoProjects()
      setProjetos(rows)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar histórico')
      setProjetos([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchHistorico()
  }, [fetchHistorico])

  return { projetos, loading, error, refresh: fetchHistorico }
}
