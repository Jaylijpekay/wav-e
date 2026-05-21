export const ACTIE_HORIZON_DAYS = 21

export type ActieUrgency =
  | 'toekomstig'
  | 'groen'
  | 'oranje'
  | 'rood'

export type ActieKleur = 'groen' | 'oranje' | 'rood'

export function getActieUrgency(
  deadline: string | null,
  bron: string,
): ActieUrgency {
  const isManagement = bron === 'management'
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  if (!deadline) return 'rood'

  const due = new Date(deadline)
  due.setHours(0, 0, 0, 0)

  const daysUntil = Math.floor((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (!isManagement && daysUntil > ACTIE_HORIZON_DAYS) return 'toekomstig'
  if (daysUntil <= 7) return 'rood'
  if (daysUntil <= 14) return 'oranje'
  if (daysUntil <= 21) return 'groen'
  return 'groen'
}

export function isActieOpen(
  deadline: string | null,
  bron: string,
  afgerond: boolean,
): boolean {
  if (afgerond) return false
  return getActieUrgency(deadline, bron) !== 'toekomstig'
}

export const URGENCY_COLOR: Record<ActieKleur, string> = {
  groen: 'var(--green-signal-text)',
  oranje: 'var(--amber-text)',
  rood: 'var(--red-text)',
}

export const URGENCY_BG: Record<ActieKleur, string> = {
  groen: 'rgba(34,197,94,0.08)',
  oranje: 'rgba(251,191,36,0.08)',
  rood: 'rgba(220,38,38,0.08)',
}

export const URGENCY_LABEL: Record<ActieUrgency, string> = {
  toekomstig: 'Toekomstig',
  groen: 'Open',
  oranje: 'Urgent',
  rood: 'Kritiek',
}
